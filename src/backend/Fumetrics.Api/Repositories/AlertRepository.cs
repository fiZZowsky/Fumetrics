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
        command.CommandText = "SELECT Id, MachineName, ServiceName, Metric, Threshold, Email, DelayMinutes, RepeatMinutes FROM alert_rules FINAL";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            rules.Add(new AlertRuleDto(
                reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
                reader.GetString(4), reader.GetString(5), Convert.ToInt32(reader.GetValue(6)), Convert.ToInt32(reader.GetValue(7))));
        }
        return rules;
    }

    public async Task LogSentAsync(string ruleId)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = $"INSERT INTO alert_history (Timestamp, RuleId) VALUES (now(), '{ruleId}')";
        await command.ExecuteNonQueryAsync();
    }

    public async Task<DateTime?> GetLastSentTimeAsync(string ruleId)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT max(Timestamp) FROM alert_history WHERE RuleId = '{ruleId}'";
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