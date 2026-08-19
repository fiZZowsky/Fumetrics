using ClickHouse.Client.ADO;

namespace Fumetrics.Api.Data;

public class ClickHouseConnectionFactory(IConfiguration configuration)
{
    private readonly string _connectionString = configuration.GetConnectionString("ClickHouse")
        ?? throw new InvalidOperationException("Brak ClickHouse connection string");

    public ClickHouseConnection CreateConnection() => new(_connectionString);
}
