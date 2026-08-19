using Fumetrics.Api.Contracts;
using Fumetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace Fumetrics.Api.Endpoints;

public static class AlertEndpoints
{
    public static void MapAlertEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/metrics/alerts").RequireCors("CorsPolicy");

        group.MapGet("/", async ([FromServices] AlertRepository repo) =>
            Results.Ok(await repo.GetAllAsync()));

        group.MapPost("/", async ([FromBody] AlertRuleDto rule, [FromServices] AlertRepository repo) =>
        {
            await repo.ExecuteNonQueryAsync($"INSERT INTO alert_rules (Id, MachineName, ServiceName, Metric, Threshold, Email, CooldownMinutes) VALUES ('{rule.Id}', '{rule.MachineName}', '{rule.ServiceName}', '{rule.Metric}', '{rule.Threshold}', '{rule.Email}', {rule.CooldownMinutes})");
            return Results.Ok(new { success = true });
        });

        group.MapPut("/", async ([FromBody] AlertRuleDto rule, [FromServices] AlertRepository repo) =>
        {
            await repo.ExecuteNonQueryAsync($"ALTER TABLE alert_rules UPDATE MachineName = '{rule.MachineName}', ServiceName = '{rule.ServiceName}', Metric = '{rule.Metric}', Threshold = '{rule.Threshold}', Email = '{rule.Email}', CooldownMinutes = {rule.CooldownMinutes} WHERE Id = '{rule.Id}'");
            return Results.Ok(new { success = true });
        });

        group.MapDelete("/{id}", async (string id, [FromServices] AlertRepository repo) =>
        {
            await repo.ExecuteNonQueryAsync($"ALTER TABLE alert_rules DELETE WHERE Id = '{id}'");
            return Results.Ok(new { success = true });
        });
    }
}