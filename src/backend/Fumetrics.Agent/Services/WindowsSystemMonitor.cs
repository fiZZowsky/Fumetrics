using Fumetrics.Agent.Models;
using Fumetrics.Agent.Services.Interfaces;
using Fumetrics.Contracts;
using System.Diagnostics;
using System.Management;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.ServiceProcess;

[SupportedOSPlatform("windows")]
public class WindowsSystemMonitor : ISystemService
{
    private readonly PerformanceCounter _cpuCounter;
    private readonly PerformanceCounter _diskActivityCounter;

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

    [StructLayout(LayoutKind.Sequential)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

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
        _diskActivityCounter = new PerformanceCounter("PhysicalDisk", "% Disk Time", "_Total");
        _cpuCounter.NextValue();
        _diskActivityCounter.NextValue();
    }

    public async Task<bool> StartServiceAsync(string serviceName)
    {
        try
        {
            using var sc = new ServiceController(serviceName);
            if (sc.Status == ServiceControllerStatus.Stopped)
            {
                sc.Start();
                sc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(10));
                return true;
            }
            return false;
        }
        catch { return false; }
    }

    public async Task<bool> StopServiceAsync(string serviceName)
    {
        try
        {
            using var sc = new ServiceController(serviceName);
            if (sc.Status == ServiceControllerStatus.Running)
            {
                sc.Stop();
                sc.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(10));
                return true;
            }
            return false;
        }
        catch { return false; }
    }

    public async Task<bool> RestartServiceAsync(string serviceName)
    {
        try
        {
            using var sc = new ServiceController(serviceName);
            if (sc.Status == ServiceControllerStatus.Running)
            {
                sc.Stop();
                sc.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(10));
            }
            sc.Start();
            sc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(10));
            return true;
        }
        catch { return false; }
    }

    public Task<List<SystemServiceDetail>> GetAllServicesWithDetailsAsync()
    {
        var list = new List<SystemServiceDetail>();
        var servicePids = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT Name, ProcessId FROM Win32_Service");
            foreach (ManagementObject obj in searcher.Get())
            {
                var name = obj["Name"]?.ToString();
                if (name != null && int.TryParse(obj["ProcessId"]?.ToString(), out int p))
                {
                    servicePids[name] = p;
                }
            }
        }
        catch (Exception ex) { }

        foreach (var sc in ServiceController.GetServices())
        {
            double cpu = 0;
            double ram = 0;
            double disk = 0;

            servicePids.TryGetValue(sc.ServiceName, out int pid);

            if (pid > 0)
            {
                try
                {
                    var process = Process.GetProcessById(pid);
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
                catch (Exception ex) { }
            }

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
        try { return Task.FromResult(ServiceController.GetServices().Select(s => s.ServiceName).OrderBy(s => s).ToList()); }
        catch { return Task.FromResult(new List<string>()); }
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
        catch { return Task.FromResult(ServiceState.Failed); }
    }

    public Task<(double Cpu, double Ram, double Disk)> GetHardwareMetricsAsync()
    {
        double cpuUsage = Math.Round(_cpuCounter.NextValue(), 2);

        double ramUsage = 0;
        MEMORYSTATUSEX memStatus = new MEMORYSTATUSEX();
        memStatus.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));

        if (GlobalMemoryStatusEx(ref memStatus))
        {
            ramUsage = Math.Round(100.0 * (memStatus.ullTotalPhys - memStatus.ullAvailPhys) / memStatus.ullTotalPhys, 2);
        }

        double diskUsage = Math.Min(100.0, Math.Round(_diskActivityCounter.NextValue(), 2));

        return Task.FromResult((cpuUsage, ramUsage, diskUsage));
    }
}