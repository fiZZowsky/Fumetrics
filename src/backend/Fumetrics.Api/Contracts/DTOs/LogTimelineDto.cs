namespace Fumetrics.Api.Contracts;

public record LogTimelineDto(
    string TimeWindow, 
    string Level, 
    int Count
    );
