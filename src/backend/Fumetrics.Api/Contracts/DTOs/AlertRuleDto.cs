namespace Fumetrics.Api.Contracts;

public record AlertRuleDto(
    string Id, 
    string MachineName, 
    string ServiceName, 
    string Metric,
    string Threshold, 
    string Email, 
    int DelayMinutes, 
    int RepeatMinutes,
    string HtmlTemplate
    );
