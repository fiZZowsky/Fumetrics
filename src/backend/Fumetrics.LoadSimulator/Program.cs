using Fumetrics.StressService;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "Fumetrics System Stressor";
});

builder.Services.AddHostedService<StressWorker>();

var host = builder.Build();
host.Run();