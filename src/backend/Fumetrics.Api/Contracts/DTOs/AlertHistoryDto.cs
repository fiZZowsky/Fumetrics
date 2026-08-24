namespace Fumetrics.Api.Contracts;

public record AlertHistoryDto(
    string Id,
    string Username,
    string RuleId,
    string MachineName,
    string ServiceName,
    string State,
    string Reason,
    DateTime Timestamp
);