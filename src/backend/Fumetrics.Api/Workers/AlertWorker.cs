using Fumetrics.Api.Services;

namespace Fumetrics.Api.Workers;

public class AlertWorker(IServiceProvider serviceProvider, IConfiguration configuration, ILogger<AlertWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        int intervalSeconds = configuration.GetValue<int>("Alerting:CheckIntervalSeconds", 11);

        logger.LogInformation("Fumetrics Alert Worker uruchomiony. Interwał sprawdzania: {Interval}s.", intervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                var evaluator = scope.ServiceProvider.GetRequiredService<AlertEvaluatorService>();
                await evaluator.ProcessAlertsAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Błąd w workerze alertów.");
            }

            await Task.Delay(TimeSpan.FromSeconds(intervalSeconds), stoppingToken);
        }
    }
}