using Fumetrics.Contracts;

namespace Fumetrics.Agent.Services.Interfaces
{
    public interface ISystemService
    {
        Task<ServiceState> GetServiceStateAsync(string serviceName);
        Task<(double Cpu, double Ram, double Disk)> GetHardwareMetricsAsync();
    }
}
