using System;
using System.Threading.Tasks;
using Grpc.Net.Client;
using Fumetrics.Contracts;

namespace Fumetrics.Simulator;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("🚀 Startuję Symulator Ruchu Fumetrics...");

        using var channel = GrpcChannel.ForAddress("https://localhost:7161");
        var client = new TelemetryIngestion.TelemetryIngestionClient(channel);

        var random = new Random();
        var services = new[] { "PaymentService", "AuthService", "OrderService", "EmailService", "InventoryService" };

        var levels = new[] { LogLevel.Info, LogLevel.Info, LogLevel.Info, LogLevel.Warning, LogLevel.Error, LogLevel.Critical };

        Console.WriteLine("Wysyłam pakiety logów. Wciśnij Ctrl+C aby zatrzymać.\n");

        while (true)
        {
            var request = new LogBatchRequest();

            for (int i = 0; i < 50; i++)
            {
                var entry = new LogEntry
                {
                    Timestamp = DateTime.UtcNow.ToString("O"),
                    ServiceName = services[random.Next(services.Length)],
                    Level = levels[random.Next(levels.Length)],
                    Message = $"Automatyczna wiadomość testowa nr {random.Next(1000, 9999)}",
                };
                entry.Tags.Add("Environment", "Production");

                request.Logs.Add(entry);
            }

            try
            {
                var response = await client.SendLogsAsync(request);
                Console.WriteLine($"[+] Wysłano 50 logów. Przetworzono w ClickHouse: {response.ProcessedCount}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[-] Błąd wysyłania: {ex.Message}");
            }

            await Task.Delay(500);
        }
    }
}