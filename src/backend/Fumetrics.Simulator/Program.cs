using Grpc.Net.Client;
using Fumetrics.Contracts;

namespace Fumetrics.DevTools;

class Program
{
    static async Task Main(string[] args)
    {
        Console.Title = "Fumetrics DevTools";
        using var channel = GrpcChannel.ForAddress("http://localhost:50051");
        var client = new TelemetryIngestion.TelemetryIngestionClient(channel);

        while (true)
        {
            Console.Clear();
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("==========================================");
            Console.WriteLine("  🚀 FUMETRICS DEV TOOLS (Symulator) 🚀  ");
            Console.WriteLine("==========================================\n");
            Console.ResetColor();

            Console.WriteLine("Wybierz tryb pracy:");
            Console.WriteLine(" 1. Symulator Logów (Zdarzenia)");
            Console.WriteLine(" 2. Symulator Agentów (Monitorowanie serwerów)");
            Console.WriteLine(" 3. Wyjście\n");
            Console.Write("Twój wybór: ");

            var choice = Console.ReadLine();

            using var cts = new CancellationTokenSource();

            Console.CancelKeyPress += (sender, e) =>
            {
                e.Cancel = true;
                cts.Cancel();
            };

            switch (choice)
            {
                case "1":
                    await RunLogSimulatorAsync(client, cts.Token);
                    break;
                case "2":
                    await RunAgentSimulatorAsync(client, cts.Token);
                    break;
                case "3":
                    Console.WriteLine("Zamykanie...");
                    return;
                default:
                    Console.WriteLine("Nieprawidłowy wybór. Wciśnij Enter...");
                    Console.ReadLine();
                    break;
            }
        }
    }

    private static async Task RunLogSimulatorAsync(TelemetryIngestion.TelemetryIngestionClient client, CancellationToken token)
    {
        Console.Clear();
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("=> Uruchomiono strumień logów. Wciśnij [Ctrl+C], aby zatrzymać.\n");
        Console.ResetColor();

        var random = new Random();
        var services = new[] { "PaymentGateway", "AuthService", "OrderProcessor", "EmailWorker", "DatabaseSync" };
        var levels = new[] { LogLevel.Info, LogLevel.Info, LogLevel.Info, LogLevel.Warning, LogLevel.Error, LogLevel.Critical };

        while (!token.IsCancellationRequested)
        {
            var request = new LogBatchRequest();

            for (int i = 0; i < 25; i++)
            {
                var entry = new LogEntry
                {
                    Timestamp = DateTime.UtcNow.ToString("O"),
                    ServiceName = services[random.Next(services.Length)],
                    Level = levels[random.Next(levels.Length)],
                    Message = $"Automatyczna wiadomość z DevTools [TrxId: {Guid.NewGuid().ToString().Substring(0, 8)}]",
                };
                entry.Tags.Add("Environment", "Simulator");
                request.Logs.Add(entry);
            }

            try
            {
                var response = await client.SendLogsAsync(request, cancellationToken: token);
                Console.WriteLine($"[+] Przesłano paczkę {request.Logs.Count} logów. (ClickHouse przyjął: {response.ProcessedCount})");
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"[-] Błąd gRPC: {ex.Message}");
                Console.ResetColor();
            }

            try { await Task.Delay(1000, token); } catch { /* Zignoruj TaskCanceledException */ }
        }
    }

    private static async Task RunAgentSimulatorAsync(TelemetryIngestion.TelemetryIngestionClient client, CancellationToken token)
    {
        Console.Clear();
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("=> Uruchomiono symulację metryk serwerów. Wciśnij [Ctrl+C], aby zatrzymać.\n");
        Console.ResetColor();

        var random = new Random();
        var machines = new[] { "SIM-WEB-01", "SIM-DB-02", "SIM-CACHE-03" };

        while (!token.IsCancellationRequested)
        {
            foreach (var machine in machines)
            {
                var request = new AgentStatusRequest
                {
                    MachineName = machine,
                    OsVersion = "Windows Server 2022 (Simulator)",
                    CpuUsagePercent = Math.Round(random.NextDouble() * 100, 2),
                    RamUsagePercent = Math.Round(random.NextDouble() * 100, 2),
                    DiskUsagePercent = Math.Round(random.NextDouble() * 100, 2)
                };

                request.Services.Add(new SystemServiceInfo
                {
                    ServiceName = "Nginx",
                    State = random.Next(10) > 8 ? ServiceState.Stopped : ServiceState.Running,
                    CpuUsage = Math.Round(random.NextDouble() * 10, 2),
                    RamUsage = random.Next(100, 500),
                    DiskUsage = Math.Round(random.NextDouble() * 5, 2)
                });

                request.Services.Add(new SystemServiceInfo
                {
                    ServiceName = "PostgreSQL",
                    State = ServiceState.Running,
                    CpuUsage = Math.Round(random.NextDouble() * 40, 2),
                    RamUsage = random.Next(1024, 4096),
                    DiskUsage = Math.Round(random.NextDouble() * 50, 2)
                });

                try
                {
                    await client.SendAgentStatusAsync(request, cancellationToken: token);
                    Console.WriteLine($"[+] Zaktualizowano status maszyny {machine} (Usługi: {request.Services.Count})");
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"[-] Błąd gRPC dla maszyny {machine}: {ex.Message}");
                    Console.ResetColor();
                }
            }

            try { await Task.Delay(3000, token); } catch { /* Zignoruj TaskCanceledException */ }
        }
    }
}