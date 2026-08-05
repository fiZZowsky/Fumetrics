namespace Fumetrics.Api.Models
{
    public class AgentHardwareHistoryDto
    {
        public string Timestamp { get; set; } = string.Empty;
        public double Cpu { get; set; }
        public double Ram { get; set; }
        public double Disk { get; set; }
    }
}
