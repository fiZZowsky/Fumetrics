using Fumetrics.Agent.Services.Interfaces;
using Fumetrics.Contracts;
using Grpc.Net.Client;
using System.Net.Http.Json;

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
        var backendUrl = _configuration["Fumetrics:BackendUrl"] ?? "http://localhost:5170";
        var grpcUrl = _configuration["Fumetrics:GrpcUrl"] ?? "http://localhost:50051";

        var machineName = Environment.MachineName;
        var osVersion = Environment.OSVersion.ToString();

        _logger.LogInformation("Fumetrics Agent uruchomiony na {MachineName} ({OS}). Zwykłe API: {Backend}, gRPC: {Grpc}", machineName, osVersion, backendUrl, grpcUrl);

        using var channel = GrpcChannel.ForAddress(grpcUrl);
        var grpcClient = new TelemetryIngestion.TelemetryIngestionClient(channel);

        using var httpClient = new HttpClient();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var serviceNames = await httpClient.GetFromJsonAsync<string[]>(
                    $"{backendUrl}/api/metrics/agents/{machineName}/config-services",
                    stoppingToken) ?? new[] { "Spooler" };

                var hwMetrics = await _systemMonitor.GetHardwareMetricsAsync();
                var allServices = await _systemMonitor.GetAllServicesWithDetailsAsync();

                var request = new AgentStatusRequest
                {
                    MachineName = machineName,
                    OsVersion = osVersion,
                    CpuUsagePercent = hwMetrics.Cpu,
                    RamUsagePercent = hwMetrics.Ram,
                    DiskUsagePercent = hwMetrics.Disk
                };

                if (serviceNames.Contains("*"))
                {
                    request.Services.Add(new SystemServiceInfo
                    {
                        ServiceName = "*",
                        State = ServiceState.Running,
                        CpuUsage = 0,
                        RamUsage = 0,
                        DiskUsage = 0
                    });
                }

                foreach (var serviceName in serviceNames.Where(s => s != "*"))
                {
                    var srv = allServices.FirstOrDefault(s => s.ServiceName.Equals(serviceName, StringComparison.OrdinalIgnoreCase));
                    if (srv != null)
                    {
                        var mappedState = srv.State switch
                        {
                            "Running" => ServiceState.Running,
                            "Stopped" => ServiceState.Stopped,
                            "StartPending" => ServiceState.Starting,
                            "StopPending" => ServiceState.Stopping,
                            _ => ServiceState.Unknown
                        };

                        request.Services.Add(new SystemServiceInfo
                        {
                            ServiceName = srv.ServiceName,
                            State = mappedState,
                            CpuUsage = srv.CpuUsage,
                            RamUsage = srv.RamUsage,
                            DiskUsage = srv.DiskUsage
                        });
                    }
                    else
                    {
                        request.Services.Add(new SystemServiceInfo
                        {
                            ServiceName = serviceName,
                            State = ServiceState.Unknown,
                            CpuUsage = 0,
                            RamUsage = 0,
                            DiskUsage = 0
                        });
                    }
                }

                if (request.Services.Count > 0)
                {
                    await grpcClient.SendAgentStatusAsync(request, cancellationToken: stoppingToken);
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