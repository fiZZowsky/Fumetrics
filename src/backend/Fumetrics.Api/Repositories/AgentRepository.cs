using ClickHouse.Client.Copy;
using Fumetrics.Api.Contracts;
using Fumetrics.Api.Data;

namespace Fumetrics.Api.Repositories;

public class AgentRepository(ClickHouseConnectionFactory dbFactory)
{
    public async Task InsertMetricsAsync(Fumetrics.Contracts.AgentStatusRequest request)
    {
        using var connection = dbFactory.CreateConnection();
        using var bulkCopy = new ClickHouseBulkCopy(connection) { DestinationTableName = "agent_metrics", BatchSize = 1000 };
        await bulkCopy.InitAsync();

        var rows = request.Services.Select(service => new object[] {
            DateTime.UtcNow, request.MachineName, request.OsVersion, service.ServiceName, service.State.ToString(),
            request.CpuUsagePercent, request.RamUsagePercent, request.DiskUsagePercent,
            service.CpuUsage, service.RamUsage, service.DiskUsage
        }).ToList();

        await bulkCopy.WriteToServerAsync(rows);
    }

    public async Task<IEnumerable<AgentServiceStatusDto>> GetLatestStatusAsync()
    {
        var statuses = new List<AgentServiceStatusDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();

        command.CommandText = @"
            SELECT c.MachineName, m.OsVersion, c.ServiceName, m.State, toString(m.Timestamp), m.MachineCpu, m.MachineRam, m.MachineDisk, m.ServiceCpu, m.ServiceRam, m.ServiceDisk
            FROM (SELECT DISTINCT MachineName, ServiceName FROM monitored_services_config) c
            LEFT JOIN (SELECT * FROM agent_metrics ORDER BY Timestamp DESC LIMIT 1 BY MachineName, ServiceName) m 
            ON c.MachineName = m.MachineName AND c.ServiceName = m.ServiceName
            ORDER BY c.MachineName ASC, c.ServiceName ASC";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            statuses.Add(new AgentServiceStatusDto(
                reader.GetString(0), reader.IsDBNull(1) ? "Nieznany" : reader.GetString(1), reader.GetString(2),
                reader.IsDBNull(3) ? "OCZEKIWANIE" : reader.GetString(3), reader.IsDBNull(4) ? "Brak danych" : reader.GetString(4),
                reader.IsDBNull(5) ? 0 : Convert.ToDouble(reader.GetValue(5)), reader.IsDBNull(6) ? 0 : Convert.ToDouble(reader.GetValue(6)),
                reader.IsDBNull(7) ? 0 : Convert.ToDouble(reader.GetValue(7)), reader.IsDBNull(8) ? 0 : Convert.ToDouble(reader.GetValue(8)),
                reader.IsDBNull(9) ? 0 : Convert.ToDouble(reader.GetValue(9)), reader.IsDBNull(10) ? 0 : Convert.ToDouble(reader.GetValue(10))
            ));
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
            SELECT formatDateTime({groupingFunction}, {timeFormat}) as Time, avg(MachineCpu), avg(MachineRam), avg(MachineDisk)
            FROM agent_metrics WHERE MachineName = '{machineName}' AND Timestamp >= now() - {timeFilter}
            GROUP BY {groupingFunction} ORDER BY {groupingFunction} ASC";

        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            history.Add(new AgentHardwareHistoryDto(
                reader.GetString(0), Math.Round(Convert.ToDouble(reader.GetValue(1)), 2),
                Math.Round(Convert.ToDouble(reader.GetValue(2)), 2), Math.Round(Convert.ToDouble(reader.GetValue(3)), 2)));
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
            SELECT formatDateTime({groupingFunction}, {timeFormat}) as Time, avg(ServiceCpu), avg(ServiceRam), avg(ServiceDisk)
            FROM agent_metrics WHERE MachineName = '{machineName}' AND ServiceName = '{serviceName}' AND Timestamp >= now() - {timeFilter}
            GROUP BY {groupingFunction} ORDER BY {groupingFunction} ASC";

        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            history.Add(new AgentHardwareHistoryDto(
                reader.GetString(0), Math.Round(Convert.ToDouble(reader.GetValue(1)), 2),
                Math.Round(Convert.ToDouble(reader.GetValue(2)), 2), Math.Round(Convert.ToDouble(reader.GetValue(3)), 2)));
        }
        return history;
    }

    public async Task<List<string>> GetMonitoredServicesForMachineAsync(string machineName)
    {
        var services = new List<string>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT DISTINCT ServiceName FROM monitored_services_config WHERE MachineName = '{machineName}'";
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) services.Add(reader.GetString(0));
        return services;
    }

    public async Task ExecuteNonQueryAsync(string sql)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync();
    }

    public async Task<long> ExecuteScalarAsync(string sql)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    public async Task<IEnumerable<SavedServerDto>> GetSavedServersAsync()
    {
        var servers = new List<SavedServerDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT DISTINCT MachineName, IpAddress, Port FROM saved_servers";
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) servers.Add(new SavedServerDto(reader.GetString(0), reader.GetString(1), reader.GetString(2)));
        return servers;
    }

    public async Task<Dictionary<string, List<string>>> GetAllMachineTagsAsync()
    {
        var tagsMap = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT MachineName, Tag FROM machine_tags FINAL";
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var machine = reader.GetString(0);
            var tag = reader.GetString(1);
            if (!tagsMap.ContainsKey(machine)) tagsMap[machine] = new List<string>();
            tagsMap[machine].Add(tag);
        }
        return tagsMap;
    }

    public async Task<IEnumerable<AgentHardwareHistoryDto>> GetMachineMetricsHistoryAsync(string machineName, int hoursBack = 24)
    {
        var history = new List<AgentHardwareHistoryDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();

        command.CommandText = $@"
        SELECT 
            toStartOfFiveMinute(Timestamp) as TimeBin,
            avg(MachineCpu) as AvgCpu,
            avg(MachineRam) as AvgRam,
            avg(MachineDisk) as AvgDisk
        FROM agent_metrics 
        WHERE MachineName = '{machineName}' 
          AND Timestamp >= now() - INTERVAL {hoursBack} HOUR
        GROUP BY TimeBin
        ORDER BY TimeBin ASC";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            history.Add(new AgentHardwareHistoryDto(
                reader.GetDateTime(0).ToString("yyyy-MM-ddTHH:mm:ss"),
                Math.Round(reader.GetDouble(1), 2),
                Math.Round(reader.GetDouble(2), 2),
                Math.Round(reader.GetDouble(3), 2)
            ));
        }
        return history;
    }
}