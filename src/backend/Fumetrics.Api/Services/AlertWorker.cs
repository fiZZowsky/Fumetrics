using System.Net;
using System.Net.Mail;
using Fumetrics.Api.Repositories;

namespace Fumetrics.Api.Services;

public class AlertWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AlertWorker> _logger;

    public AlertWorker(IServiceProvider serviceProvider, IConfiguration configuration, ILogger<AlertWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Fumetrics Alert Worker uruchomiony.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<ClickHouseRepository>();

                var rules = (await repo.GetAlertRulesAsync()).ToList();
                if (rules.Any())
                {
                    var latestMetrics = (await repo.GetLatestAgentStatusAsync()).ToList();

                    foreach (var rule in rules)
                    {
                        var metric = latestMetrics.FirstOrDefault(m => m.MachineName == rule.MachineName && m.ServiceName == rule.ServiceName);
                        if (metric == null) continue;

                        bool isTriggered = false;
                        string alertMessage = "";

                        if (rule.Metric == "State" && metric.State.ToUpper() == rule.Threshold.ToUpper())
                        {
                            isTriggered = true;
                            alertMessage = $"Usługa {rule.ServiceName} na serwerze {rule.MachineName} zmieniła stan na {metric.State}!";
                        }
                        else if (rule.Metric == "ServiceCpu" && double.TryParse(rule.Threshold, out double cpuThreshold) && metric.ServiceCpu >= cpuThreshold)
                        {
                            isTriggered = true;
                            alertMessage = $"Usługa {rule.ServiceName} ({rule.MachineName}) przekroczyła próg CPU: {metric.ServiceCpu}% (Limit: {cpuThreshold}%)";
                        }
                        else if (rule.Metric == "ServiceRam" && double.TryParse(rule.Threshold, out double ramThreshold) && metric.ServiceRam >= ramThreshold)
                        {
                            isTriggered = true;
                            alertMessage = $"Usługa {rule.ServiceName} ({rule.MachineName}) przekroczyła próg RAM: {metric.ServiceRam} MB (Limit: {ramThreshold} MB)";
                        }

                        if (isTriggered)
                        {
                            var lastSent = await repo.GetLastAlertTimeAsync(rule.Id);
                            if (lastSent == null || (DateTime.UtcNow - lastSent.Value).TotalMinutes >= rule.CooldownMinutes)
                            {
                                await SendEmailAsync(rule.Email, "Fumetrics Alert - " + rule.ServiceName, alertMessage);
                                await repo.LogAlertSentAsync(rule.Id);
                                _logger.LogWarning("Wysłano alert dla reguły {RuleId} na email {Email}", rule.Id, rule.Email);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Błąd w workerze alertów.");
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        try
        {
            var host = _configuration["Smtp:Host"];
            var port = _configuration.GetValue<int>("Smtp:Port", 587);
            var user = _configuration["Smtp:Username"];
            var pass = _configuration["Smtp:Password"];
            var from = _configuration["Smtp:From"];

            if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(user)) return;

            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(user, pass),
                EnableSsl = true
            };

            var mailMessage = new MailMessage(from!, toEmail, subject, body);
            await client.SendMailAsync(mailMessage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Błąd wysyłki e-mail.");
        }
    }
}