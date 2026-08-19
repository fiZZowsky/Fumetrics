namespace Fumetrics.Api.Contracts;

public record AuditLogRequest(
    string Action,
    string TargetMachine,
    string TargetService
    );