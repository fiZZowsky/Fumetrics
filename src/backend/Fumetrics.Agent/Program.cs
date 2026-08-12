using Fumetrics.Agent;
using Fumetrics.Agent.Services.Interfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

var builder = Microsoft.AspNetCore.Builder.WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ISystemService, WindowsSystemMonitor>();
builder.Services.AddHostedService<AgentWorker>();
builder.Services.AddHostedService<Fumetrics.Agent.Services.EventLogMonitor>();

builder.Services.AddCors(options =>
    options.AddPolicy("AllowAll", p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader())
);

var app = builder.Build();

app.UseCors("AllowAll");

app.MapGet("/api/agent/services", async (ISystemService systemMonitor) =>
{
    if (systemMonitor is WindowsSystemMonitor winMonitor)
    {
        var services = await winMonitor.GetAllServicesWithDetailsAsync();
        return Results.Ok(services);
    }
    return Results.BadRequest("Nieobsługiwany system operacyjny.");
});

app.MapPost("/api/agent/services/{serviceName}/start", async (string serviceName, ISystemService systemMonitor) =>
{
    var success = await systemMonitor.StartServiceAsync(serviceName);
    return success ? Results.Ok(new { success = true }) : Results.Problem("Nie udało się uruchomić usługi. Brak uprawnień lub usługa już działa.");
});

app.MapPost("/api/agent/services/{serviceName}/stop", async (string serviceName, ISystemService systemMonitor) =>
{
    var success = await systemMonitor.StopServiceAsync(serviceName);
    return success ? Results.Ok(new { success = true }) : Results.Problem("Nie udało się zatrzymać usługi. Brak uprawnień lub usługa jest już zatrzymana.");
});

app.MapPost("/api/agent/services/{serviceName}/restart", async (string serviceName, ISystemService systemMonitor) =>
{
    var success = await systemMonitor.RestartServiceAsync(serviceName);
    return success ? Results.Ok(new { success = true }) : Results.Problem("Nie udało się zrestartować usługi. Brak uprawnień.");
});

app.Run("http://0.0.0.0:5001");