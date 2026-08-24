using Fumetrics.Api.Contracts;
using Fumetrics.Api.Repositories;
using Fumetrics.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Fumetrics.Api.Endpoints;

public static class AlertEndpoints
{
    public static void MapAlertEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/metrics/alerts").RequireCors("CorsPolicy");

        group.MapGet("/", async ([FromServices] AlertRepository repo) => Results.Ok(await repo.GetAllAsync()));

        group.MapGet("/active", ([FromServices] AlertStateManager stateManager) =>
        {
            var activeAlerts = stateManager.ActiveStates.Select(kvp =>
            {
                var parts = kvp.Key.Split('_', 3);
                return new
                {
                    RuleId = parts.Length > 0 ? parts[0] : "N/A",
                    MachineName = parts.Length > 1 ? parts[1] : "N/A",
                    ServiceName = parts.Length > 2 ? parts[2] : "N/A",
                    FirstSeen = kvp.Value.FirstSeen,
                    LastSent = kvp.Value.LastSent,
                    IsFiring = kvp.Value.IsFiring,
                    DurationMinutes = Math.Round((DateTime.UtcNow - kvp.Value.FirstSeen).TotalMinutes, 1)
                };
            })
            .OrderByDescending(a => a.IsFiring)
            .ThenByDescending(a => a.DurationMinutes)
            .ToList();

            return Results.Ok(activeAlerts);
        });

        group.MapGet("/history", async ([FromServices] AlertHistoryRepository repo) =>
            Results.Ok(await repo.GetLatestAsync(200)));

        group.MapPost("/", async ([FromBody] AlertRuleDto rule, [FromServices] AlertRepository repo) =>
        {
            string cleanTemplate = (rule.HtmlTemplate ?? "").Replace("'", "''");
            await repo.ExecuteNonQueryAsync($"INSERT INTO alert_rules (Id, MachineName, ServiceName, Metric, Threshold, Email, DelayMinutes, RepeatMinutes, HtmlTemplate) VALUES ('{rule.Id}', '{rule.MachineName}', '{rule.ServiceName}', '{rule.Metric}', '{rule.Threshold}', '{rule.Email}', {rule.DelayMinutes}, {rule.RepeatMinutes}, '{cleanTemplate}')");
            return Results.Ok(new { success = true });
        });

        group.MapPut("/", async ([FromBody] AlertRuleDto rule, [FromServices] AlertRepository repo) =>
        {
            string cleanTemplate = (rule.HtmlTemplate ?? "").Replace("'", "''");
            await repo.ExecuteNonQueryAsync($"ALTER TABLE alert_rules UPDATE MachineName = '{rule.MachineName}', ServiceName = '{rule.ServiceName}', Metric = '{rule.Metric}', Threshold = '{rule.Threshold}', Email = '{rule.Email}', DelayMinutes = {rule.DelayMinutes}, RepeatMinutes = {rule.RepeatMinutes}, HtmlTemplate = '{cleanTemplate}' WHERE Id = '{rule.Id}'");
            return Results.Ok(new { success = true });
        });

        group.MapDelete("/{id}", async (string id, [FromServices] AlertRepository repo) =>
        {
            await repo.ExecuteNonQueryAsync($"ALTER TABLE alert_rules DELETE WHERE Id = '{id}'");
            return Results.Ok(new { success = true });
        });
    }
}