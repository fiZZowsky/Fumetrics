'use client';

import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Activity, Server, AlertTriangle, CheckCircle, Terminal } from 'lucide-react';
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

export default function Dashboard() {
  const [summaryData, setSummaryData] = useState<MetricItem[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [latestLogs, setLatestLogs] = useState<LatestLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [summaryRes, timelineRes, latestRes] = await Promise.all([
        fetch('https://localhost:7161/api/metrics/summary'),
        fetch('https://localhost:7161/api/metrics/timeline'),
        fetch('https://localhost:7161/api/metrics/latest')
      ]);

      if (!summaryRes.ok || !timelineRes.ok || !latestRes.ok) throw new Error('Błąd pobierania danych');
      
      const summaryJson = await summaryRes.json();
      const timelineJson = await timelineRes.json();
      const latestJson = await latestRes.json();
      
      setSummaryData(summaryJson);
      setTimelineData(timelineJson);
      setLatestLogs(latestJson);
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
      .withUrl('https://localhost:7161/hubs/telemetry')
      .withAutomaticReconnect()
      .build();

    connection.on("DataUpdated", () => {
      fetchData();
    });

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
      itemStyle: { color: level.toLowerCase() === 'error' ? '#ef4444' : level.toLowerCase() === 'critical' ? '#b91c1c' : level.toLowerCase() === 'warning' ? '#f59e0b' : '#3b82f6' }
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
      itemStyle: { color: level.toLowerCase() === 'error' ? '#ef4444' : level.toLowerCase() === 'critical' ? '#b91c1c' : level.toLowerCase() === 'warning' ? '#f59e0b' : '#3b82f6' },
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-cyan-400" />
          <h1 className="text-2xl font-bold tracking-wider">FUMETRICS // TELEMETRY DASHBOARD</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>Błąd: {error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

      {/* Wykresy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
          <h2 className="text-lg font-medium mb-4 text-slate-300">Aktywność w czasie (Ostatnie 5 minut)</h2>
          <ReactECharts option={getLineChartOptions()} style={{ height: '350px', width: '100%' }} />
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
          <h2 className="text-lg font-medium mb-4 text-slate-300">Dystrybucja Logów według Serwisów</h2>
          <ReactECharts option={getBarChartOptions()} style={{ height: '350px', width: '100%' }} />
        </div>
      </div>

      {/* Live Log Stream Console */}
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
    </main>
  );
}