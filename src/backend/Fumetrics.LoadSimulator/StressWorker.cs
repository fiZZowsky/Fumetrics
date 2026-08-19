using System.Diagnostics;

namespace Fumetrics.StressService;

public class StressWorker(IConfiguration configuration, ILogger<StressWorker> logger) : BackgroundService
{
    private readonly List<byte[]> _ramHog = [];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        int targetCpuPercent = configuration.GetValue<int>("LoadConfig:CpuPercent", 5);
        int targetRamMb = configuration.GetValue<int>("LoadConfig:RamMB", 10);
        int maxDiskIoMb = configuration.GetValue<int>("LoadConfig:MaxDiskIoMbPerSec", 50);

        logger.LogInformation("Uruchamianie System Stressor: CPU ~{Cpu}%, RAM = {Ram} MB, Max Disk I/O = {Disk} MB/s",
            targetCpuPercent, targetRamMb, maxDiskIoMb);

        if (targetRamMb > 0)
        {
            try
            {
                byte[] block = new byte[targetRamMb * 1024 * 1024];
                new Random().NextBytes(block);
                _ramHog.Add(block);

                logger.LogInformation("Zarezerwowano pomyślnie {Ram} MB pamięci RAM.", targetRamMb);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Nie udało się zaalokować RAMu.");
            }
        }

        var tasks = new List<Task>();

        int coreCount = Environment.ProcessorCount;
        for (int i = 0; i < coreCount; i++)
        {
            tasks.Add(Task.Run(() => BurnCpu(targetCpuPercent, stoppingToken), stoppingToken));
        }

        if (maxDiskIoMb > 0)
        {
            tasks.Add(Task.Run(() => BurnDisk(maxDiskIoMb, stoppingToken), stoppingToken));
        }

        await Task.WhenAll(tasks);
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

    private async Task BurnDisk(int maxMbPerSec, CancellationToken token)
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"fumetrics_stress_{Guid.NewGuid()}.tmp");
        var random = new Random();
        var buffer = new byte[1024 * 1024];
        random.NextBytes(buffer);

        try
        {
            using var stream = new FileStream(tempFile, FileMode.Create, FileAccess.Write, FileShare.None, buffer.Length, FileOptions.WriteThrough | FileOptions.Asynchronous);

            while (!token.IsCancellationRequested)
            {
                int targetMbThisSecond = random.Next(0, maxMbPerSec + 1);
                var watch = Stopwatch.StartNew();

                stream.Position = 0;

                for (int i = 0; i < targetMbThisSecond; i++)
                {
                    if (token.IsCancellationRequested) break;
                    await stream.WriteAsync(buffer, token);
                }

                await stream.FlushAsync(token);

                watch.Stop();

                int delay = 1000 - (int)watch.ElapsedMilliseconds;
                if (delay > 0)
                {
                    await Task.Delay(delay, token);
                }
            }
        }
        catch (OperationCanceledException) { /* Ignorujemy przerwanie */ }
        catch (Exception ex)
        {
            logger.LogError(ex, "Błąd podczas obciążania dysku.");
        }
        finally
        {
            if (File.Exists(tempFile))
            {
                try { File.Delete(tempFile); } catch { /* Ignore cleanup errors */ }
            }
        }
    }
}