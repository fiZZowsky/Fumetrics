using Fumetrics.Api.Services;

namespace Fumetrics.Api.Workers;

public class AlertWorker(IServiceProvider serviceProvider, ILogger<AlertWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Fumetrics Alert Worker uruchomiony.");
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
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }
}