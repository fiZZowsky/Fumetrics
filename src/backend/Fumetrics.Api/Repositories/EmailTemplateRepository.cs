using Fumetrics.Api.Contracts;
using Fumetrics.Api.Data;

namespace Fumetrics.Api.Repositories;

public class EmailTemplateRepository(ClickHouseConnectionFactory dbFactory)
{
    public async Task<IEnumerable<EmailTemplateDto>> GetAllAsync()
    {
        var templates = new List<EmailTemplateDto>();
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id, Name, HtmlContent FROM email_templates FINAL";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            templates.Add(new EmailTemplateDto(reader.GetString(0), reader.GetString(1), reader.GetString(2)));
        }
        return templates;
    }

    public async Task ExecuteNonQueryAsync(string sql)
    {
        using var connection = dbFactory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync();
    }
}