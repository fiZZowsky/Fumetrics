using Fumetrics.Agent.Services.Interfaces;
using Fumetrics.Contracts;
using Grpc.Net.Client;

namespace Fumetrics.Agent;

public class AgentWorker : BackgroundService
{
    private readonly ISystemService _systemMonitor;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AgentWorker> _logger;

    public AgentWorker(ISystemService systemMonitor, IConfiguration configuration, ILogger<AgentWorker> logger)
    {
        _systemMonitor = systemMonitor;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var backendUrl = _configuration["Fumetrics:BackendUrl"] ?? "http://localhost:5241";
        using var channel = GrpcChannel.ForAddress(backendUrl);
        var client = new TelemetryIngestion.TelemetryIngestionClient(channel);

        var machineName = Environment.MachineName;
        var osVersion = Environment.OSVersion.ToString();

        _logger.LogInformation("Fumetrics Agent uruchomiony na {MachineName} ({OS}). Łączenie z: {Backend}", machineName, osVersion, backendUrl);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var servicesToMonitor = _configuration.GetSection("Fumetrics:MonitoredServices").Get<string[]>() ?? Array.Empty<string>();
                var hwMetrics = await _systemMonitor.GetHardwareMetricsAsync();

                var request = new AgentStatusRequest
                {
                    MachineName = machineName,
                    OsVersion = osVersion,
                    CpuUsagePercent = hwMetrics.Cpu,
                    RamUsagePercent = hwMetrics.Ram,
                    DiskUsagePercent = hwMetrics.Disk
                };

                foreach (var serviceName in servicesToMonitor)
                {
                    var state = await _systemMonitor.GetServiceStateAsync(serviceName);

                    request.Services.Add(new SystemServiceInfo
                    {
                        ServiceName = serviceName,
                        State = state,
                        CpuUsagePercent = 0,
                        MemoryUsageBytes = 0
                    });
                }

                if (request.Services.Count > 0)
                {
                    var response = await client.SendAgentStatusAsync(request, cancellationToken: stoppingToken);
                    _logger.LogInformation("Pomyślnie wysłano status {Count} usług do centrali.", request.Services.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Błąd połączenia z backendem Fumetrics: {Message}", ex.Message);
            }

            await Task.Delay(10000, stoppingToken);
        }
    }
}