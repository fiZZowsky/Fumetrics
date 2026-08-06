namespace Fumetrics.Agent.Models
{
    public class SystemServiceDetail
    {
        public string ServiceName { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public int ProcessId { get; set; }
        public string State { get; set; } = string.Empty;
        public double CpuUsage { get; set; }
        public double RamUsage { get; set; }
        public double DiskUsage { get; set; }
    }
}
