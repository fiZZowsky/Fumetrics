namespace Fumetrics.Api.Contracts;

public record LatestLogDto(
    string Timestamp, 
    string ServiceName,
    string Level, 
    string Message
    );
