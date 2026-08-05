namespace Fumetrics.Api.Models
{
    public class AgentServiceStatusDto
    {
        public string MachineName { get; set; } = string.Empty;
        public string OsVersion { get; set; } = string.Empty;
        public string ServiceName { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string LastUpdated { get; set; } = string.Empty;

        public double MachineCpu { get; set; }
        public double MachineRam { get; set; }
        public double MachineDisk { get; set; }
    }
}
