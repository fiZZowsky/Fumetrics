using Fumetrics.Contracts;
using Fumetrics.Api.Repositories;
using Grpc.Core;
using Fumetrics.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Fumetrics.Api.Services;

public class TelemetryService : TelemetryIngestion.TelemetryIngestionBase
{
    private readonly ILogger<TelemetryService> _logger;
    private readonly ClickHouseRepository _repository;
    private readonly IHubContext<TelemetryHub> _hubContext;

    public TelemetryService(ILogger<TelemetryService> logger, ClickHouseRepository repository, IHubContext<TelemetryHub> hubContext)
    {
        _logger = logger;
        _repository = repository;
        _hubContext = hubContext;
    }

    public override async Task<LogBatchResponse> SendLogs(LogBatchRequest request, ServerCallContext context)
    {
        _logger.LogInformation("Zapisuję {Count} logów do ClickHouse...", request.Logs.Count);

        await _repository.InsertLogsBulkAsync(request.Logs);

        await _hubContext.Clients.All.SendAsync("DataUpdated");

        return new LogBatchResponse
        {
            Success = true,
            ProcessedCount = request.Logs.Count
        };
    }
}