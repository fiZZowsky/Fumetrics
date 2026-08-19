using Fumetrics.Api.Contracts;
using Fumetrics.Api.Repositories;

namespace Fumetrics.Api.Services;

public class AlertEvaluatorService(AgentRepository agentRepo, AlertRepository alertRepo, EmailService emailService, ILogger<AlertEvaluatorService> logger)
{
    public async Task ProcessAlertsAsync()
    {
        var rules = await alertRepo.GetAllAsync();
        if (!rules.Any()) return;

        var latestMetrics = (await agentRepo.GetLatestStatusAsync()).ToList();

        foreach (var rule in rules)
        {
            var machineMetrics = latestMetrics.Where(m => m.MachineName == rule.MachineName).ToList();
            if (!machineMetrics.Any()) continue;

            bool isMachineLevel = rule.ServiceName == "*";
            var metric = isMachineLevel ? machineMetrics.First() : machineMetrics.FirstOrDefault(m => m.ServiceName == rule.ServiceName);

            if (metric == null) continue;

            if (EvaluateRule(rule, metric, out var reason, out var currentVal))
            {
                var lastSent = await alertRepo.GetLastSentTimeAsync(rule.Id);
                if (lastSent == null || (DateTime.UtcNow - lastSent.Value).TotalMinutes >= rule.CooldownMinutes)
                {
                    string targetName = isMachineLevel ? "CAŁY SERWER" : rule.ServiceName;
                    string subject = $"[FUMETRICS] Alert: {targetName} na {rule.MachineName}";
                    string htmlBody = BuildHtmlEmail(rule, metric, reason, currentVal, rule.Threshold, isMachineLevel);

                    await emailService.SendEmailAsync(rule.Email, subject, htmlBody);
                    await alertRepo.LogSentAsync(rule.Id);
                    logger.LogWarning("Wysłano alert dla reguły {RuleId} ({Target}) na {Email}", rule.Id, targetName, rule.Email);
                }
            }
        }
    }

    private bool EvaluateRule(AlertRuleDto rule, AgentServiceStatusDto metric, out string reason, out string current)
    {
        reason = current = string.Empty;
        bool isMachineLevel = rule.ServiceName == "*";

        if (!isMachineLevel)
        {
            if (rule.Metric == "State" && metric.State.Equals(rule.Threshold, StringComparison.OrdinalIgnoreCase))
            {
                reason = "Zmiana statusu usługi"; current = metric.State; return true;
            }
            if (rule.Metric == "ServiceCpu" && double.TryParse(rule.Threshold, out double c) && metric.ServiceCpu >= c)
            {
                reason = "Wysokie obciążenie CPU usługi"; current = $"{metric.ServiceCpu}%"; return true;
            }
            if (rule.Metric == "ServiceRam" && double.TryParse(rule.Threshold, out double r) && metric.ServiceRam >= r)
            {
                reason = "Wysokie zużycie RAM usługi"; current = $"{metric.ServiceRam} MB"; return true;
            }
            if (rule.Metric == "ServiceDisk" && double.TryParse(rule.Threshold, out double d) && metric.ServiceDisk >= d)
            {
                reason = "Wysokie zużycie Dysku (I/O) usługi"; current = $"{metric.ServiceDisk} MB/s"; return true;
            }
        }
        else
        {
            if (rule.Metric == "MachineCpu" && double.TryParse(rule.Threshold, out double mc) && metric.MachineCpu >= mc)
            {
                reason = "Przeciążenie CPU serwera"; current = $"{metric.MachineCpu}%"; return true;
            }
            if (rule.Metric == "MachineRam" && double.TryParse(rule.Threshold, out double mr) && metric.MachineRam >= mr)
            {
                reason = "Brak pamięci RAM na serwerze"; current = $"{metric.MachineRam}%"; return true;
            }
            if (rule.Metric == "MachineDisk" && double.TryParse(rule.Threshold, out double md) && metric.MachineDisk >= md)
            {
                reason = "Przeciążenie dysku serwera (100% użycia)"; current = $"{metric.MachineDisk}%"; return true;
            }
        }
        return false;
    }

    private string BuildHtmlEmail(AlertRuleDto rule, AgentServiceStatusDto metric, string reason, string current, string threshold, bool isMachineLevel)
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
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8; width: 40%;'>Serwer:</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold;'>{rule.MachineName}</td></tr>
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>{targetLabel}</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold;'>{targetValue}</td></tr>
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>Wyzwalacz:</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold; color: #fbbf24;'>{reason}</td></tr>
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>Zarejestrowana wartość:</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold; color: #ef4444;'>{current}</td></tr>
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>Ustawiony próg (Limit):</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold;'>{threshold}</td></tr>
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
}