using System.Diagnostics;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;
using Fumetrics.Contracts;

namespace Fumetrics.Agent.Services;

[SupportedOSPlatform("windows")]
public class EventLogMonitor : BackgroundService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EventLogMonitor> _logger;
    private readonly HttpClient _httpClient;
    private EventLog? _appLog;
    private EventLog? _sysLog;

    public EventLogMonitor(IConfiguration configuration, ILogger<EventLogMonitor> logger)
    {
        _configuration = configuration;
        _logger = logger;

        var backendUrl = _configuration["Fumetrics:BackendUrl"] ?? "http://localhost:5170";
        _httpClient = new HttpClient { BaseAddress = new Uri(backendUrl) };
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            _appLog = new EventLog("Application");
            _appLog.EntryWritten += OnEntryWritten;
            _appLog.EnableRaisingEvents = true;

            _sysLog = new EventLog("System");
            _sysLog.EntryWritten += OnEntryWritten;
            _sysLog.EnableRaisingEvents = true;

            _logger.LogInformation("Rozpoczęto nasłuchiwanie logów z Windows Event Viewer (Application & System).");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Brak uprawnień do nasłuchiwania dziennika zdarzeń. Uruchom Agenta jako Administrator!");
        }

        return Task.CompletedTask;
    }

    private async void OnEntryWritten(object sender, EntryWrittenEventArgs e)
    {
        if (e.Entry.EntryType != EventLogEntryType.Error && e.Entry.EntryType != EventLogEntryType.Warning)
        {
            return;
        }

        var logLevel = e.Entry.EntryType == EventLogEntryType.Error
            ? Fumetrics.Contracts.LogLevel.Error
            : Fumetrics.Contracts.LogLevel.Warning;

        var logEntry = new LogEntry
        {
            Timestamp = e.Entry.TimeGenerated.ToString("yyyy-MM-dd HH:mm:ss"),
            ServiceName = e.Entry.Source,
            Level = logLevel,
            Message = e.Entry.Message.Length > 1000 ? e.Entry.Message.Substring(0, 1000) + "..." : e.Entry.Message,

            Tags =
            {
                { "MachineName", Environment.MachineName },
                { "Category", e.Entry.Category ?? "None" }
            }
        };

        try
        {
            var json = JsonSerializer.Serialize(logEntry);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            await _httpClient.PostAsync("/api/metrics/logs", content);
        }
        catch (Exception)
        {
        }
    }

    public override void Dispose()
    {
        if (_appLog != null) { _appLog.EnableRaisingEvents = false; _appLog.Dispose(); }
        if (_sysLog != null) { _sysLog.EnableRaisingEvents = false; _sysLog.Dispose(); }
        base.Dispose();
    }
}