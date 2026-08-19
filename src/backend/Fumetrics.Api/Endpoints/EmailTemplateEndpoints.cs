using Fumetrics.Api.Contracts;
using Fumetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace Fumetrics.Api.Endpoints;

public static class EmailTemplateEndpoints
{
    public static void MapEmailTemplateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/metrics/email-templates").RequireCors("CorsPolicy");

        group.MapGet("/", async ([FromServices] EmailTemplateRepository repo) => Results.Ok(await repo.GetAllAsync()));

        group.MapPost("/", async ([FromBody] EmailTemplateDto dto, [FromServices] EmailTemplateRepository repo) =>
        {
            string cleanContent = (dto.HtmlContent ?? "").Replace("'", "''");
            string cleanName = (dto.Name ?? "").Replace("'", "''");
            string id = string.IsNullOrEmpty(dto.Id) ? Guid.NewGuid().ToString() : dto.Id;

            await repo.ExecuteNonQueryAsync($"INSERT INTO email_templates (Id, Name, HtmlContent) VALUES ('{id}', '{cleanName}', '{cleanContent}')");
            return Results.Ok(new { success = true, id });
        });

        group.MapDelete("/{id}", async (string id, [FromServices] EmailTemplateRepository repo) =>
        {
            await repo.ExecuteNonQueryAsync($"ALTER TABLE email_templates DELETE WHERE Id = '{id}'");
            return Results.Ok(new { success = true });
        });
    }
}