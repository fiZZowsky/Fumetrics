using Fumetrics.Api.Contracts;
using Fumetrics.Api.Data;

namespace Fumetrics.Api.Repositories;

public class AuditRepository(ClickHouseConnectionFactory dbFactory)
{
    public async Task InsertLogAsync(string action, string targetMachine, string targetService, string userIp)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        action = action.Replace("'", "''");
        targetMachine = targetMachine.Replace("'", "''");
        targetService = targetService.Replace("'", "''");

        command.CommandText = $"INSERT INTO audit_logs (Timestamp, Action, TargetMachine, TargetService, UserIP) VALUES (now(), '{action}', '{targetMachine}', '{targetService}', '{userIp}')";
        await command.ExecuteNonQueryAsync();
    }

    public async Task<IEnumerable<AuditLogDto>> GetLatestLogsAsync(int limit = 100)
    {
        var logs = new List<AuditLogDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT toString(Timestamp), Action, TargetMachine, TargetService, UserIP FROM audit_logs ORDER BY Timestamp DESC LIMIT {limit}";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            logs.Add(new AuditLogDto(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4)));
        }
        return logs;
    }
}