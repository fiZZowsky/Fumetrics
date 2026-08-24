using Fumetrics.Api.Contracts;
using Fumetrics.Api.Repositories;

namespace Fumetrics.Api.Services;

public class AlertEvaluatorService(
    AgentRepository agentRepo,
    AlertRepository alertRepo,
    AlertStateManager stateManager,
    EmailService emailService,
    AlertHistoryRepository historyRepo,
    ILogger<AlertEvaluatorService> logger)
{
    public async Task ProcessAlertsAsync()
    {
        var rules = await alertRepo.GetAllAsync();
        if (!rules.Any()) return;

        var latestMetrics = (await agentRepo.GetLatestStatusAsync()).ToList();
        var currentKeys = new HashSet<string>();

        foreach (var rule in rules)
        {
            var machineMetrics = latestMetrics.Where(m => m.MachineName == rule.MachineName).ToList();
            if (!machineMetrics.Any()) continue;

            bool isMachineLevel = rule.ServiceName == "*";
            var targets = isMachineLevel ? machineMetrics : machineMetrics.Where(m => m.ServiceName == rule.ServiceName).ToList();

            foreach (var metric in targets)
            {
                string stateKey = $"{rule.Id}_{metric.MachineName}_{metric.ServiceName}";
                currentKeys.Add(stateKey);

                bool isViolating = EvaluateRule(rule, metric, out var reason, out var currentVal);

                if (isViolating)
                {
                    if (!stateManager.ActiveStates.TryGetValue(stateKey, out var state))
                    {
                        state = new AlertState { FirstSeen = DateTime.UtcNow, IsFiring = false };
                        stateManager.ActiveStates[stateKey] = state;
                    }

                    if (!state.IsFiring)
                    {
                        if ((DateTime.UtcNow - state.FirstSeen).TotalMinutes >= rule.DelayMinutes)
                        {
                            state.IsFiring = true;
                            state.LastSent = DateTime.UtcNow;
                            await TriggerEmailAsync(rule, metric, reason, currentVal, true, false);

                            try
                            {
                                await historyRepo.InsertAsync(new AlertHistoryDto(
                                    Guid.NewGuid().ToString(), rule.Id, rule.MachineName, metric.ServiceName, "FIRING", reason, DateTime.UtcNow
                                ));
                            }
                            catch (Exception ex) { logger.LogError(ex, "Błąd zapisu do historii alertów (FIRING)!"); }
                        }
                    }
                    else
                    {
                        if (rule.RepeatMinutes > 0 && state.LastSent.HasValue && (DateTime.UtcNow - state.LastSent.Value).TotalMinutes >= rule.RepeatMinutes)
                        {
                            state.LastSent = DateTime.UtcNow;
                            await TriggerEmailAsync(rule, metric, reason, currentVal, true, true);
                        }
                    }
                }
                else
                {
                    if (stateManager.ActiveStates.TryGetValue(stateKey, out var state))
                    {
                        if (state.IsFiring)
                        {
                            await TriggerEmailAsync(rule, metric, "Wszystkie parametry w normie", metric.State, false, false);

                            try
                            {
                                await historyRepo.InsertAsync(new AlertHistoryDto(
                                    Guid.NewGuid().ToString(), rule.Id, rule.MachineName, metric.ServiceName, "RESOLVED", "Parametry wróciły do normy", DateTime.UtcNow
                                ));
                            }
                            catch (Exception ex) { logger.LogError(ex, "Błąd zapisu do historii alertów (RESOLVED)!"); }
                        }
                        stateManager.ActiveStates.Remove(stateKey);
                    }
                }
            }
        }

        var keysToRemove = stateManager.ActiveStates.Keys.Except(currentKeys).ToList();
        foreach (var key in keysToRemove) stateManager.ActiveStates.Remove(key);
    }

    private bool EvaluateRule(AlertRuleDto rule, AgentServiceStatusDto metric, out string reason, out string current)
    {
        reason = current = string.Empty;
        bool isMachineLevel = rule.ServiceName == "*";

        if (!isMachineLevel)
        {
            if (rule.Metric == "State" && metric.State.Equals(rule.Threshold, StringComparison.OrdinalIgnoreCase)) { reason = "Zmiana statusu usługi"; current = metric.State; return true; }
            if (rule.Metric == "ServiceCpu" && double.TryParse(rule.Threshold, out double c) && metric.ServiceCpu >= c) { reason = "Wysokie obciążenie CPU usługi"; current = $"{metric.ServiceCpu}%"; return true; }
            if (rule.Metric == "ServiceRam" && double.TryParse(rule.Threshold, out double r) && metric.ServiceRam >= r) { reason = "Wysokie zużycie RAM usługi"; current = $"{metric.ServiceRam} MB"; return true; }
            if (rule.Metric == "ServiceDisk" && double.TryParse(rule.Threshold, out double d) && metric.ServiceDisk >= d) { reason = "Wysokie zużycie Dysku (I/O) usługi"; current = $"{metric.ServiceDisk} MB/s"; return true; }
        }
        else
        {
            if (rule.Metric == "MachineCpu" && double.TryParse(rule.Threshold, out double mc) && metric.MachineCpu >= mc) { reason = "Przeciążenie CPU serwera"; current = $"{metric.MachineCpu}%"; return true; }
            if (rule.Metric == "MachineRam" && double.TryParse(rule.Threshold, out double mr) && metric.MachineRam >= mr) { reason = "Brak pamięci RAM na serwerze"; current = $"{metric.MachineRam}%"; return true; }
            if (rule.Metric == "MachineDisk" && double.TryParse(rule.Threshold, out double md) && metric.MachineDisk >= md) { reason = "Przeciążenie dysku serwera"; current = $"{metric.MachineDisk}%"; return true; }
        }
        return false;
    }

    private async Task TriggerEmailAsync(AlertRuleDto rule, AgentServiceStatusDto metric, string reason, string currentVal, bool isAlarm, bool isReminder)
    {
        bool isMachineLevel = rule.ServiceName == "*";
        string targetName = isMachineLevel ? "CAŁY SERWER" : metric.ServiceName;

        string statusText = isAlarm ? (isReminder ? "PRZYPOMNIENIE O AWARII" : "WYKRYTO AWARIĘ") : "ROZWIĄZANO (ZAMKNIĘTO)";
        string subject = $"[{statusText}] {targetName} na {rule.MachineName}";

        string htmlBody = BuildHtmlEmail(rule, metric, reason, currentVal, rule.Threshold, isMachineLevel, isAlarm, isReminder);
        await emailService.SendEmailAsync(rule.Email, subject, htmlBody);

        logger.LogWarning("Wysłano email [{Status}] dla reguły {RuleId} ({Target})", statusText, rule.Id, targetName);
    }

    private string BuildHtmlEmail(AlertRuleDto rule, AgentServiceStatusDto metric, string reason, string current, string threshold, bool isMachineLevel, bool isAlarm, bool isReminder)
    {
        string color = isAlarm ? "#ef4444" : "#10b981";
        string title = isAlarm ? (isReminder ? "🚨 ALARM TRWA NADAL" : "🚨 NOWY ALARM") : "✅ INCYDENT ROZWIĄZANY";
        string targetName = isMachineLevel ? "CAŁY SERWER" : metric.ServiceName;

        if (!string.IsNullOrWhiteSpace(rule.HtmlTemplate))
        {
            return rule.HtmlTemplate
                .Replace("{{Title}}", title)
                .Replace("{{Color}}", color)
                .Replace("{{MachineName}}", rule.MachineName)
                .Replace("{{Target}}", targetName)
                .Replace("{{Reason}}", reason)
                .Replace("{{CurrentValue}}", current)
                .Replace("{{Threshold}}", threshold)
                .Replace("{{OsVersion}}", metric.OsVersion)
                .Replace("{{MachineCpu}}", metric.MachineCpu.ToString())
                .Replace("{{MachineRam}}", metric.MachineRam.ToString())
                .Replace("{{MachineDisk}}", metric.MachineDisk.ToString())
                .Replace("{{LastUpdated}}", metric.LastUpdated);
        }

        return GetDefaultSystemTemplate(rule, metric, reason, current, threshold, isMachineLevel, isAlarm, isReminder, color, title, targetName);
    }

    private string GetDefaultSystemTemplate(AlertRuleDto rule, AgentServiceStatusDto metric, string reason, string current, string threshold, bool isMachineLevel, bool isAlarm, bool isReminder, string color, string title, string targetName)
    {
        string subtitle = isAlarm ? "System monitorowania potwierdził trwającą anomalię." : "Parametry wróciły do normy. Status alarmu został zamknięty.";

        string serviceDetailsHtml = isMachineLevel ? "" : $@"
            <div style='margin-top: 15px; border-top: 1px solid #334155; padding-top: 10px;'>
                <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>Stan Usługi:</strong> <span style='color: #10b981;'>{metric.State}</span></div>
                <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>CPU Usługi:</strong> {metric.ServiceCpu}%</div>
                <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>RAM Usługi:</strong> {metric.ServiceRam} MB</div>
                <div style='margin-bottom: 8px;'><strong style='color:#94a3b8;'>Dysk Usługi:</strong> {metric.ServiceDisk} MB/s</div>
            </div>";

        string targetLabel = isMachineLevel ? "Cel (Cała maszyna):" : "Usługa:";
        string targetValue = isMachineLevel ? "Wszystkie usługi" : targetName;

        return $@"
        <div style='font-family: ""Segoe UI"", Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #334155; border-radius: 8px; overflow: hidden; background-color: #0f172a; color: #f8fafc;'>
            <div style='background-color: #1e293b; padding: 20px; text-align: center; border-bottom: 3px solid {color};'>
                <h2 style='color: {color}; margin: 0; letter-spacing: 2px;'>{title}</h2>
                <p style='color: #94a3b8; font-size: 12px; margin-top: 5px;'>{subtitle}</p>
            </div>
            <div style='padding: 24px;'>
                <table style='width: 100%; border-collapse: collapse; margin-bottom: 20px;'>
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8; width: 40%;'>Serwer:</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold;'>{rule.MachineName}</td></tr>
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>{targetLabel}</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold;'>{targetValue}</td></tr>
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>Powód (Reguła):</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold; color: {color};'>{reason}</td></tr>
                    {(isAlarm ? $@"
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>Zarejestrowana wartość:</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold; color: {color};'>{current}</td></tr>
                    <tr><td style='padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;'>Ustawiony próg (Limit):</td><td style='padding: 10px; border-bottom: 1px solid #334155; font-weight: bold;'>{threshold}</td></tr>
                    " : "")}
                </table>
                <h3 style='color: #38bdf8; margin-top: 30px;'>Kondycja serwera w momencie pomiaru</h3>
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
                Fumetrics Alerting System (State Machine)<br/>
                Osiągnięto opóźnienie wyzwolenia: {rule.DelayMinutes} min. | Przypomnienia: co {rule.RepeatMinutes} min.
            </div>
        </div>";
    }
}