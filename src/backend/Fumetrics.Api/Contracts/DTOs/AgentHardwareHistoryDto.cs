namespace Fumetrics.Api.Contracts;

public record AgentHardwareHistoryDto(
    string Timestamp,
    double Cpu,
    double Ram,
    double Disk
    );
