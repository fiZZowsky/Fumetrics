namespace Fumetrics.Api.Models
{
    public class LatestLogDto
    {
        public string Timestamp { get; set; } = string.Empty;
        public string ServiceName { get; set; } = string.Empty;
        public string Level { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}
