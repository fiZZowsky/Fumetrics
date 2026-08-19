namespace Fumetrics.Api.Data;

public class DatabaseInitializer(ClickHouseConnectionFactory dbFactory, ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync()
    {
        logger.LogInformation("Inicjalizacja schematu bazy danych ClickHouse...");
        using var connection = dbFactory.CreateConnection();
        await connection.OpenAsync();
        using var command = connection.CreateCommand();

        var scripts = new[]
        {
            @"CREATE TABLE IF NOT EXISTS logs (
                Timestamp DateTime64(3), ServiceName String, Level String, Message String, Tags Map(String, String)
            ) ENGINE = MergeTree() ORDER BY (ServiceName, Timestamp)",

            @"CREATE TABLE IF NOT EXISTS logs_summary (
                ServiceName String, Level String, TotalCount AggregateFunction(count, String)
            ) ENGINE = AggregatingMergeTree() ORDER BY (ServiceName, Level)",

            @"CREATE MATERIALIZED VIEW IF NOT EXISTS logs_summary_mv TO logs_summary AS
            SELECT ServiceName, Level, countState(Level) AS TotalCount FROM logs GROUP BY ServiceName, Level",

            @"CREATE TABLE IF NOT EXISTS agent_metrics (
                Timestamp DateTime64(3), MachineName String, OsVersion String, ServiceName String, State String,
                MachineCpu Float64, MachineRam Float64, MachineDisk Float64, ServiceCpu Float64, ServiceRam Float64, ServiceDisk Float64
            ) ENGINE = MergeTree() ORDER BY (MachineName, ServiceName, Timestamp)",

            @"CREATE TABLE IF NOT EXISTS monitored_services_config (
                MachineName String, ServiceName String
            ) ENGINE = ReplacingMergeTree() ORDER BY (MachineName, ServiceName)",

            @"CREATE TABLE IF NOT EXISTS saved_servers (
                MachineName String, IpAddress String, Port String
            ) ENGINE = ReplacingMergeTree() ORDER BY (MachineName, IpAddress, Port)",

            @"CREATE TABLE IF NOT EXISTS alert_rules (
                Id String, MachineName String, ServiceName String, Metric String, Threshold String, Email String, DelayMinutes Int32, RepeatMinutes Int32, HtmlTemplate String
            ) ENGINE = ReplacingMergeTree() ORDER BY Id",

            @"CREATE TABLE IF NOT EXISTS alert_history (
                Timestamp DateTime64(3), RuleId String
            ) ENGINE = MergeTree() ORDER BY (RuleId, Timestamp)",

            @"CREATE TABLE IF NOT EXISTS alert_history (
                Timestamp DateTime64(3), RuleId String
            ) ENGINE = MergeTree() ORDER BY (RuleId, Timestamp)",

            @"CREATE TABLE IF NOT EXISTS machine_tags (
                MachineName String, Tag String
            ) ENGINE = ReplacingMergeTree() ORDER BY (MachineName, Tag)",

            @"CREATE TABLE IF NOT EXISTS audit_logs (
                Timestamp DateTime64(3), Action String, TargetMachine String, TargetService String, UserIP String
            ) ENGINE = MergeTree() ORDER BY Timestamp",

            @"CREATE TABLE IF NOT EXISTS email_templates (
                Id String, Name String, HtmlContent String
            ) ENGINE = ReplacingMergeTree() ORDER BY Id"
        };

        foreach (var script in scripts)
        {
            command.CommandText = script;
            await command.ExecuteNonQueryAsync();
        }
    }
}