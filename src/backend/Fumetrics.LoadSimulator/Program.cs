using Fumetrics.LoadSimulator;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "FumetricsLoadSimulator";
});

builder.Services.AddHostedService<LoadWorker>();

var host = builder.Build();
host.Run();