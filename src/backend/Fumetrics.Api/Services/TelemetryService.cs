using Fumetrics.Contracts;
using Fumetrics.Api.Repositories;
using Grpc.Core;
using Fumetrics.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Fumetrics.Api.Contracts;

namespace Fumetrics.Api.Services;

public class TelemetryService(ILogger<TelemetryService> logger, LogRepository logRepo, AgentRepository agentRepo, IHubContext<TelemetryHub> hubContext) : TelemetryIngestion.TelemetryIngestionBase
{
    public override async Task<LogBatchResponse> SendLogs(LogBatchRequest request, ServerCallContext context)
    {
        logger.LogInformation("Zapisuję {Count} logów do ClickHouse...", request.Logs.Count);

        var dtoList = request.Logs.Select(l => new LogEntryDto(
            l.Timestamp, l.ServiceName, l.Level.ToString(), l.Message, l.Tags.ToDictionary(k => k.Key, v => v.Value)
        ));

        await logRepo.InsertLogsBulkAsync(dtoList);
        await hubContext.Clients.All.SendAsync("DataUpdated");

        return new LogBatchResponse { Success = true, ProcessedCount = request.Logs.Count };
    }

    public override async Task<AgentStatusResponse> SendAgentStatus(AgentStatusRequest request, ServerCallContext context)
    {
        try
        {
            await agentRepo.InsertMetricsAsync(request);
            logger.LogInformation("Zapisano status {Count} usług z maszyny {Machine}", request.Services.Count, request.MachineName);
            await hubContext.Clients.All.SendAsync("AgentDataUpdated");
            return new AgentStatusResponse { Success = true };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Błąd podczas przetwarzania statusu agenta.");
            return new AgentStatusResponse { Success = false };
        }
    }
}