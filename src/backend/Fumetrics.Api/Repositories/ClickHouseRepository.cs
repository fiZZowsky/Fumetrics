using ClickHouse.Client.ADO;
using ClickHouse.Client.Copy;
using Fumetrics.Api.Models;
using Fumetrics.Contracts;

namespace Fumetrics.Api.Repositories;

public class ClickHouseRepository
{
    private readonly string _connectionString;

    public ClickHouseRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("ClickHouse")
            ?? throw new ArgumentNullException("Brak ClickHouse connection string");
    }

    public async Task EnsureTableExistsAsync()
    {
        using var connection = new ClickHouseConnection(_connectionString);
        await connection.OpenAsync();
        using var command = connection.CreateCommand();

        var createTableSql = @"
            CREATE TABLE IF NOT EXISTS logs (
                Timestamp DateTime64(3),
                ServiceName String,
                Level String,
                Message String,
                Tags Map(String, String)
            ) ENGINE = MergeTree()
            ORDER BY (ServiceName, Timestamp)";
        command.CommandText = createTableSql;
        await command.ExecuteNonQueryAsync();

        var createSummaryTableSql = @"
            CREATE TABLE IF NOT EXISTS logs_summary (
                ServiceName String,
                Level String,
                TotalCount AggregateFunction(count, String)
            ) ENGINE = AggregatingMergeTree()
            ORDER BY (ServiceName, Level)";
        command.CommandText = createSummaryTableSql;
        await command.ExecuteNonQueryAsync();

        var createMvSql = @"
            CREATE MATERIALIZED VIEW IF NOT EXISTS logs_summary_mv
            TO logs_summary AS
            SELECT
                ServiceName,
                Level,
                countState(Level) AS TotalCount
            FROM logs
            GROUP BY ServiceName, Level";
        command.CommandText = createMvSql;
        await command.ExecuteNonQueryAsync();

        var createAgentMetricsSql = @"
            CREATE TABLE IF NOT EXISTS agent_metrics (
                Timestamp DateTime64(3),
                MachineName String,
                OsVersion String,
                ServiceName String,
                State String,
                MachineCpu Float64,
                MachineRam Float64,
                MachineDisk Float64,
                ServiceCpu Float64, 
                ServiceRam Float64, 
                ServiceDisk Float64
            ) ENGINE = MergeTree()
            ORDER BY (MachineName, ServiceName, Timestamp)";
        command.CommandText = createAgentMetricsSql;
        await command.ExecuteNonQueryAsync();

        var createConfigTableSql = @"
            CREATE TABLE IF NOT EXISTS monitored_services_config (
                MachineName String,
                ServiceName String
            ) ENGINE = ReplacingMergeTree()
            ORDER BY (MachineName, ServiceName)";
        command.CommandText = createConfigTableSql;
        await command.ExecuteNonQueryAsync();
    }

    public async Task<IEnumerable<object>> GetLogsSummaryAsync()
    {
        using var connection = new ClickHouseConnection(_connectionString);
        using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT 
                ServiceName, 
                Level, 
                toUInt64(countMerge(TotalCount)) AS TotalCount 
            FROM logs_summary 
            GROUP BY ServiceName, Level 
            ORDER BY TotalCount DESC";
        using var reader = await command.ExecuteReaderAsync();
        var result = new List<object>();
        while (await reader.ReadAsync())
        {
            result.Add(new
            {
                ServiceName = reader.GetString(0),
                Level = reader.GetString(1),
                Count = Convert.ToInt64(reader.GetValue(2))
            });
        }
        return result;
    }

    public async Task<IEnumerable<LogTimelineDto>> GetLogsTimelineAsync()
    {
        var timeline = new List<LogTimelineDto>();
        var sql = @"
        SELECT 
            formatDateTime(toStartOfInterval(Timestamp, INTERVAL 10 second), '%H:%M:%S') as TimeWindow,
            Level,
            CAST(count(*) AS Int32) as Count
        FROM logs
        WHERE Timestamp >= now() - INTERVAL 5 MINUTE
        GROUP BY TimeWindow, Level
        ORDER BY TimeWindow ASC";
        using var connection = new ClickHouseConnection(_connectionString);
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            timeline.Add(new LogTimelineDto
            {
                TimeWindow = reader.GetString(0),
                Level = reader.GetString(1),
                Count = Convert.ToInt32(reader.GetValue(2))
            });
        }
        return timeline;
    }

    public async Task<IEnumerable<LatestLogDto>> GetLatestLogsAsync(int limit = 50)
    {
        var logs = new List<LatestLogDto>();
        var sql = $@"
        SELECT 
            toString(Timestamp) as Time,
            ServiceName,
            Level,
            Message
        FROM logs
        ORDER BY Timestamp DESC
        LIMIT {limit}";
        using var connection = new ClickHouseConnection(_connectionString);
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            logs.Add(new LatestLogDto
            {
                Timestamp = reader.GetString(0),
                ServiceName = reader.GetString(1),
                Level = reader.GetString(2),
                Message = reader.GetString(3)
            });
        }
        return logs;
    }

    public async Task InsertLogsBulkAsync(IEnumerable<LogEntry> logs)
    {
        using var connection = new ClickHouseConnection(_connectionString);
        using var bulkCopy = new ClickHouseBulkCopy(connection)
        {
            DestinationTableName = "logs",
            BatchSize = 10000
        };
        await bulkCopy.InitAsync();
        var rows = logs.Select(log => new object[]
        {
            DateTime.Parse(log.Timestamp),
            log.ServiceName,
            log.Level.ToString(),
            log.Message,
            log.Tags.ToDictionary(k => k.Key, v => v.Value)
        }).ToList();
        await bulkCopy.WriteToServerAsync(rows);
    }

    public async Task InsertAgentMetricsAsync(Fumetrics.Contracts.AgentStatusRequest request)
    {
        using var connection = new ClickHouseConnection(_connectionString);
        using var bulkCopy = new ClickHouseBulkCopy(connection)
        {
            DestinationTableName = "agent_metrics",
            BatchSize = 1000
        };
        await bulkCopy.InitAsync();

        var rows = request.Services.Select(service => new object[]
        {
            DateTime.UtcNow,
            request.MachineName,
            request.OsVersion,
            service.ServiceName,
            service.State.ToString(),
            request.CpuUsagePercent,
            request.RamUsagePercent,
            request.DiskUsagePercent,
            service.CpuUsage,
            service.RamUsage,
            service.DiskUsage
        }).ToList();

        await bulkCopy.WriteToServerAsync(rows);
    }

    public async Task<IEnumerable<AgentServiceStatusDto>> GetLatestAgentStatusAsync()
    {
        var statuses = new List<AgentServiceStatusDto>();
        var sql = @"
        SELECT 
            MachineName,
            argMax(OsVersion, Timestamp) AS OsVersion,
            ServiceName,
            argMax(State, Timestamp) AS State,
            max(Timestamp) AS LastUpdated,
            argMax(MachineCpu, Timestamp) AS MachineCpu,
            argMax(MachineRam, Timestamp) AS MachineRam,
            argMax(MachineDisk, Timestamp) AS MachineDisk,
            argMax(ServiceCpu, Timestamp) AS ServiceCpu,
            argMax(ServiceRam, Timestamp) AS ServiceRam,
            argMax(ServiceDisk, Timestamp) AS ServiceDisk
        FROM agent_metrics
        WHERE Timestamp >= now() - INTERVAL 10 MINUTE
          AND (MachineName, ServiceName) IN (SELECT MachineName, ServiceName FROM monitored_services_config)
        GROUP BY MachineName, ServiceName";

        using var connection = new ClickHouseConnection(_connectionString);
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            statuses.Add(new AgentServiceStatusDto
            {
                MachineName = reader.GetString(0),
                OsVersion = reader.GetString(1),
                ServiceName = reader.GetString(2),
                State = reader.GetString(3),
                LastUpdated = reader.GetString(4),
                MachineCpu = Convert.ToDouble(reader.GetValue(5)),
                MachineRam = Convert.ToDouble(reader.GetValue(6)),
                MachineDisk = Convert.ToDouble(reader.GetValue(7)),
                ServiceCpu = Convert.ToDouble(reader.GetValue(8)),
                ServiceRam = Convert.ToDouble(reader.GetValue(9)),
                ServiceDisk = Convert.ToDouble(reader.GetValue(10))
            });
        }
        return statuses;
    }

    public async Task<IEnumerable<AgentHardwareHistoryDto>> GetAgentHardwareHistoryAsync(string machineName, string range = "1h")
    {
        var history = new List<AgentHardwareHistoryDto>();
        string groupingFunction = range switch { "30d" => "toStartOfDay(Timestamp)", "24h" => "toStartOfHour(Timestamp)", _ => "toStartOfMinute(Timestamp)" };
        string timeFormat = range switch { "30d" => "'%Y-%m-%d'", "24h" => "'%m-%d %H:%i'", _ => "'%H:%i'" };
        string timeFilter = range switch { "30d" => "INTERVAL 30 DAY", "24h" => "INTERVAL 24 HOUR", _ => "INTERVAL 1 HOUR" };

        var sql = $@"
            SELECT 
                formatDateTime({groupingFunction}, {timeFormat}) as Time,
                avg(MachineCpu),
                avg(MachineRam),
                avg(MachineDisk)
            FROM agent_metrics
            WHERE MachineName = '{machineName}' 
              AND Timestamp >= now() - {timeFilter}
            GROUP BY {groupingFunction}
            ORDER BY {groupingFunction} ASC";

        using var connection = new ClickHouseConnection(_connectionString);
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            history.Add(new AgentHardwareHistoryDto
            {
                Timestamp = reader.GetString(0),
                Cpu = Math.Round(Convert.ToDouble(reader.GetValue(1)), 2),
                Ram = Math.Round(Convert.ToDouble(reader.GetValue(2)), 2),
                Disk = Math.Round(Convert.ToDouble(reader.GetValue(3)), 2)
            });
        }
        return history;
    }

    public async Task<IEnumerable<AgentHardwareHistoryDto>> GetServiceHardwareHistoryAsync(string machineName, string serviceName, string range = "1h")
    {
        var history = new List<AgentHardwareHistoryDto>();
        string groupingFunction = range switch { "30d" => "toStartOfDay(Timestamp)", "24h" => "toStartOfHour(Timestamp)", _ => "toStartOfMinute(Timestamp)" };
        string timeFormat = range switch { "30d" => "'%Y-%m-%d'", "24h" => "'%m-%d %H:%i'", _ => "'%H:%i'" };
        string timeFilter = range switch { "30d" => "INTERVAL 30 DAY", "24h" => "INTERVAL 24 HOUR", _ => "INTERVAL 1 HOUR" };

        var sql = $@"
            SELECT 
                formatDateTime({groupingFunction}, {timeFormat}) as Time,
                avg(ServiceCpu),
                avg(ServiceRam),
                avg(ServiceDisk)
            FROM agent_metrics
            WHERE MachineName = '{machineName}' AND ServiceName = '{serviceName}'
              AND Timestamp >= now() - {timeFilter}
            GROUP BY {groupingFunction}
            ORDER BY {groupingFunction} ASC";

        using var connection = new ClickHouseConnection(_connectionString);
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            history.Add(new AgentHardwareHistoryDto
            {
                Timestamp = reader.GetString(0),
                Cpu = Math.Round(Convert.ToDouble(reader.GetValue(1)), 2),
                Ram = Math.Round(Convert.ToDouble(reader.GetValue(2)), 2),
                Disk = Math.Round(Convert.ToDouble(reader.GetValue(3)), 2)
            });
        }
        return history;
    }

    public async Task<List<string>> GetMonitoredServicesForMachineAsync(string machineName)
    {
        var services = new List<string>();
        var sql = $"SELECT DISTINCT ServiceName FROM monitored_services_config WHERE MachineName = '{machineName}'";
        using var connection = new ClickHouseConnection(_connectionString);
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            services.Add(reader.GetString(0));
        }
        if (services.Count == 0) services.Add("Spooler");
        return services;
    }

    public async Task AddMonitoredServiceAsync(string machineName, string serviceName)
    {
        using var connection = new ClickHouseConnection(_connectionString);
        var checkSql = $"SELECT count() FROM monitored_services_config WHERE MachineName = '{machineName}' AND ServiceName = '{serviceName}'";
        using var checkCmd = connection.CreateCommand();
        checkCmd.CommandText = checkSql;
        var count = Convert.ToInt64(await checkCmd.ExecuteScalarAsync());
        if (count == 0)
        {
            var insertSql = $"INSERT INTO monitored_services_config (MachineName, ServiceName) VALUES ('{machineName}', '{serviceName}')";
            using var insertCmd = connection.CreateCommand();
            insertCmd.CommandText = insertSql;
            await insertCmd.ExecuteNonQueryAsync();
        }
    }

    public async Task RemoveMonitoredServiceAsync(string machineName, string serviceName)
    {
        using var connection = new ClickHouseConnection(_connectionString);
        var deleteSql = $"ALTER TABLE monitored_services_config DELETE WHERE MachineName = '{machineName}' AND ServiceName = '{serviceName}'";
        using var cmd = connection.CreateCommand();
        cmd.CommandText = deleteSql;
        await cmd.ExecuteNonQueryAsync();
    }
}