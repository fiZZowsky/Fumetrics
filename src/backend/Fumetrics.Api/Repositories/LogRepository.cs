using ClickHouse.Client.Copy;
using Fumetrics.Api.Contracts;
using Fumetrics.Api.Data;

namespace Fumetrics.Api.Repositories;

public class LogRepository(ClickHouseConnectionFactory dbFactory)
{
    public async Task InsertLogsBulkAsync(IEnumerable<LogEntryDto> logs)
    {
        using var connection = dbFactory.CreateConnection();
        using var bulkCopy = new ClickHouseBulkCopy(connection) { DestinationTableName = "logs", BatchSize = 10000 };
        await bulkCopy.InitAsync();

        var rows = logs.Select(log => new object[] {
            DateTime.Parse(log.Timestamp), log.ServiceName, log.Level, log.Message, log.Tags
        }).ToList();

        await bulkCopy.WriteToServerAsync(rows);
    }

    public async Task<IEnumerable<LogSummaryDto>> GetSummaryAsync()
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT ServiceName, Level, toUInt64(countMerge(TotalCount)) AS TotalCount 
            FROM logs_summary GROUP BY ServiceName, Level ORDER BY TotalCount DESC";

        using var reader = await command.ExecuteReaderAsync();
        var result = new List<LogSummaryDto>();
        while (await reader.ReadAsync())
        {
            result.Add(new LogSummaryDto(reader.GetString(0), reader.GetString(1), Convert.ToInt64(reader.GetValue(2))));
        }
        return result;
    }

    public async Task<IEnumerable<LatestLogDto>> GetLatestAsync(int limit = 50)
    {
        var logs = new List<LatestLogDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT toString(Timestamp), ServiceName, Level, Message FROM logs ORDER BY Timestamp DESC LIMIT {limit}";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
            logs.Add(new LatestLogDto(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3)));

        return logs;
    }

    public async Task<IEnumerable<LogTimelineDto>> GetTimelineAsync()
    {
        var timeline = new List<LogTimelineDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT formatDateTime(toStartOfInterval(Timestamp, INTERVAL 10 second), '%H:%M:%S') as TimeWindow, Level, CAST(count(*) AS Int32) as Count
            FROM logs WHERE Timestamp >= now() - INTERVAL 5 MINUTE GROUP BY TimeWindow, Level ORDER BY TimeWindow ASC";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
            timeline.Add(new LogTimelineDto(reader.GetString(0), reader.GetString(1), Convert.ToInt32(reader.GetValue(2))));

        return timeline;
    }
}