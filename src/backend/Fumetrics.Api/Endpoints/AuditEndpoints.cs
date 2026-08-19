using Fumetrics.Api.Contracts;
using Fumetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace Fumetrics.Api.Endpoints;

public static class AuditEndpoints
{
    public static void MapAuditEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/metrics/audit").RequireCors("CorsPolicy");

        group.MapGet("/", async ([FromServices] AuditRepository repo) =>
            Results.Ok(await repo.GetLatestLogsAsync()));

        group.MapPost("/", async ([FromBody] AuditLogRequest req, HttpContext context, [FromServices] AuditRepository repo) =>
        {
            var ip = context.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
            await repo.InsertLogAsync(req.Action, req.TargetMachine, req.TargetService, ip);
            return Results.Ok(new { success = true });
        });
    }
}