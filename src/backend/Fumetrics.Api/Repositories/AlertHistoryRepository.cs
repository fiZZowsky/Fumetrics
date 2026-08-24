using Fumetrics.Api.Contracts;
using Fumetrics.Api.Data;

namespace Fumetrics.Api.Repositories;

public class AlertHistoryRepository(ClickHouseConnectionFactory dbFactory)
{
    public async Task InsertAsync(AlertHistoryDto history)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        string timestamp = history.Timestamp.ToString("yyyy-MM-dd HH:mm:ss");
        string safeReason = (history.Reason ?? "").Replace("'", "''");

        command.CommandText = $"INSERT INTO alert_history (Id, Username, RuleId, MachineName, ServiceName, State, Reason, Timestamp) VALUES ('{history.Id}', '{history.Username}', '{history.RuleId}', '{history.MachineName}', '{history.ServiceName}', '{history.State}', '{safeReason}', '{timestamp}')";
        await command.ExecuteNonQueryAsync();
    }

    public async Task<IEnumerable<AlertHistoryDto>> GetLatestAsync(string username, int limit = 200)
    {
        var history = new List<AlertHistoryDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();

        command.CommandText = $"SELECT Id, Username, RuleId, MachineName, ServiceName, State, Reason, Timestamp FROM alert_history WHERE Username = '{username}' ORDER BY Timestamp DESC LIMIT {limit}";

        try
        {
            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                history.Add(new AlertHistoryDto(
                    reader.GetString(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetString(4),
                    reader.GetString(5),
                    reader.GetString(6),
                    reader.GetDateTime(7)
                ));
            }
        }
        catch (Exception)
        {
            throw;
        }

        return history;
    }
}