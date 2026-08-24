using Fumetrics.Api.Contracts;
using Fumetrics.Api.Data;

namespace Fumetrics.Api.Repositories;

public class AlertRepository(ClickHouseConnectionFactory dbFactory)
{
    public async Task<IEnumerable<AlertRuleDto>> GetAllAsync()
    {
        var rules = new List<AlertRuleDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Username, Id, MachineName, ServiceName, Metric, Threshold, Email, DelayMinutes, RepeatMinutes, HtmlTemplate FROM alert_rules FINAL";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            rules.Add(new AlertRuleDto(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.GetString(6),
                Convert.ToInt32(reader.GetValue(7)),
                Convert.ToInt32(reader.GetValue(8)),
                reader.IsDBNull(9) ? "" : reader.GetString(9)
            ));
        }
        return rules;
    }

    public async Task<IEnumerable<AlertRuleDto>> GetAllAsync(string username)
    {
        var rules = new List<AlertRuleDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT Username, Id, MachineName, ServiceName, Metric, Threshold, Email, DelayMinutes, RepeatMinutes, HtmlTemplate FROM alert_rules FINAL WHERE Username = '{username}'";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            rules.Add(new AlertRuleDto(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.GetString(6),
                Convert.ToInt32(reader.GetValue(7)),
                Convert.ToInt32(reader.GetValue(8)),
                reader.IsDBNull(9) ? "" : reader.GetString(9)
            ));
        }
        return rules;
    }

    public async Task LogSentAsync(string username, string ruleId)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = $"INSERT INTO alert_history (Username, Timestamp, RuleId) VALUES ('{username}', now(), '{ruleId}')";
        await command.ExecuteNonQueryAsync();
    }

    public async Task<DateTime?> GetLastSentTimeAsync(string username, string ruleId)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT max(Timestamp) FROM alert_history WHERE Username = '{username}' AND RuleId = '{ruleId}'";
        var result = await command.ExecuteScalarAsync();
        return result != DBNull.Value && result != null ? Convert.ToDateTime(result) : null;
    }

    public async Task ExecuteNonQueryAsync(string sql)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync();
    }
}