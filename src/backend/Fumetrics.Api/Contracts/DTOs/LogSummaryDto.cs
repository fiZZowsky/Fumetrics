namespace Fumetrics.Api.Contracts;

public record LogSummaryDto(
    string ServiceName, 
    string Level, 
    long Count
    );
