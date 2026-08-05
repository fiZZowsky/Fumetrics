'use client';

import { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Activity, Server, AlertTriangle, CheckCircle, Terminal, HardDrive, ShieldAlert, Cpu, X } from 'lucide-react';
import * as signalR from '@microsoft/signalr';

interface MetricItem { serviceName: string; level: string; count: number; }
interface TimelineItem { timeWindow: string; level: string; count: number; }
interface LatestLogItem { timestamp: string; serviceName: string; level: string; message: string; }
interface AgentStatusItem { machineName: string; osVersion: string; serviceName: string; state: string; lastUpdated: string; machineCpu: number; machineRam: number; machineDisk: number; }

// NOWY INTERFEJS DLA HISTORII
interface AgentHistoryItem { timestamp: string; cpu: number; ram: number; disk: number; }

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'apps' | 'infra'>('apps');
  
  const [summaryData, setSummaryData] = useState<MetricItem[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [latestLogs, setLatestLogs] = useState<LatestLogItem[]>([]);
  const [agentsData, setAgentsData] = useState<AgentStatusItem[]>([]);
  
  // STANY DLA MODALA Z HISTORIĄ
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [machineHistory, setMachineHistory] = useState<AgentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  
  const [historyRange, setHistoryRange] = useState<'1h' | '24h' | '30d'>('1h');
  const selectedMachineRef = useRef(selectedMachine);
  const historyRangeRef = useRef(historyRange);

  useEffect(() => {
      selectedMachineRef.current = selectedMachine;
      historyRangeRef.current = historyRange;
    }, [selectedMachine, historyRange]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const baseUrl = `http://${window.location.hostname}:5170/api/metrics`;
      const [summaryRes, timelineRes, latestRes, agentsRes] = await Promise.all([
        fetch(`${baseUrl}/summary`), fetch(`${baseUrl}/timeline`), fetch(`${baseUrl}/latest`), fetch(`${baseUrl}/agents`)
      ]);
      if (!summaryRes.ok || !timelineRes.ok || !latestRes.ok || !agentsRes.ok) throw new Error('Błąd pobierania danych');
      
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

  // NOWA FUNKCJA POBIERAJĄCA HISTORIĘ
const fetchMachineHistory = async (machineName: string, range: string = historyRange) => {
    setSelectedMachine(machineName);
    setHistoryLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/agents/${machineName}/history?range=${range}`);
      if (res.ok) setMachineHistory(await res.json());
    } catch (err) {
      console.error('Błąd pobierania historii', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`http://${window.location.hostname}:5170/hubs/telemetry`)
      .withAutomaticReconnect()
      .build();

    connection.on("DataUpdated", () => fetchData());
    connection.on("AgentDataUpdated", () => {
      fetchData();
      if (selectedMachineRef.current) {
        fetchMachineHistory(selectedMachineRef.current, historyRangeRef.current);
      }
    });

    connection.start().catch(err => console.error("Błąd SignalR:", err));
    return () => { connection.stop(); };
  }, []);

  // WYKRES HISTORII SPRZĘTU
  const getHistoryChartOptions = () => {
    const times = machineHistory.map(h => h.timestamp);
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: ['CPU', 'RAM', 'Dysk'], textStyle: { color: '#9ca3af' } },
      xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' } },
      yAxis: { type: 'value', max: 100, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#374151' } } },
      series: [
        { name: 'CPU', type: 'line', smooth: true, showSymbol: false, data: machineHistory.map(h => h.cpu), itemStyle: { color: '#3b82f6' }, areaStyle: { opacity: 0.1 } },
        { name: 'RAM', type: 'line', smooth: true, showSymbol: false, data: machineHistory.map(h => h.ram), itemStyle: { color: '#10b981' }, areaStyle: { opacity: 0.1 } },
        { name: 'Dysk', type: 'line', smooth: true, showSymbol: false, data: machineHistory.map(h => h.disk), itemStyle: { color: '#8b5cf6' }, areaStyle: { opacity: 0.1 } }
      ]
    };
  };

  // ... (KOD STARYCH WYKRESÓW LOGÓW ZOSTAJE BEZ ZMIAN)
  const getBarChartOptions = () => { /* jak wcześniej */ return {}; };
  const getLineChartOptions = () => { /* jak wcześniej */ return {}; };

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
          <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
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
      
{/* MODAL Z HISTORIĄ SERWERA */}
      {selectedMachine && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl p-6 shadow-2xl flex flex-col">
            
            {/* Nagłówek i Dropdown */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <HardDrive className="w-6 h-6 text-indigo-400" /> {selectedMachine}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-sm text-slate-400">Historia obciążenia z:</p>
                  <select 
                    value={historyRange}
                    onChange={(e) => {
                      const newRange = e.target.value as '1h' | '24h' | '30d';
                      setHistoryRange(newRange);
                      if (selectedMachine) fetchMachineHistory(selectedMachine, newRange);
                    }}
                    className="bg-slate-800 text-slate-200 text-xs rounded-md px-2 py-1 border border-slate-700 outline-none focus:border-cyan-500 transition-colors cursor-pointer"
                  >
                    <option value="1h">Ostatnia godzina</option>
                    <option value="24h">Ostatnie 24h</option>
                    <option value="30d">Ostatni miesiąc</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedMachine(null); setHistoryRange('1h'); }} 
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Miejsce na sam Wykres! */}
            {historyLoading ? (
              <div className="h-100 flex items-center justify-center text-slate-500">
                Ładowanie danych...
              </div>
            ) : (
              <ReactECharts option={getHistoryChartOptions()} style={{ height: '400px', width: '100%' }} />
            )}

          </div>
        </div>
      )}

      {/* NAGŁÓWEK I ZAKŁADKI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-cyan-400" />
          <h1 className="text-2xl font-bold tracking-wider">FUMETRICS</h1>
        </div>
        
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
          <button onClick={() => setActiveTab('apps')} className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'apps' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>Aplikacje (Logi)</button>
          <button onClick={() => setActiveTab('infra')} className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'infra' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>Infrastruktura</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" /><span>Błąd: {error}</span>
        </div>
      )}

      {/* ZAKŁADKA: APKI */}
      {activeTab === 'apps' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tutaj reszta Twoich starych kart KPI z logów (CheckCircle, Server, Activity)... */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2"><span>Status Systemu</span><CheckCircle className="w-5 h-5 text-emerald-400" /></div>
              <div className="text-2xl font-semibold text-emerald-400">Aktywny</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2"><span>Monitorowane Serwisy</span><Server className="w-5 h-5 text-cyan-400" /></div>
              <div className="text-2xl font-semibold">{Array.from(new Set(summaryData.map(d => d.serviceName))).length}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2"><span>Wszystkie Zdarzenia</span><Activity className="w-5 h-5 text-purple-400" /></div>
              <div className="text-2xl font-semibold">{summaryData.reduce((acc, curr) => acc + curr.count, 0)}</div>
            </div>
          </div>
          
          {/* Tabela Live Stream... */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2 mb-4 text-slate-300">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-medium">Live Log Stream</h2>
            </div>
            <div className="overflow-x-auto max-h-100 overflow-y-auto rounded-lg border border-slate-800 bg-[#0A0F1C] custom-scrollbar">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-900/80 sticky top-0 z-10 text-xs uppercase text-slate-400 backdrop-blur-sm">
                  <tr><th className="p-4 border-b border-slate-800 font-semibold w-48">Czas (UTC)</th><th className="p-4 border-b border-slate-800 font-semibold w-32">Poziom</th><th className="p-4 border-b border-slate-800 font-semibold w-48">Serwis</th><th className="p-4 border-b border-slate-800 font-semibold">Wiadomość</th></tr>
                </thead>
                <tbody className="text-sm font-mono text-slate-300">
                  {latestLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0">
                      <td className="p-4 text-slate-500">{log.timestamp}</td>
                      <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${getLevelColor(log.level)}`}>{log.level.toUpperCase()}</span></td>
                      <td className="p-4 text-slate-400">{log.serviceName}</td><td className="p-4 truncate max-w-xl">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ZAKŁADKA: INFRASTRUKTURA */}
      {activeTab === 'infra' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {Object.entries(groupedAgents).length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-12">
                Brak podłączonych agentów. Uruchom Fumetrics.Agent!
              </div>
            )}

            {Object.entries(groupedAgents).map(([machineName, services]) => {
              const machineMetrics = services[0];
              
              return (
                <div 
                  key={machineName} 
                  // DODANA KLIKALNOŚĆ KARTY
                  onClick={() => fetchMachineHistory(machineName)}
                  className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] cursor-pointer transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 rounded-lg"><HardDrive className="w-6 h-6 text-indigo-400" /></div>
                      <div>
                        <h3 className="font-bold text-lg">{machineName}</h3>
                        <p className="text-xs text-slate-400">{machineMetrics?.osVersion}</p>
                      </div>
                    </div>
                    {services.some(s => s.state.toUpperCase() !== 'RUNNING') && (
                      <div title="Niektóre usługi są zatrzymane!"><ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" /></div>
                    )}
                  </div>
                  
                  <div className="p-5 bg-slate-950/30 border-b border-slate-800 grid grid-cols-3 gap-4 pointer-events-none">
                    <MetricBar label="CPU" value={machineMetrics?.machineCpu || 0} icon={Cpu} />
                    <MetricBar label="RAM" value={machineMetrics?.machineRam || 0} icon={Activity} />
                    <MetricBar label="Dysk" value={machineMetrics?.machineDisk || 0} icon={HardDrive} />
                  </div>
                  
                  <div className="p-5 flex-1 space-y-3 pointer-events-none">
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
                  
                  <div className="p-3 bg-slate-950 text-xs text-center text-slate-500 border-t border-slate-800 pointer-events-none">
                    Kliknij, aby zobaczyć historię obciążenia
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