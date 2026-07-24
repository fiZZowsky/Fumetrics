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
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

var repository = app.Services.GetRequiredService<ClickHouseRepository>();
await repository.EnsureTableExistsAsync();

app.UseCors("AllowFrontend");

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

app.MapGet("/", () => "Serwer gRPC działa.");

app.Run();