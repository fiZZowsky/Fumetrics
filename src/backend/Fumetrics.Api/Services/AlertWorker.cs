using System.Net;
using System.Net.Mail;
using Fumetrics.Api.Repositories;
using Fumetrics.Api.Models;

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
                        var machineMetrics = latestMetrics.Where(m => m.MachineName == rule.MachineName).ToList();
                        if (!machineMetrics.Any()) continue;

                        bool isMachineLevel = rule.ServiceName == "*";

                        var metric = isMachineLevel
                            ? machineMetrics.First()
                            : machineMetrics.FirstOrDefault(m => m.ServiceName == rule.ServiceName);

                        if (metric == null) continue;

                        bool isTriggered = false;
                        string triggerReason = "";
                        string currentValue = "";
                        string thresholdValue = "";

                        if (!isMachineLevel)
                        {
                            if (rule.Metric == "State" && metric.State.ToUpper() == rule.Threshold.ToUpper())
                            {
                                isTriggered = true; triggerReason = "Zmiana statusu usługi"; currentValue = metric.State; thresholdValue = rule.Threshold;
                            }
                            else if (rule.Metric == "ServiceCpu" && double.TryParse(rule.Threshold, out double cpuThreshold) && metric.ServiceCpu >= cpuThreshold)
                            {
                                isTriggered = true; triggerReason = "Wysokie obciążenie CPU usługi"; currentValue = $"{metric.ServiceCpu}%"; thresholdValue = $"{cpuThreshold}%";
                            }
                            else if (rule.Metric == "ServiceRam" && double.TryParse(rule.Threshold, out double ramThreshold) && metric.ServiceRam >= ramThreshold)
                            {
                                isTriggered = true; triggerReason = "Wysokie zużycie RAM usługi"; currentValue = $"{metric.ServiceRam} MB"; thresholdValue = $"{ramThreshold} MB";
                            }
                            else if (rule.Metric == "ServiceDisk" && double.TryParse(rule.Threshold, out double diskThreshold) && metric.ServiceDisk >= diskThreshold)
                            {
                                isTriggered = true; triggerReason = "Wysokie zużycie Dysku (I/O) usługi"; currentValue = $"{metric.ServiceDisk} MB/s"; thresholdValue = $"{diskThreshold} MB/s";
                            }
                        }
                        else
                        {
                            if (rule.Metric == "MachineCpu" && double.TryParse(rule.Threshold, out double mCpuThreshold) && metric.MachineCpu >= mCpuThreshold)
                            {
                                isTriggered = true; triggerReason = "Przeciążenie CPU serwera"; currentValue = $"{metric.MachineCpu}%"; thresholdValue = $"{mCpuThreshold}%";
                            }
                            else if (rule.Metric == "MachineRam" && double.TryParse(rule.Threshold, out double mRamThreshold) && metric.MachineRam >= mRamThreshold)
                            {
                                isTriggered = true; triggerReason = "Brak pamięci RAM na serwerze"; currentValue = $"{metric.MachineRam}%"; thresholdValue = $"{mRamThreshold}%";
                            }
                            else if (rule.Metric == "MachineDisk" && double.TryParse(rule.Threshold, out double mDiskThreshold) && metric.MachineDisk >= mDiskThreshold)
                            {
                                isTriggered = true; triggerReason = "Przeciążenie dysku serwera (100% użycia)"; currentValue = $"{metric.MachineDisk}%"; thresholdValue = $"{mDiskThreshold}%";
                            }
                        }

                        if (isTriggered)
                        {
                            var lastSent = await repo.GetLastAlertTimeAsync(rule.Id);
                            if (lastSent == null || (DateTime.UtcNow - lastSent.Value).TotalMinutes >= rule.CooldownMinutes)
                            {
                                string targetName = isMachineLevel ? "CAŁY SERWER" : rule.ServiceName;
                                string subject = $"[FUMETRICS] Alert: {targetName} na {rule.MachineName}";
                                string htmlBody = BuildHtmlEmail(rule, metric, triggerReason, currentValue, thresholdValue, isMachineLevel);

                                await SendEmailAsync(rule.Email, subject, htmlBody);
                                await repo.LogAlertSentAsync(rule.Id);
                                _logger.LogWarning("Wysłano alert dla reguły {RuleId} ({Target}) na {Email}", rule.Id, targetName, rule.Email);
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

    private string BuildHtmlEmail(AlertRuleDto rule, dynamic metric, string reason, string current, string threshold, bool isMachineLevel)
    {
        string serviceDetailsHtml = isMachineLevel ? "" : $@"
            <div style='margin-top: 15px; border-top: 1px solid #334155; padding-top: 10px;'>
                <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>Stan Usługi:</strong> <span style='color: #10b981;'>{metric.State}</span></div>
                <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>CPU Usługi:</strong> {metric.ServiceCpu}%</div>
                <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>RAM Usługi:</strong> {metric.ServiceRam} MB</div>
                <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>Dysk Usługi:</strong> {metric.ServiceDisk} MB/s</div>
            </div>";

        string targetLabel = isMachineLevel ? "Cel (Cała maszyna):" : "Usługa:";
        string targetValue = isMachineLevel ? "Wszystkie usługi" : rule.ServiceName;

        return $@"
        <div style='font-family: ""Segoe UI"", Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #334155; border-radius: 8px; overflow: hidden; background-color: #0f172a; color: #f8fafc;'>
            <div style='background-color: #1e293b; padding: 20px; text-align: center; border-bottom: 2px solid #ef4444;'>
                <h2 style='color: #ef4444; margin: 0; letter-spacing: 2px;'>🚨 FUMETRICS ALERT</h2>
                <p style='color: #94a3b8; font-size: 12px; margin-top: 5px;'>System monitorowania wykrył anomalię</p>
            </div>
            <div style='padding: 24px;'>
                <h3 style='color: #38bdf8; margin-top: 0;'>Szczegóły zdarzenia</h3>
                <table style='width: 100%; border-collapse: collapse; margin-bottom: 20px;'>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8; width: 40%;'>Serwer:</td>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold;'>{rule.MachineName}</td>
                    </tr>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>{targetLabel}</td>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold;'>{targetValue}</td>
                    </tr>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>Wyzwalacz:</td>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold; color: #fbbf24;'>{reason}</td>
                    </tr>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>Zarejestrowana wartość:</td>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold; color: #ef4444;'>{current}</td>
                    </tr>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>Ustawiony próg (Limit):</td>
                        <td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold;'>{threshold}</td>
                    </tr>
                </table>
                <h3 style='color: #38bdf8; margin-top: 30px;'>Kondycja serwera w momencie alertu</h3>
                <div style='background-color: #1e293b; padding: 15px; border-radius: 6px; font-size: 13px;'>
                    <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>CPU Serwera:</strong> {metric.MachineCpu}%</div>
                    <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>RAM Serwera:</strong> {metric.MachineRam}%</div>
                    <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>Dysk Serwera:</strong> {metric.MachineDisk}%</div>
                    {serviceDetailsHtml}
                    <div style='margin-top: 15px; border-top: 1px solid #334155; padding-top: 10px;'><strong style='color:#94a3b8;'>System Operacyjny:</strong> {metric.OsVersion}</div>
                    <div><strong style='color:#94a3b8;'>Czas pomiaru (UTC):</strong> {metric.LastUpdated}</div>
                </div>
            </div>
            <div style='background-color: #020617; padding: 15px; text-align: center; font-size: 11px; color: #64748b;'>
                Wiadomość wygenerowana automatycznie przez platformę Fumetrics.<br/>
                Kolejny e-mail dla tej reguły może zostać wysłany najwcześniej za {rule.CooldownMinutes} minut.
            </div>
        </div>";
    }

    private async Task SendEmailAsync(string toEmails, string subject, string body)
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

            var mailMessage = new MailMessage();
            mailMessage.From = new MailAddress(from!);
            mailMessage.Subject = subject;
            mailMessage.Body = body;
            mailMessage.IsBodyHtml = true;

            var emails = toEmails.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var email in emails)
            {
                if (MailAddress.TryCreate(email.Trim(), out var address))
                {
                    mailMessage.To.Add(address);
                }
            }

            if (mailMessage.To.Count == 0) return;

            await client.SendMailAsync(mailMessage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Błąd wysyłki e-mail.");
        }
    }
}