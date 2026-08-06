'use client';

import { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Activity, Server, AlertTriangle, CheckCircle, Terminal, HardDrive, ShieldAlert, Cpu, X, Search, CheckSquare, Square, Trash2, MemoryStick, Heart } from 'lucide-react';
import * as signalR from '@microsoft/signalr';

interface MetricItem { serviceName: string; level: string; count: number; }
interface TimelineItem { timeWindow: string; level: string; count: number; }
interface LatestLogItem { timestamp: string; serviceName: string; level: string; message: string; }
interface AgentStatusItem { machineName: string; osVersion: string; serviceName: string; state: string; lastUpdated: string; machineCpu: number; machineRam: number; machineDisk: number; serviceCpu: number; serviceRam: number; serviceDisk: number; }
interface AgentHistoryItem { timestamp: string; cpu: number; ram: number; disk: number; }

interface ScannedService {
  serviceName: string;
  displayName: string;
  processId: number;
  state: string;
}

interface SavedServer {
  machineName: string;
  ipAddress: string;
  port: string;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'apps' | 'infra'>('apps');

  const [summaryData, setSummaryData] = useState<MetricItem[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [latestLogs, setLatestLogs] = useState<LatestLogItem[]>([]);
  const [agentsData, setAgentsData] = useState<AgentStatusItem[]>([]);

  // MODAL HISTORII
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [machineHistory, setMachineHistory] = useState<AgentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyRange, setHistoryRange] = useState<'1h' | '24h' | '30d'>('1h');

  // SKANER
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanMachineName, setScanMachineName] = useState('');
  const [targetIp, setTargetIp] = useState('localhost');
  const [targetPort, setTargetPort] = useState('5001');
  const [scannedServices, setScannedServices] = useState<ScannedService[]>([]);
  const [scanLoading, setScanLoading] = useState(false);

  // ULUBIONE SERWERY Z BAZY DANYCH CLICKHOUSE
  const [savedServers, setSavedServers] = useState<SavedServer[]>([]);

  const selectedMachineRef = useRef(selectedMachine);
  const selectedServiceRef = useRef(selectedService);
  const historyRangeRef = useRef(historyRange);

  useEffect(() => {
    selectedMachineRef.current = selectedMachine;
    selectedServiceRef.current = selectedService;
    historyRangeRef.current = historyRange;
  }, [selectedMachine, selectedService, historyRange]);

  const [error, setError] = useState<string | null>(null);

  const fetchSavedServers = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/saved-servers`);
      if (res.ok) {
        setSavedServers(await res.json());
      }
    } catch (err) {
      console.error("Błąd pobierania ulubionych serwerów", err);
    }
  };

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
    }
  };

  useEffect(() => {
    fetchSavedServers(); // Pobieramy serwery z bazy przy starcie
  }, []);

  const fetchHistory = async (machineName: string, serviceName: string | null = null, range: string = historyRange) => {
    setSelectedMachine(machineName);
    setSelectedService(serviceName);
    setHistoryLoading(true);
    try {
      const url = serviceName
        ? `http://${window.location.hostname}:5170/api/metrics/agents/${machineName}/services/${serviceName}/history?range=${range}`
        : `http://${window.location.hostname}:5170/api/metrics/agents/${machineName}/history?range=${range}`;

      const res = await fetch(url);
      if (res.ok) setMachineHistory(await res.json());
    } catch (err) {
      console.error('Błąd pobierania historii', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleScanServer = async (overrideIp?: string, overridePort?: string) => {
    const ip = typeof overrideIp === 'string' ? overrideIp : targetIp;
    const port = typeof overridePort === 'string' ? overridePort : targetPort;

    setScanLoading(true);
    try {
      const res = await fetch(`http://${ip}:${port}/api/agent/services`);
      if (!res.ok) throw new Error('Błąd odpowiedzi agenta');
      const data = await res.json();
      setScannedServices(data);
    } catch (err) {
      alert('Nie udało się połączyć z agentem pod wskazanym adresem IP i portem.');
      setScannedServices([]);
    } finally {
      setScanLoading(false);
    }
  };

  // OBSŁUGA ULUBIONYCH (API ClickHouse)
  const toggleFavorite = async () => {
    if (!scanMachineName || !targetIp || !targetPort) return;

    const isSaved = savedServers.some(s => s.machineName === scanMachineName && s.ipAddress === targetIp && s.port === targetPort);

    // Optymistyczny update UI
    if (isSaved) {
      setSavedServers(prev => prev.filter(s => !(s.machineName === scanMachineName && s.ipAddress === targetIp && s.port === targetPort)));
    } else {
      setSavedServers(prev => [...prev, { machineName: scanMachineName, ipAddress: targetIp, port: targetPort }]);
    }

    try {
      const endpoint = isSaved ? 'saved-servers/remove' : 'saved-servers';
      await fetch(`http://${window.location.hostname}:5170/api/metrics/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineName: scanMachineName, ipAddress: targetIp, port: targetPort })
      });
    } catch (err) {
      console.error('Błąd zmiany ulubionego serwera', err);
      fetchSavedServers(); // Przywracamy poprawny stan w razie błędu
    }
  };

  const removeFavorite = async (e: React.MouseEvent, serverToRemove: SavedServer) => {
    e.stopPropagation();

    // Optymistyczny update UI
    setSavedServers(prev => prev.filter(s => s !== serverToRemove));

    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/saved-servers/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverToRemove)
      });
    } catch (err) {
      console.error('Błąd usuwania ulubionego serwera', err);
      fetchSavedServers();
    }
  };

  const handleFavoriteClick = (server: SavedServer) => {
    setScanMachineName(server.machineName);
    setTargetIp(server.ipAddress);
    setTargetPort(server.port);
    handleScanServer(server.ipAddress, server.port);
  };

  const handleToggleService = async (serviceName: string, isCurrentlyMonitored: boolean) => {
    const endpointPath = isCurrentlyMonitored ? 'config-services/remove' : 'config-services';

    if (isCurrentlyMonitored) {
      setAgentsData(prev => prev.filter(srv => !(srv.machineName === scanMachineName && srv.serviceName === serviceName)));
    } else {
      setAgentsData(prev => [...prev, {
        machineName: scanMachineName, osVersion: 'Oczekiwanie na dane...', serviceName: serviceName, state: 'OCZEKIWANIE',
        lastUpdated: 'Teraz', machineCpu: 0, machineRam: 0, machineDisk: 0, serviceCpu: 0, serviceRam: 0, serviceDisk: 0
      }]);
    }

    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/agents/${endpointPath}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineName: scanMachineName, serviceName })
      });
    } catch (err) {
      fetchData();
    }
  };

  const handleRemoveServiceDirectly = async (machineName: string, serviceName: string) => {
    setAgentsData(prev => prev.filter(srv => !(srv.machineName === machineName && srv.serviceName === serviceName)));
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/agents/config-services/remove`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineName, serviceName })
      });
    } catch (err) {
      fetchData();
    }
  };

  useEffect(() => {
    fetchData();
    const connection = new signalR.HubConnectionBuilder().withUrl(`http://${window.location.hostname}:5170/hubs/telemetry`).withAutomaticReconnect().build();
    connection.on("DataUpdated", () => fetchData());
    connection.on("AgentDataUpdated", () => {
      fetchData();
      if (selectedMachineRef.current) fetchHistory(selectedMachineRef.current, selectedServiceRef.current, historyRangeRef.current);
    });
    connection.start().catch(err => console.error("Błąd SignalR:", err));
    return () => { connection.stop(); };
  }, []);

  const getHistoryChartOptions = () => {
    const times = machineHistory.map(h => h.timestamp);
    const isService = !!selectedService;
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: isService ? ['CPU (%)', 'RAM (MB)', 'Dysk (MB/s)'] : ['CPU (%)', 'RAM (%)', 'Dysk (%)'], textStyle: { color: '#9ca3af' } },
      xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' } },
      yAxis: [
        { type: 'value', name: 'Procent', max: isService ? undefined : 100, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#374151' } } },
        ...(isService ? [{ type: 'value', name: 'Wartość (MB, MB/s)', position: 'right', axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af', formatter: '{value}' }, splitLine: { show: false } }] as any : [])
      ],
      series: [
        { name: 'CPU (%)', type: 'line', smooth: true, showSymbol: false, data: machineHistory.map(h => h.cpu), itemStyle: { color: '#3b82f6' }, areaStyle: { opacity: 0.1 }, yAxisIndex: 0 },
        { name: isService ? 'RAM (MB)' : 'RAM (%)', type: 'line', smooth: true, showSymbol: false, data: machineHistory.map(h => h.ram), itemStyle: { color: '#10b981' }, areaStyle: { opacity: 0.1 }, yAxisIndex: isService ? 1 : 0 },
        { name: isService ? 'Dysk (MB/s)' : 'Dysk (%)', type: 'line', smooth: true, showSymbol: false, data: machineHistory.map(h => h.disk), itemStyle: { color: '#8b5cf6' }, areaStyle: { opacity: 0.1 }, yAxisIndex: isService ? 1 : 0 }
      ]
    };
  };

  const getBarChartOptions = () => {
    const services = Array.from(new Set(summaryData.map(d => d.serviceName)));
    const levels = Array.from(new Set(summaryData.map(d => d.level)));
    const series = levels.map(level => ({
      name: level, type: 'bar',
      data: services.map(service => {
        const item = summaryData.find(d => d.serviceName === service && d.level === level);
        return item ? item.count : 0;
      }),
      itemStyle: { color: level.toLowerCase() === 'error' ? '#ef4444' : level.toLowerCase() === 'critical' ? '#b91c1c' : level.toLowerCase() === 'warning' ? '#f59e0b' : '#3b82f6' }
    }));
    return { backgroundColor: 'transparent', tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, legend: { data: levels, textStyle: { color: '#9ca3af' } }, xAxis: { type: 'category', data: services, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' } }, yAxis: { type: 'value', axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#374151' } } }, series };
  };

  const getLineChartOptions = () => {
    const times = Array.from(new Set(timelineData.map(d => d.timeWindow))).sort();
    const levels = Array.from(new Set(timelineData.map(d => d.level)));
    const series = levels.map(level => ({
      name: level, type: 'line', smooth: true, showSymbol: false, areaStyle: { opacity: 0.1 },
      data: times.map(time => {
        const item = timelineData.find(d => d.timeWindow === time && d.level === level);
        return item ? item.count : 0;
      }),
      itemStyle: { color: level.toLowerCase() === 'error' ? '#ef4444' : level.toLowerCase() === 'critical' ? '#b91c1c' : level.toLowerCase() === 'warning' ? '#f59e0b' : '#3b82f6' },
      lineStyle: { width: 3 }
    }));
    return { backgroundColor: 'transparent', tooltip: { trigger: 'axis' }, legend: { data: levels, textStyle: { color: '#9ca3af' } }, xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' } }, yAxis: { type: 'value', axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#374151' } } }, series };
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

  const MetricBar = ({ label, value, icon: Icon }: { label: string, value: number, icon: any }) => {
    let colorClass = "bg-emerald-500";
    if (value > 85) colorClass = "bg-red-500";
    else if (value > 65) colorClass = "bg-amber-400";
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex justify-between items-center text-xs text-slate-400 font-medium"><span className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</span><span className={value > 85 ? 'text-red-400 font-bold' : ''}>{value.toFixed(1)}%</span></div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
      </div>
    );
  };

  const groupedAgents = agentsData.reduce((acc, curr) => {
    if (!acc[curr.machineName]) acc[curr.machineName] = [];
    acc[curr.machineName].push(curr);
    return acc;
  }, {} as Record<string, AgentStatusItem[]>);

  const isCurrentConfigSaved = savedServers.some(s => s.machineName === scanMachineName && s.ipAddress === targetIp && s.port === targetPort);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">

      {/* MODAL HISTORII */}
      {selectedMachine && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl p-6 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
                  {selectedService ? <Server className="w-6 h-6" /> : <HardDrive className="w-6 h-6" />}
                  {selectedService ? `${selectedService} (${selectedMachine})` : selectedMachine}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-sm text-slate-400">Historia obciążenia z:</p>
                  <select value={historyRange} onChange={(e) => { const r = e.target.value as '1h' | '24h' | '30d'; setHistoryRange(r); fetchHistory(selectedMachine, selectedService, r); }} className="bg-slate-800 text-slate-200 text-xs rounded-md px-2 py-1 border border-slate-700 outline-none focus:border-cyan-500 cursor-pointer">
                    <option value="1h">Ostatnia godzina</option><option value="24h">Ostatnie 24h</option><option value="30d">Ostatni miesiąc</option>
                  </select>
                </div>
              </div>
              <button onClick={() => { setSelectedMachine(null); setSelectedService(null); setHistoryRange('1h'); }} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            {historyLoading ? <div className="h-[400px] flex items-center justify-center text-slate-500">Ładowanie danych...</div> : <ReactECharts option={getHistoryChartOptions()} style={{ height: '400px', width: '100%' }} />}
          </div>
        </div>
      )}

      {/* MODAL SKANERA SIECIOWEGO USŁUG Z PANELEM ULUBIONYCH */}
      {isScanModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl p-6 shadow-2xl flex flex-col max-h-[85vh]">

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-400" /> Skaner Usług Windows
              </h2>
              <button onClick={() => setIsScanModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">

              {/* LEWA KOLUMNA: ULUBIONE SERWERY Z CLICKHOUSE */}
              <div className="w-full md:w-1/3 flex flex-col border border-slate-800 rounded-xl bg-slate-950 p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-400" /> Zapisane Serwery
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                  {savedServers.length === 0 ? (
                    <div className="text-xs text-slate-600 text-center py-6 px-2">
                      Brak zapisanych serwerów.<br />Wpisz dane po prawej i kliknij serduszko, aby zapisać.
                    </div>
                  ) : (
                    savedServers.map((srv, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleFavoriteClick(srv)}
                        className="bg-slate-900 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-cyan-500 hover:bg-slate-800/80 transition-all group flex justify-between items-center shadow-md"
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-200 group-hover:text-cyan-400 transition-colors">{srv.machineName}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{srv.ipAddress}:{srv.port}</div>
                        </div>
                        <button
                          onClick={(e) => removeFavorite(e, srv)}
                          className="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Usuń z zapisanych"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* PRAWA KOLUMNA: FORMULARZ I WYNIKI */}
              <div className="w-full md:w-2/3 flex flex-col min-h-[350px]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Nazwa Maszyny</label>
                    <input type="text" value={scanMachineName} onChange={e => setScanMachineName(e.target.value)} placeholder="np. DESKTOP-XXX" className="w-full mt-1 bg-slate-900 text-xs text-slate-200 rounded-lg px-3 py-2 border border-slate-700 outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Adres IP</label>
                    <input type="text" value={targetIp} onChange={e => setTargetIp(e.target.value)} placeholder="np. 127.0.0.1" className="w-full mt-1 bg-slate-900 text-xs text-slate-200 rounded-lg px-3 py-2 border border-slate-700 outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Port Agenta</label>
                    <div className="flex gap-2 mt-1">
                      <input type="text" value={targetPort} onChange={e => setTargetPort(e.target.value)} placeholder="5001" className="w-full bg-slate-900 text-xs text-slate-200 rounded-lg px-3 py-2 border border-slate-700 outline-none focus:border-cyan-500" />

                      {/* PRZYCISK SERCA */}
                      <button
                        onClick={toggleFavorite}
                        disabled={!scanMachineName || !targetIp || !targetPort}
                        className={`p-2 rounded-lg border transition-colors shrink-0 flex items-center justify-center disabled:opacity-50 ${isCurrentConfigSaved
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-400/50'
                          }`}
                        title="Zapisz do ulubionych"
                      >
                        <Heart className="w-4 h-4" fill={isCurrentConfigSaved ? "currentColor" : "none"} />
                      </button>

                      <button onClick={() => handleScanServer()} disabled={scanLoading || !scanMachineName} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors shrink-0">
                        {scanLoading ? 'Szukam...' : 'Wyszukaj'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 p-2 custom-scrollbar">
                  {scannedServices.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center justify-center h-full">
                      <Search className="w-8 h-8 text-slate-800 mb-3" />
                      <span>Wyszukaj lub wybierz zapisany serwer, aby pobrać listę usług.</span>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase text-slate-400 z-10"><tr><th className="p-3">Śledź</th><th className="p-3">Nazwa Usługi</th><th className="p-3">PID</th><th className="p-3">Stan Windows</th></tr></thead>
                      <tbody className="text-xs font-mono text-slate-300">
                        {scannedServices.map(srv => {
                          const currentMachineServices = groupedAgents[scanMachineName] || [];
                          const isMonitored = currentMachineServices.some(s => s.serviceName === srv.serviceName);
                          return (
                            <tr key={srv.serviceName} className="border-b border-slate-900 hover:bg-slate-900/50 transition-colors">
                              <td className="p-3"><button onClick={() => handleToggleService(srv.serviceName, isMonitored)} className="text-cyan-400 hover:text-cyan-300 transition-colors">{isMonitored ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-600" />}</button></td>
                              <td className="p-3 font-semibold text-slate-200">{srv.serviceName} <span className="font-normal text-slate-500 text-[11px] block">{srv.displayName}</span></td>
                              <td className="p-3 text-cyan-400">{srv.processId > 0 ? srv.processId : '-'}</td>
                              <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] ${srv.state === 'Running' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{srv.state}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* NAGŁÓWEK I ZAKŁADKI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-3"><Activity className="w-8 h-8 text-cyan-400" /><h1 className="text-2xl font-bold tracking-wider">FUMETRICS</h1></div>
        <div className="flex items-center gap-4">
          {activeTab === 'infra' && <button onClick={() => setIsScanModalOpen(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-cyan-900/20"><Search className="w-3.5 h-3.5" /> Skanuj / Dodaj Usługi</button>}
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
            <button onClick={() => setActiveTab('apps')} className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'apps' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>Aplikacje (Logi)</button>
            <button onClick={() => setActiveTab('infra')} className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'infra' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>Infrastruktura</button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl mb-6 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-red-400 shrink-0" /><span>Błąd: {error}</span></div>}

      {/* ZAKŁADKA: APKI */}
      {activeTab === 'apps' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg"><div className="flex items-center justify-between text-slate-400 mb-2"><span>Status Systemu</span><CheckCircle className="w-5 h-5 text-emerald-400" /></div><div className="text-2xl font-semibold text-emerald-400">Aktywny</div></div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg"><div className="flex items-center justify-between text-slate-400 mb-2"><span>Monitorowane Serwisy</span><Server className="w-5 h-5 text-cyan-400" /></div><div className="text-2xl font-semibold">{Array.from(new Set(summaryData.map(d => d.serviceName))).length}</div></div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg"><div className="flex items-center justify-between text-slate-400 mb-2"><span>Wszystkie Zdarzenia</span><Activity className="w-5 h-5 text-purple-400" /></div><div className="text-2xl font-semibold">{summaryData.reduce((acc, curr) => acc + curr.count, 0)}</div></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg"><h2 className="text-lg font-medium mb-4 text-slate-300">Aktywność w czasie (Ostatnie 5 minut)</h2><ReactECharts option={getLineChartOptions()} style={{ height: '350px', width: '100%' }} /></div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg"><h2 className="text-lg font-medium mb-4 text-slate-300">Dystrybucja Logów według Serwisów</h2><ReactECharts option={getBarChartOptions()} style={{ height: '350px', width: '100%' }} /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2 mb-4 text-slate-300"><Terminal className="w-5 h-5 text-cyan-400" /><h2 className="text-lg font-medium">Live Log Stream</h2></div>
            <div className="overflow-x-auto max-h-100 overflow-y-auto rounded-lg border border-slate-800 bg-[#0A0F1C] custom-scrollbar">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-900/80 sticky top-0 z-10 text-xs uppercase text-slate-400 backdrop-blur-sm"><tr><th className="p-4 border-b border-slate-800 font-semibold w-48">Czas (UTC)</th><th className="p-4 border-b border-slate-800 font-semibold w-32">Poziom</th><th className="p-4 border-b border-slate-800 font-semibold w-48">Serwis</th><th className="p-4 border-b border-slate-800 font-semibold">Wiadomość</th></tr></thead>
                <tbody className="text-sm font-mono text-slate-300">
                  {latestLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0">
                      <td className="p-4 text-slate-500">{log.timestamp}</td><td className="p-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${getLevelColor(log.level)}`}>{log.level.toUpperCase()}</span></td><td className="p-4 text-slate-400">{log.serviceName}</td><td className="p-4 truncate max-w-xl">{log.message}</td>
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
            {Object.entries(groupedAgents).length === 0 && <div className="col-span-full text-center text-slate-500 py-12">Brak podłączonych agentów. Uruchom Fumetrics.Agent i zeskanuj usługi!</div>}
            {Object.entries(groupedAgents).map(([machineName, services]) => {
              const machineMetrics = services[0];
              return (
                <div key={machineName} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col hover:border-slate-700 transition-colors">
                  <div onClick={() => fetchHistory(machineName)} className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors" title="Kliknij, aby zobaczyć wykres historyczny serwera">
                    <div className="flex items-center gap-3"><div className="p-2 bg-indigo-500/20 rounded-lg"><HardDrive className="w-6 h-6 text-indigo-400" /></div><div><h3 className="font-bold text-lg">{machineName}</h3><p className="text-xs text-slate-400">{machineMetrics?.osVersion}</p></div></div>
                    {services.some(s => s.state.toUpperCase() !== 'RUNNING') && <div title="Niektóre usługi są zatrzymane!"><ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" /></div>}
                  </div>
                  <div className="p-5 bg-slate-950/30 border-b border-slate-800 grid grid-cols-3 gap-4">
                    <MetricBar label="CPU" value={machineMetrics?.machineCpu || 0} icon={Cpu} />
                    <MetricBar label="RAM" value={machineMetrics?.machineRam || 0} icon={Activity} />
                    <MetricBar label="Dysk" value={machineMetrics?.machineDisk || 0} icon={HardDrive} />
                  </div>
                  <div className="p-5 flex-1 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Monitorowane Usługi</p>
                    <div className="space-y-2">
                      {services.map(srv => (
                        <div key={srv.serviceName} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800/50 group">
                          <div className="flex flex-col cursor-pointer hover:text-cyan-400 transition-colors" onClick={() => fetchHistory(machineName, srv.serviceName)} title="Pokaż wykres historii tej usługi">
                            <span className="font-mono text-xs font-bold text-slate-200 group-hover:text-cyan-400">{srv.serviceName}</span>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-blue-400" /> {srv.serviceCpu || 0}%</span>
                              <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3 text-emerald-400" /> {srv.serviceRam || 0} MB</span>
                              <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-purple-400" /> {srv.serviceDisk || 0} MB/s</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2"><span className="text-[10px] font-medium text-slate-500 uppercase">{srv.state}</span><div className={`w-2.5 h-2.5 rounded-full ${getStateColor(srv.state)}`} /></div>
                            <button onClick={() => handleRemoveServiceDirectly(machineName, srv.serviceName)} className="text-slate-600 hover:text-red-400 transition-colors p-1" title="Przestań monitorować"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950 text-[11px] text-center text-slate-500 border-t border-slate-800">
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