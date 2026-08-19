namespace Fumetrics.Api.Contracts;

public record AuditLogDto(
    string Timestamp,
    string Action,
    string TargetMachine,
    string TargetService,
    string UserIP
    );