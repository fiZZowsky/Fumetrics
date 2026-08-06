using Fumetrics.Agent.Models;
using Fumetrics.Agent.Services.Interfaces;
using Fumetrics.Contracts;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.ServiceProcess;

public class WindowsSystemMonitor : ISystemService
{
    private readonly PerformanceCounter _cpuCounter;
    private readonly PerformanceCounter _ramCounter;
    private readonly PerformanceCounter _diskActivityCounter;
    private readonly long _totalRamMb;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetProcessIoCounters(IntPtr hProcess, out IO_COUNTERS lpIoCounters);

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    private static Dictionary<int, (TimeSpan CpuTime, DateTime LastCheck, ulong IoBytes)> _processTracking = new();

    public WindowsSystemMonitor()
    {
        _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
        _ramCounter = new PerformanceCounter("Memory", "Available MBytes");
        _diskActivityCounter = new PerformanceCounter("PhysicalDisk", "% Disk Time", "_Total");
        _cpuCounter.NextValue();
        _diskActivityCounter.NextValue();

        _totalRamMb = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024 / 1024;
    }

    public Task<List<SystemServiceDetail>> GetAllServicesWithDetailsAsync()
    {
        var list = new List<SystemServiceDetail>();

        foreach (var sc in ServiceController.GetServices())
        {
            int pid = 0;
            double cpu = 0;
            double ram = 0;
            double disk = 0;

            try
            {
                var process = Process.GetProcessesByName(sc.ServiceName).FirstOrDefault();
                if (process != null)
                {
                    pid = process.Id;
                    ram = Math.Round(process.WorkingSet64 / (1024.0 * 1024.0), 2);

                    ulong currentIo = 0;
                    try
                    {
                        if (GetProcessIoCounters(process.Handle, out var ioCounters))
                        {
                            currentIo = ioCounters.ReadTransferCount + ioCounters.WriteTransferCount;
                        }
                    }
                    catch { }

                    var now = DateTime.UtcNow;
                    var cpuTime = process.TotalProcessorTime;

                    if (_processTracking.TryGetValue(pid, out var last))
                    {
                        var timePassed = (now - last.LastCheck).TotalMilliseconds;
                        if (timePassed > 0)
                        {
                            var cpuPassed = (cpuTime - last.CpuTime).TotalMilliseconds;
                            cpu = Math.Round((cpuPassed / (Environment.ProcessorCount * timePassed)) * 100.0, 2);

                            var ioPassed = currentIo - last.IoBytes;
                            var bytesPerSec = ioPassed / (timePassed / 1000.0);
                            disk = Math.Round(bytesPerSec / (1024.0 * 1024.0), 2);
                        }
                    }
                    _processTracking[pid] = (cpuTime, now, currentIo);
                }
            }
            catch { }

            list.Add(new SystemServiceDetail
            {
                ServiceName = sc.ServiceName,
                DisplayName = sc.DisplayName,
                ProcessId = pid,
                State = sc.Status.ToString(),
                CpuUsage = cpu,
                RamUsage = ram,
                DiskUsage = disk
            });
        }

        return Task.FromResult(list.OrderBy(s => s.ServiceName).ToList());
    }

    public Task<List<string>> GetAllSystemServicesAsync()
    {
        try
        {
            var services = ServiceController.GetServices().Select(s => s.ServiceName).OrderBy(s => s).ToList();
            return Task.FromResult(services);
        }
        catch
        {
            return Task.FromResult(new List<string>());
        }
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