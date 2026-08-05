'use client';

import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Activity, Server, AlertTriangle, CheckCircle, Terminal, HardDrive, ShieldAlert, Cpu } from 'lucide-react';
import * as signalR from '@microsoft/signalr';

interface MetricItem {
  serviceName: string;
  level: string;
  count: number;
}

interface TimelineItem {
  timeWindow: string;
  level: string;
  count: number;
}

interface LatestLogItem {
  timestamp: string;
  serviceName: string;
  level: string;
  message: string;
}

// ZAKTUALIZOWANY INTERFEJS O POLA SPRZĘTOWE
interface AgentStatusItem {
  machineName: string;
  osVersion: string;
  serviceName: string;
  state: string;
  lastUpdated: string;
  machineCpu: number;
  machineRam: number;
  machineDisk: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'apps' | 'infra'>('apps');
  
  const [summaryData, setSummaryData] = useState<MetricItem[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [latestLogs, setLatestLogs] = useState<LatestLogItem[]>([]);
  const [agentsData, setAgentsData] = useState<AgentStatusItem[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const baseUrl = `http://${window.location.hostname}:5170/api/metrics`;
      
      const [summaryRes, timelineRes, latestRes, agentsRes] = await Promise.all([
        fetch(`${baseUrl}/summary`),
        fetch(`${baseUrl}/timeline`),
        fetch(`${baseUrl}/latest`),
        fetch(`${baseUrl}/agents`)
      ]);

      if (!summaryRes.ok || !timelineRes.ok || !latestRes.ok || !agentsRes.ok) {
        throw new Error('Błąd pobierania danych');
      }
      
      setSummaryData(await summaryRes.json());
      setTimelineData(await timelineRes.json());
      setLatestLogs(await latestRes.json());
      setAgentsData(await agentsRes.json());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Nie udało się połączyć z API .NET');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`http://${window.location.hostname}:5170/hubs/telemetry`)
      .withAutomaticReconnect()
      .build();

    connection.on("DataUpdated", () => fetchData());
    connection.on("AgentDataUpdated", () => fetchData());

    connection.start().catch(err => console.error("Błąd SignalR:", err));

    return () => { connection.stop(); };
  }, []);

  const getBarChartOptions = () => {
    const services = Array.from(new Set(summaryData.map(d => d.serviceName)));
    const levels = Array.from(new Set(summaryData.map(d => d.level)));

    const series = levels.map(level => ({
      name: level,
      type: 'bar',
      data: services.map(service => {
        const item = summaryData.find(d => d.serviceName === service && d.level === level);
        return item ? item.count : 0;
      }),
      itemStyle: { 
        color: level.toLowerCase() === 'error' ? '#ef4444' : 
               level.toLowerCase() === 'critical' ? '#b91c1c' : 
               level.toLowerCase() === 'warning' ? '#f59e0b' : '#3b82f6' 
      }
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: levels, textStyle: { color: '#9ca3af' } },
      xAxis: { type: 'category', data: services, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#374151' } } },
      series: series
    };
  };

  const getLineChartOptions = () => {
    const times = Array.from(new Set(timelineData.map(d => d.timeWindow))).sort();
    const levels = Array.from(new Set(timelineData.map(d => d.level)));

    const series = levels.map(level => ({
      name: level,
      type: 'line',
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.1 },
      data: times.map(time => {
        const item = timelineData.find(d => d.timeWindow === time && d.level === level);
        return item ? item.count : 0;
      }),
      itemStyle: { 
        color: level.toLowerCase() === 'error' ? '#ef4444' : 
               level.toLowerCase() === 'critical' ? '#b91c1c' : 
               level.toLowerCase() === 'warning' ? '#f59e0b' : '#3b82f6' 
      },
      lineStyle: { width: 3 }
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: levels, textStyle: { color: '#9ca3af' } },
      xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#374151' } } },
      series: series
    };
  };

  const getLevelColor = (level: string) => {
    const l = level.toLowerCase();
    if (l === 'critical') return 'text-red-500 bg-red-500/10 border border-red-500/20';
    if (l === 'error') return 'text-red-400 bg-red-400/10 border border-red-400/20';
    if (l === 'warning') return 'text-amber-400 bg-amber-400/10 border border-amber-400/20';
    return 'text-blue-400 bg-blue-400/10 border border-blue-400/20';
  };

  const getStateColor = (state: string) => {
    const s = state.toUpperCase();
    if (s === 'RUNNING') return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    if (s === 'STOPPED' || s === 'FAILED') return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
  };

  // Komponent pomocniczy do renderowania paska postępu (Progress Bar) sprzętu
  const MetricBar = ({ label, value, icon: Icon }: { label: string, value: number, icon: any }) => {
    let colorClass = "bg-emerald-500";
    if (value > 85) colorClass = "bg-red-500";
    else if (value > 65) colorClass = "bg-amber-400";

    return (
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5" /> {label}
          </span>
          <span className={value > 85 ? 'text-red-400 font-bold' : ''}>{value.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${colorClass}`} 
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }} 
          />
        </div>
      </div>
    );
  };

  const groupedAgents = agentsData.reduce((acc, curr) => {
    if (!acc[curr.machineName]) acc[curr.machineName] = [];
    acc[curr.machineName].push(curr);
    return acc;
  }, {} as Record<string, AgentStatusItem[]>);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-cyan-400" />
          <h1 className="text-2xl font-bold tracking-wider">FUMETRICS</h1>
        </div>
        
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
          <button 
            onClick={() => setActiveTab('apps')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'apps' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Aplikacje (Logi)
          </button>
          <button 
            onClick={() => setActiveTab('infra')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'infra' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Infrastruktura
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>Błąd: {error}</span>
        </div>
      )}

      {activeTab === 'apps' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span>Status Systemu</span>
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-semibold text-emerald-400">Aktywny</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span>Monitorowane Serwisy</span>
                <Server className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-2xl font-semibold">{Array.from(new Set(summaryData.map(d => d.serviceName))).length}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span>Wszystkie Zdarzenia</span>
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-2xl font-semibold">{summaryData.reduce((acc, curr) => acc + curr.count, 0)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <h2 className="text-lg font-medium mb-4 text-slate-300">Aktywność w czasie (Ostatnie 5 minut)</h2>
              <ReactECharts option={getLineChartOptions()} style={{ height: '350px', width: '100%' }} />
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <h2 className="text-lg font-medium mb-4 text-slate-300">Dystrybucja Logów według Serwisów</h2>
              <ReactECharts option={getBarChartOptions()} style={{ height: '350px', width: '100%' }} />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2 mb-4 text-slate-300">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-medium">Live Log Stream</h2>
              <span className="ml-2 relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            
            <div className="overflow-x-auto max-h-100 overflow-y-auto rounded-lg border border-slate-800 bg-[#0A0F1C] custom-scrollbar">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-900/80 sticky top-0 z-10 text-xs uppercase text-slate-400 backdrop-blur-sm">
                  <tr>
                    <th className="p-4 border-b border-slate-800 font-semibold w-48">Czas (UTC)</th>
                    <th className="p-4 border-b border-slate-800 font-semibold w-32">Poziom</th>
                    <th className="p-4 border-b border-slate-800 font-semibold w-48">Serwis</th>
                    <th className="p-4 border-b border-slate-800 font-semibold">Wiadomość</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono text-slate-300">
                  {latestLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0">
                      <td className="p-4 text-slate-500">{log.timestamp}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getLevelColor(log.level)}`}>
                          {log.level.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{log.serviceName}</td>
                      <td className="p-4 truncate max-w-xl">{log.message}</td>
                    </tr>
                  ))}
                  {latestLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">Czekam na logi...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'infra' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {Object.entries(groupedAgents).length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-12">
                Brak podłączonych agentów. Uruchom Fumetrics.Agent!
              </div>
            )}

            {Object.entries(groupedAgents).map(([machineName, services]) => {
              // Pobieramy metryki z pierwszego serwisu dla danej maszyny (metryki sprzętowe są wspólne dla maszyny)
              const machineMetrics = services[0];
              
              return (
                <div key={machineName} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col hover:border-slate-700 transition-colors">
                  
                  {/* Nagłówek Karty */}
                  <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <HardDrive className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{machineName}</h3>
                        <p className="text-xs text-slate-400">{machineMetrics?.osVersion}</p>
                      </div>
                    </div>
                      {services.some(s => s.state.toUpperCase() !== 'RUNNING') && (
                        <div title="Niektóre usługi są zatrzymane!">
                          <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" />
                        </div>
                      )}
                  </div>
                  
                  {/* NOWE: Parametry Sprzętowe (CPU, RAM, Dysk) */}
                  <div className="p-5 bg-slate-950/30 border-b border-slate-800 grid grid-cols-3 gap-4">
                    <MetricBar label="CPU" value={machineMetrics?.machineCpu || 0} icon={Cpu} />
                    <MetricBar label="RAM" value={machineMetrics?.machineRam || 0} icon={Activity} />
                    <MetricBar label="Dysk" value={machineMetrics?.machineDisk || 0} icon={HardDrive} />
                  </div>
                  
                  {/* Monitorowane Usługi */}
                  <div className="p-5 flex-1 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Monitorowane Usługi</p>
                    
                    {services.map(srv => (
                      <div key={srv.serviceName} className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800/50">
                        <span className="font-mono text-sm text-slate-300">{srv.serviceName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-500">{srv.state}</span>
                          <div className={`w-3 h-3 rounded-full ${getStateColor(srv.state)}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Stopka Karty */}
                  <div className="p-3 bg-slate-950 text-xs text-center text-slate-500 border-t border-slate-800">
                    Ostatnia synchronizacja: {machineMetrics?.lastUpdated}
                  </div>
                  
                </div>
              );
            })}
            
          </div>
        </div>
      )}
    </main>
  );
}