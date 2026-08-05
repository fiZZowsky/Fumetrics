using Fumetrics.Agent;
using Fumetrics.Agent.Services.Interfaces;
using System.Runtime.InteropServices;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((hostContext, services) =>
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            services.AddSingleton<ISystemService, WindowsSystemMonitor>();
        }
        // else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        // {
        //     services.AddSingleton<ISystemService, LinuxSystemMonitor>();
        // }
        else
        {
            throw new PlatformNotSupportedException("OS not supported by Fumetrics Agent");
        }

        services.AddHostedService<AgentWorker>();
    })
    .Build();

host.Run();