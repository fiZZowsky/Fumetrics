namespace Fumetrics.Api.Contracts;

public record SavedServerDto(
    string MachineName, 
    string IpAddress, 
    string Port
    );
