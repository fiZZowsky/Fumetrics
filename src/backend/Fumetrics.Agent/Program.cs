using Fumetrics.Agent;
using Fumetrics.Agent.Services.Interfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

var builder = Microsoft.AspNetCore.Builder.WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ISystemService, WindowsSystemMonitor>();
builder.Services.AddHostedService<AgentWorker>();

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

app.Run("http://0.0.0.0:5001");