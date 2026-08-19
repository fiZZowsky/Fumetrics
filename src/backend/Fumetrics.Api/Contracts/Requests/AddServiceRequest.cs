namespace Fumetrics.Api.Contracts;

public record AddServiceRequest(
    string MachineName,
    string ServiceName
    );