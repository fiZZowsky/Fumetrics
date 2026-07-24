namespace Fumetrics.Api.Models
{
    public class LogTimelineDto
    {
        public string TimeWindow { get; set; } = string.Empty;
        public string Level { get; set; } = string.Empty;
        public int Count { get; set; }
    }
}
