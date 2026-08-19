using Fumetrics.Api.Contracts;
using Fumetrics.Api.Repositories;
using Fumetrics.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;

namespace Fumetrics.Api.Endpoints;

public static class LogEndpoints
{
    public static void MapLogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/metrics").RequireCors("CorsPolicy");

        group.MapGet("/summary", async ([FromServices] LogRepository repo) =>
            Results.Ok(await repo.GetSummaryAsync()));

        group.MapGet("/timeline", async ([FromServices] LogRepository repo) =>
            Results.Ok(await repo.GetTimelineAsync()));

        group.MapGet("/latest", async ([FromServices] LogRepository repo) =>
            Results.Ok(await repo.GetLatestAsync(50)));

        group.MapPost("/logs", async ([FromBody] LogEntryDto log, [FromServices] LogRepository repo, [FromServices] IHubContext<TelemetryHub> hub) =>
        {
            await repo.InsertLogsBulkAsync(new[] { log });
            await hub.Clients.All.SendAsync("DataUpdated");
            return Results.Ok(new { success = true });
        });
    }
}