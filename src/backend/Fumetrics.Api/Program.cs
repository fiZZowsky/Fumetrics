using Fumetrics.Api.Hubs;
using Fumetrics.Api.Repositories;
using Fumetrics.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddGrpc();
builder.Services.AddGrpcReflection();
builder.Services.AddSingleton<ClickHouseRepository>();
builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
            builder => builder
                .SetIsOriginAllowed(origin => true)
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials());
});

var app = builder.Build();

var repository = app.Services.GetRequiredService<ClickHouseRepository>();
await repository.EnsureTableExistsAsync();

app.UseCors("AllowAll");

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

app.MapGet("/", () => "Serwer gRPC działa.");

app.Run();