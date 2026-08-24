using Fumetrics.Api.Data;
using Fumetrics.Api.Endpoints;
using Fumetrics.Api.Extensions;
using Fumetrics.Api.Hubs;
using Fumetrics.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(5170, listenOptions => listenOptions.Protocols = HttpProtocols.Http1);
    options.ListenAnyIP(50051, listenOptions => listenOptions.Protocols = HttpProtocols.Http2);
});

builder.Services.AddFumetricsInfrastructure(builder.Configuration);
builder.Services.AddGrpc();
builder.Services.AddGrpcReflection();
builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy => policy
        .SetIsOriginAllowed((host) => true)
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials());
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwtSettings = builder.Configuration.GetSection("JwtSettings");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidAudience = jwtSettings["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Secret"]!))
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbInitializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await dbInitializer.InitializeAsync();
}

app.UseRouting();
app.UseCors("CorsPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<TelemetryService>();

app.MapHub<TelemetryHub>("/hubs/telemetry").RequireCors("CorsPolicy");

if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}

app.MapAgentEndpoints();
app.MapAlertEndpoints();
app.MapLogEndpoints();
app.MapAuditEndpoints();
app.MapEmailTemplateEndpoints();
app.MapAuthEndpoints(builder.Configuration);

app.MapGet("/", () => "Serwer API działa (w tym gRPC pod portem 50051).");

app.Run();