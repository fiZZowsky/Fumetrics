namespace Fumetrics.Api.Contracts;

public record LogEntryDto(
    string Timestamp,
    string ServiceName,
    string Level,
    string Message,
    Dictionary<string, string> Tags
    );