using Fumetrics.Api.Hubs;
using Fumetrics.Api.Repositories;
using Fumetrics.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(5170, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http1;
    });

    options.ListenAnyIP(50051, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http2;
    });
});

builder.Services.AddGrpc();
builder.Services.AddGrpcReflection();
builder.Services.AddSingleton<ClickHouseRepository>();
builder.Services.AddSignalR();
builder.Services.AddHostedService<AlertWorker>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy => policy
        .SetIsOriginAllowed((host) => true)
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials());
});

var app = builder.Build();

var repository = app.Services.GetRequiredService<ClickHouseRepository>();
await repository.EnsureTableExistsAsync();

app.UseCors("CorsPolicy");

app.MapGrpcService<TelemetryService>();
app.MapHub<TelemetryHub>("/hubs/telemetry");

if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}

app.MapGet("/api/metrics/summary", async (ClickHouseRepository repo) =>
{
    var summary = await repo.GetLogsSummaryAsync();
    return Results.Ok(summary);
});

app.MapGet("/api/metrics/timeline", async (ClickHouseRepository repo) =>
{
    var timeline = await repo.GetLogsTimelineAsync();
    return Results.Ok(timeline);
});

app.MapGet("/api/metrics/latest", async (ClickHouseRepository repo) =>
{
    var logs = await repo.GetLatestLogsAsync(50);
    return Results.Ok(logs);
});

app.MapGet("/api/metrics/agents", async (ClickHouseRepository repo) =>
{
    var agents = await repo.GetLatestAgentStatusAsync();
    return Results.Ok(agents);
});

app.MapGet("/api/metrics/agents/{machineName}/history", async (string machineName, string? range, ClickHouseRepository repo) =>
{
    var history = await repo.GetAgentHardwareHistoryAsync(machineName, range ?? "1h");
    return Results.Ok(history);
});

app.MapGet("/api/metrics/agents/{machineName}/services/{serviceName}/history", async (string machineName, string serviceName, string? range, ClickHouseRepository repo) =>
{
    var history = await repo.GetServiceHardwareHistoryAsync(machineName, serviceName, range ?? "1h");
    return Results.Ok(history);
});

app.MapGet("/api/metrics/agents/{machineName}/config-services", async (string machineName, ClickHouseRepository repo) =>
{
    var services = await repo.GetMonitoredServicesForMachineAsync(machineName);
    return Results.Ok(services);
});

app.MapPost("/api/metrics/agents/config-services", async ([FromBody] AddServiceRequest req, [FromServices] ClickHouseRepository repo) =>
{
    await repo.AddMonitoredServiceAsync(req.MachineName, req.ServiceName);
    return Results.Ok(new { success = true });
});

app.MapPost("/api/metrics/agents/config-services/remove", async ([FromBody] AddServiceRequest req, [FromServices] ClickHouseRepository repo) =>
{
    await repo.RemoveMonitoredServiceAsync(req.MachineName, req.ServiceName);
    return Results.Ok(new { success = true });
});

app.MapGet("/api/metrics/saved-servers", async (ClickHouseRepository repo) =>
{
    var servers = await repo.GetSavedServersAsync();
    return Results.Ok(servers);
});

app.MapPost("/api/metrics/saved-servers", async ([FromBody] SavedServerRequest req, [FromServices] ClickHouseRepository repo) =>
{
    await repo.AddSavedServerAsync(req.MachineName, req.IpAddress, req.Port);
    return Results.Ok(new { success = true });
});

app.MapPost("/api/metrics/saved-servers/remove", async ([FromBody] SavedServerRequest req, [FromServices] ClickHouseRepository repo) =>
{
    await repo.RemoveSavedServerAsync(req.MachineName, req.IpAddress, req.Port);
    return Results.Ok(new { success = true });
});

app.MapGet("/api/metrics/alerts", async (ClickHouseRepository repo) =>
{
    var alerts = await repo.GetAlertRulesAsync();
    return Results.Ok(alerts);
});

app.MapPost("/api/metrics/alerts", async ([FromBody] Fumetrics.Api.Models.AlertRuleDto rule, [FromServices] ClickHouseRepository repo) =>
{
    await repo.AddAlertRuleAsync(rule);
    return Results.Ok(new { success = true });
});

app.MapPut("/api/metrics/alerts", async ([FromBody] Fumetrics.Api.Models.AlertRuleDto rule, [FromServices] ClickHouseRepository repo) =>
{
    await repo.UpdateAlertRuleAsync(rule);
    return Results.Ok(new { success = true });
});

app.MapDelete("/api/metrics/alerts/{id}", async (string id, ClickHouseRepository repo) =>
{
    await repo.RemoveAlertRuleAsync(id);
    return Results.Ok(new { success = true });
});

app.MapPost("/api/metrics/logs", async (
    [FromBody] Fumetrics.Contracts.LogEntry log,
    [FromServices] Fumetrics.Api.Repositories.ClickHouseRepository repo,
    [FromServices] Microsoft.AspNetCore.SignalR.IHubContext<Fumetrics.Api.Hubs.TelemetryHub> hub) =>
{
    await repo.InsertLogsBulkAsync(new[] { log });
    await hub.Clients.All.SendAsync("DataUpdated");
    return Results.Ok(new { success = true });
});

app.MapGet("/", () => "Serwer API działa (w tym gRPC pod portem 50051).");

app.Run();

record AddServiceRequest(string MachineName, string ServiceName);
record SavedServerRequest(string MachineName, string IpAddress, string Port);