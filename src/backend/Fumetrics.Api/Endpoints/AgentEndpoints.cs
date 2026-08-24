using Fumetrics.Api.Contracts;
using Fumetrics.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace Fumetrics.Api.Endpoints;

public static class AgentEndpoints
{
    public static void MapAgentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/metrics").RequireCors("CorsPolicy");

        group.MapGet("/agents", async ([FromServices] AgentRepository repo) =>
            Results.Ok(await repo.GetLatestStatusAsync()));

        group.MapGet("/agents/{machineName}/history", async (string machineName, [FromQuery] int hours, [FromServices] AgentRepository repo) =>
        {
            int h = hours > 0 ? hours : 12;
            return Results.Ok(await repo.GetMachineMetricsHistoryAsync(machineName, h));
        });

        group.MapGet("/agents/{machineName}/services/{serviceName}/history", async (string machineName, string serviceName, string? range, [FromServices] AgentRepository repo) =>
            Results.Ok(await repo.GetServiceHardwareHistoryAsync(machineName, serviceName, range ?? "1h")));

        group.MapGet("/agents/{machineName}/config-services", async (string machineName, [FromServices] AgentRepository repo) =>
            Results.Ok(await repo.GetMonitoredServicesForMachineAsync(machineName)));

        group.MapPost("/agents/config-services", async ([FromBody] AddServiceRequest req, [FromServices] AgentRepository repo) =>
        {
            long count = await repo.ExecuteScalarAsync($"SELECT count() FROM monitored_services_config WHERE MachineName = '{req.MachineName}' AND ServiceName = '{req.ServiceName}'");
            if (count == 0) await repo.ExecuteNonQueryAsync($"INSERT INTO monitored_services_config (MachineName, ServiceName) VALUES ('{req.MachineName}', '{req.ServiceName}')");
            return Results.Ok(new { success = true });
        });

        group.MapPost("/agents/config-services/remove", async ([FromBody] AddServiceRequest req, [FromServices] AgentRepository repo) =>
        {
            await repo.ExecuteNonQueryAsync($"ALTER TABLE monitored_services_config DELETE WHERE MachineName = '{req.MachineName}' AND ServiceName = '{req.ServiceName}'");
            return Results.Ok(new { success = true });
        });

        group.MapGet("/saved-servers", async ([FromServices] AgentRepository repo) =>
            Results.Ok(await repo.GetSavedServersAsync()));

        group.MapPost("/saved-servers", async ([FromBody] SavedServerRequest req, [FromServices] AgentRepository repo) =>
        {
            long count = await repo.ExecuteScalarAsync($"SELECT count() FROM saved_servers WHERE MachineName = '{req.MachineName}' AND IpAddress = '{req.IpAddress}' AND Port = '{req.Port}'");
            if (count == 0) await repo.ExecuteNonQueryAsync($"INSERT INTO saved_servers (MachineName, IpAddress, Port) VALUES ('{req.MachineName}', '{req.IpAddress}', '{req.Port}')");
            return Results.Ok(new { success = true });
        });

        group.MapPost("/saved-servers/remove", async ([FromBody] SavedServerRequest req, [FromServices] AgentRepository repo) =>
        {
            await repo.ExecuteNonQueryAsync($"ALTER TABLE saved_servers DELETE WHERE MachineName = '{req.MachineName}' AND IpAddress = '{req.IpAddress}' AND Port = '{req.Port}'");
            return Results.Ok(new { success = true });
        });

        group.MapGet("/machines/tags", async ([FromServices] AgentRepository repo) =>
            Results.Ok(await repo.GetAllMachineTagsAsync()));

        group.MapPost("/machines/tags", async ([FromBody] MachineTagRequest req, [FromServices] AgentRepository repo) =>
        {
            await repo.ExecuteNonQueryAsync($"INSERT INTO machine_tags (MachineName, Tag) VALUES ('{req.MachineName}', '{req.Tag.Trim()}')");
            return Results.Ok(new { success = true });
        });

        group.MapPost("/machines/tags/remove", async ([FromBody] MachineTagRequest req, [FromServices] AgentRepository repo) =>
        {
            await repo.ExecuteNonQueryAsync($"ALTER TABLE machine_tags DELETE WHERE MachineName = '{req.MachineName}' AND Tag = '{req.Tag}'");
            return Results.Ok(new { success = true });
        });
    }
}