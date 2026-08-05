using Fumetrics.Agent.Services.Interfaces;
using Fumetrics.Contracts;
using System.Diagnostics;
using System.ServiceProcess;

public class WindowsSystemMonitor : ISystemService
{
    private readonly PerformanceCounter _cpuCounter;
    private readonly PerformanceCounter _ramCounter;
    private readonly PerformanceCounter _diskActivityCounter;
    private readonly long _totalRamMb;

    public WindowsSystemMonitor()
    {
        _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
        _ramCounter = new PerformanceCounter("Memory", "Available MBytes");
        _diskActivityCounter = new PerformanceCounter("PhysicalDisk", "% Disk Time", "_Total");
        _cpuCounter.NextValue();
        _diskActivityCounter.NextValue();

        _totalRamMb = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024 / 1024;
    }

    public Task<ServiceState> GetServiceStateAsync(string serviceName)
    {
        try
        {
            using var sc = new ServiceController(serviceName);
            var state = sc.Status switch
            {
                ServiceControllerStatus.Running => ServiceState.Running,
                ServiceControllerStatus.Stopped => ServiceState.Stopped,
                ServiceControllerStatus.StartPending => ServiceState.Starting,
                ServiceControllerStatus.StopPending => ServiceState.Stopping,
                _ => ServiceState.Unknown
            };
            return Task.FromResult(state);
        }
        catch
        {
            return Task.FromResult(ServiceState.Failed);
        }
    }

    public Task<(double Cpu, double Ram, double Disk)> GetHardwareMetricsAsync()
    {
        double cpuUsage = Math.Round(_cpuCounter.NextValue(), 2);
        double availableRamMb = _ramCounter.NextValue();
        double ramUsage = _totalRamMb > 0 ? Math.Round(100.0 * (1.0 - (availableRamMb / _totalRamMb)), 2) : 0;
        double diskUsage = Math.Min(100.0, Math.Round(_diskActivityCounter.NextValue(), 2));

        return Task.FromResult((cpuUsage, ramUsage, diskUsage));
    }
}