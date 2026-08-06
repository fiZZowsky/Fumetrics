using Fumetrics.Agent.Models;
using Fumetrics.Contracts;

namespace Fumetrics.Agent.Services.Interfaces
{
    public interface ISystemService
    {
        Task<List<SystemServiceDetail>> GetAllServicesWithDetailsAsync();
        Task<List<string>> GetAllSystemServicesAsync();
        Task<ServiceState> GetServiceStateAsync(string serviceName);
        Task<(double Cpu, double Ram, double Disk)> GetHardwareMetricsAsync();
    }
}
