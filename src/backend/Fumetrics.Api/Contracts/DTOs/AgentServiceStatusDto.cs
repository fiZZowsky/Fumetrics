namespace Fumetrics.Api.Contracts;

public record AgentServiceStatusDto(
    string MachineName, 
    string OsVersion, 
    string ServiceName, 
    string State,
    string LastUpdated, 
    double MachineCpu, 
    double MachineRam, 
    double MachineDisk,
    double ServiceCpu, 
    double ServiceRam, 
    double ServiceDisk
    );
