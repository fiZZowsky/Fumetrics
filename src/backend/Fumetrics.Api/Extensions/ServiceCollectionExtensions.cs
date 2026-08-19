using Fumetrics.Api.Configuration;
using Fumetrics.Api.Data;
using Fumetrics.Api.Repositories;
using Fumetrics.Api.Services;
using Fumetrics.Api.Workers;

namespace Fumetrics.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddFumetricsInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<SmtpOptions>(config.GetSection(SmtpOptions.SectionName));

        services.AddSingleton<ClickHouseConnectionFactory>();
        services.AddScoped<DatabaseInitializer>();

        services.AddScoped<LogRepository>();
        services.AddScoped<AgentRepository>();
        services.AddScoped<AlertRepository>();
        services.AddScoped<AuditRepository>();

        services.AddScoped<EmailService>();
        services.AddSingleton<AlertStateManager>();
        services.AddScoped<AlertEvaluatorService>();

        services.AddHostedService<AlertWorker>();

        return services;
    }
}