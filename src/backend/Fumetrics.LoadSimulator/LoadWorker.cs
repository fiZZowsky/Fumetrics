using System.Diagnostics;

namespace Fumetrics.LoadSimulator;

public class LoadWorker : BackgroundService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<LoadWorker> _logger;
    private readonly List<byte[]> _ramHog = new();

    public LoadWorker(IConfiguration configuration, ILogger<LoadWorker> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        int targetCpuPercent = _configuration.GetValue<int>("LoadConfig:CpuPercent", 5);
        int targetRamMb = _configuration.GetValue<int>("LoadConfig:RamMB", 10);

        _logger.LogInformation("Uruchamianie symulatora: CPU ~{Cpu}%, RAM = {Ram} MB", targetCpuPercent, targetRamMb);

        if (targetRamMb > 0)
        {
            try
            {
                byte[] block = new byte[targetRamMb * 1024 * 1024];
                new Random().NextBytes(block);
                _ramHog.Add(block);

                _logger.LogInformation("Zarezerwowano pomyślnie {Ram} MB pamięci RAM.", targetRamMb);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Nie udało się zaalokować RAMu.");
            }
        }

        int coreCount = Environment.ProcessorCount;
        var cpuTasks = new List<Task>();

        for (int i = 0; i < coreCount; i++)
        {
            cpuTasks.Add(Task.Run(() => BurnCpu(targetCpuPercent, stoppingToken), stoppingToken));
        }

        await Task.WhenAll(cpuTasks);
    }

    private void BurnCpu(int targetCpuPercent, CancellationToken token)
    {
        if (targetCpuPercent <= 0) return;
        targetCpuPercent = Math.Clamp(targetCpuPercent, 1, 100);

        var watch = new Stopwatch();
        var random = new Random();

        while (!token.IsCancellationRequested)
        {
            watch.Restart();

            while (watch.ElapsedMilliseconds < targetCpuPercent)
            {
                double a = Math.Sqrt(random.NextDouble());
            }

            int sleepTime = 100 - targetCpuPercent;
            if (sleepTime > 0)
            {
                Thread.Sleep(sleepTime);
            }
        }
    }
}