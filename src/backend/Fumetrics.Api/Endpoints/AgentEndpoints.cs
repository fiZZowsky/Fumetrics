using Fumetrics.Api.Contracts;
using Fumetrics.Api.Extensions;
using Fumetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace Fumetrics.Api.Endpoints;

public static class AgentEndpoints
{
    public static void MapAgentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/metrics").RequireCors("CorsPolicy").RequireAuthorization();

        group.MapGet("/agents", async (HttpContext ctx, [FromServices] AgentRepository repo) =>
            Results.Ok(await repo.GetLatestStatusAsync(ctx.User.GetUsername())));

        group.MapGet("/agents/{machineName}/history", async (string machineName, [FromQuery] int? hours, [FromQuery] string? range, [FromServices] AgentRepository repo) =>
        {
            if (hours.HasValue && hours.Value > 0)
            {
                return Results.Ok(await repo.GetMachineMetricsHistoryAsync(machineName, hours.Value));
            }
            return Results.Ok(await repo.GetAgentHardwareHistoryAsync(machineName, range ?? "1h"));
        });

        group.MapGet("/agents/{machineName}/services/{serviceName}/history", async (string machineName, string serviceName, [FromQuery] string? range, [FromServices] AgentRepository repo) =>
        {
            return Results.Ok(await repo.GetServiceHardwareHistoryAsync(machineName, serviceName, range ?? "1h"));
        });

        group.MapGet("/agents/{machineName}/config-services", async (string machineName, [FromServices] AgentRepository repo) =>
            Results.Ok(await repo.GetAllMonitoredServicesForMachineAsync(machineName)))
        .AllowAnonymous();

        group.MapPost("/agents/config-services", async ([FromBody] AddServiceRequest req, HttpContext ctx, [FromServices] AgentRepository repo) =>
        {
            string username = ctx.User.GetUsername();
            long count = await repo.ExecuteScalarAsync($"SELECT count() FROM monitored_services_config WHERE Username = '{username}' AND MachineName = '{req.MachineName}' AND ServiceName = '{req.ServiceName}'");
            if (count == 0) await repo.ExecuteNonQueryAsync($"INSERT INTO monitored_services_config (Username, MachineName, ServiceName) VALUES ('{username}', '{req.MachineName}', '{req.ServiceName}')");
            return Results.Ok(new { success = true });
        });

        group.MapPost("/agents/config-services/remove", async ([FromBody] AddServiceRequest req, HttpContext ctx, [FromServices] AgentRepository repo) =>
        {
            string username = ctx.User.GetUsername();
            await repo.ExecuteNonQueryAsync($"ALTER TABLE monitored_services_config DELETE WHERE Username = '{username}' AND MachineName = '{req.MachineName}' AND ServiceName = '{req.ServiceName}'");
            return Results.Ok(new { success = true });
        });

        group.MapGet("/saved-servers", async (HttpContext ctx, [FromServices] AgentRepository repo) =>
            Results.Ok(await repo.GetSavedServersAsync(ctx.User.GetUsername())));

        group.MapPost("/saved-servers", async ([FromBody] SavedServerRequest req, HttpContext ctx, [FromServices] AgentRepository repo) =>
        {
            string username = ctx.User.GetUsername();
            long count = await repo.ExecuteScalarAsync($"SELECT count() FROM saved_servers WHERE Username = '{username}' AND MachineName = '{req.MachineName}' AND IpAddress = '{req.IpAddress}' AND Port = '{req.Port}'");
            if (count == 0) await repo.ExecuteNonQueryAsync($"INSERT INTO saved_servers (Username, MachineName, IpAddress, Port) VALUES ('{username}', '{req.MachineName}', '{req.IpAddress}', '{req.Port}')");
            return Results.Ok(new { success = true });
        });

        group.MapPost("/saved-servers/remove", async ([FromBody] SavedServerRequest req, HttpContext ctx, [FromServices] AgentRepository repo) =>
        {
            string username = ctx.User.GetUsername();
            await repo.ExecuteNonQueryAsync($"ALTER TABLE saved_servers DELETE WHERE Username = '{username}' AND MachineName = '{req.MachineName}' AND IpAddress = '{req.IpAddress}' AND Port = '{req.Port}'");
            return Results.Ok(new { success = true });
        });

        group.MapGet("/machines/tags", async (HttpContext ctx, [FromServices] AgentRepository repo) =>
            Results.Ok(await repo.GetAllMachineTagsAsync(ctx.User.GetUsername())));

        group.MapPost("/machines/tags", async ([FromBody] MachineTagRequest req, HttpContext ctx, [FromServices] AgentRepository repo) =>
        {
            string username = ctx.User.GetUsername();
            await repo.ExecuteNonQueryAsync($"INSERT INTO machine_tags (Username, MachineName, Tag) VALUES ('{username}', '{req.MachineName}', '{req.Tag.Trim()}')");
            return Results.Ok(new { success = true });
        });

        group.MapPost("/machines/tags/remove", async ([FromBody] MachineTagRequest req, HttpContext ctx, [FromServices] AgentRepository repo) =>
        {
            string username = ctx.User.GetUsername();
            await repo.ExecuteNonQueryAsync($"ALTER TABLE machine_tags DELETE WHERE Username = '{username}' AND MachineName = '{req.MachineName}' AND Tag = '{req.Tag}'");
            return Results.Ok(new { success = true });
        });
    }
}