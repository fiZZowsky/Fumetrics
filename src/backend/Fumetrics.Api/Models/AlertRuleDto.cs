namespace Fumetrics.Api.Models
{
    public class AlertRuleDto
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string MachineName { get; set; } = string.Empty;
        public string ServiceName { get; set; } = string.Empty;
        public string Metric { get; set; } = string.Empty;
        public string Threshold { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int CooldownMinutes { get; set; } = 15;
    }
}
