'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Bell, Search, AlertTriangle, Tag, CheckCircle2, XCircle, Sun, Moon, Clock } from 'lucide-react';
import { useFumetricsData } from '@/hooks/useFumetricsData';
import { AppsTab } from '@/components/dashboard/AppsTab';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { AuditTab } from '@/components/dashboard/AuditTab';
import { HistoryModal } from '@/components/modals/HistoryModal';
import { ScannerModal } from '@/components/modals/ScannerModal';
import { AlertsModal } from '@/components/modals/AlertsModal';
import { AgentStatusItem } from '@/types/fumetrics';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { LiveAlertsWidget } from '@/components/dashboard/LiveAlertsWidget';
import { AlertHistoryModal } from '@/components/modals/AlertHistoryModal';
import { MetricsHistoryModal } from '@/components/modals/MetricsHistoryModal';

function DashboardContent() {
  const { summaryData, timelineData, latestLogs, agentsData, setAgentsData, fetchData, error } = useFumetricsData();
  const [activeTab, setActiveTab] = useState<'apps' | 'infra' | 'audit'>('infra');
  const { theme, toggleTheme } = useTheme();

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ machine: string, service?: string | null } | null>(null);
  const [isAlertHistoryModalOpen, setIsAlertHistoryModalOpen] = useState(false);
  const [metricsTargetMachine, setMetricsTargetMachine] = useState<string | null>(null);

  const [machineTags, setMachineTags] = useState<Record<string, string[]>>({});
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/machines/tags`);
      if (res.ok) setMachineTags(await res.json());
    } catch (err) {}
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const groupedAgents = agentsData.reduce((acc, curr) => {
    if (!acc[curr.machineName]) acc[curr.machineName] = [];
    acc[curr.machineName].push(curr);
    return acc;
  }, {} as Record<string, AgentStatusItem[]>);

  const allUniqueTags = Array.from(new Set(Object.values(machineTags).flat()));

  const isMachineOffline = (services: AgentStatusItem[]) => {
    const machineMetrics = services[0];
    if (!machineMetrics?.lastUpdated || machineMetrics.lastUpdated === 'Teraz' || machineMetrics.lastUpdated === 'Brak danych') return false;
    try {
      const dateStr = machineMetrics.lastUpdated.replace(' ', 'T');
      const utcDateStr = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('-', 10) ? dateStr : dateStr + 'Z';
      const lastUpdateDate = new Date(utcDateStr);
      if (isNaN(lastUpdateDate.getTime())) return false;
      const now = new Date();
      return Math.floor((now.getTime() - lastUpdateDate.getTime()) / 1000) > 30;
    } catch { return false; }
  };

  const filteredGroupedAgents = Object.entries(groupedAgents).filter(([machineName, services]) => {
    if (selectedTagFilter !== 'all' && !(machineTags[machineName] || []).includes(selectedTagFilter)) return false;
    const offline = isMachineOffline(services);
    if (selectedStatusFilter === 'active' && offline) return false;
    if (selectedStatusFilter === 'inactive' && !offline) return false;
    return true;
  });

  const handleToggleService = async (machineName: string, serviceName: string, isCurrentlyMonitored: boolean) => {
    const endpointPath = isCurrentlyMonitored ? 'config-services/remove' : 'config-services';
    if (isCurrentlyMonitored) setAgentsData(prev => prev.filter(srv => !(srv.machineName === machineName && srv.serviceName === serviceName)));
    else setAgentsData(prev => [...prev, { machineName, osVersion: 'Oczekiwanie...', serviceName, state: 'OCZEKIWANIE', lastUpdated: 'Teraz', machineCpu: 0, machineRam: 0, machineDisk: 0, serviceCpu: 0, serviceRam: 0, serviceDisk: 0 }]);
    try { await fetch(`http://${window.location.hostname}:5170/api/metrics/agents/${endpointPath}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineName, serviceName }) }); } catch { fetchData(); }
  };

  const handleRemoveService = async (machineName: string, serviceName: string) => {
    setAgentsData(prev => prev.filter(srv => !(srv.machineName === machineName && srv.serviceName === serviceName)));
    try { await fetch(`http://${window.location.hostname}:5170/api/metrics/agents/config-services/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineName, serviceName }) }); } catch { fetchData(); }
  };

  const handleServiceAction = async (machineName: string, serviceName: string, action: 'start' | 'stop' | 'restart') => {
    setAgentsData(prev => prev.map(s => (s.machineName === machineName && s.serviceName === serviceName) ? { ...s, state: 'OCZEKIWANIE' } : s));
    try {
      const response = await fetch(`http://${machineName}:5001/api/agent/services/${serviceName}/${action}`, { method: 'POST' });
      if (!response.ok) throw new Error('Agent odrzucił żądanie');
      fetch(`http://${window.location.hostname}:5170/api/metrics/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action.toUpperCase(), targetMachine: machineName, targetService: serviceName }) }).catch(()=>{});
    } catch { fetchData(); }
  };

  const uniqueMachines = Array.from(new Set(agentsData.map(a => a.machineName)));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0B101E] dark:text-slate-100 p-8 transition-colors duration-300 font-sans">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-linear-to-br from-cyan-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-cyan-500/30">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider bg-clip-text text-transparent bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">FUMETRICS</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 shadow-sm transition-all">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button onClick={() => setIsAlertModalOpen(true)} className="bg-amber-100 dark:bg-amber-600/20 text-amber-700 dark:text-amber-500 border border-amber-200 dark:border-amber-600/30 hover:bg-amber-200 dark:hover:bg-amber-600/30 text-xs px-4 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-1.5 shadow-sm">
            <Bell className="w-4 h-4" /> Alerty
          </button>
          
          <button onClick={() => setIsAlertHistoryModalOpen(true)} className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 text-xs px-4 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-1.5 shadow-sm">
            <Clock className="w-4 h-4" /> Historia Alertów
          </button>

          {activeTab === 'infra' && (
            <button onClick={() => setIsScanModalOpen(true)} className="bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-900/20">
              <Search className="w-4 h-4" /> Skanuj Usługi
            </button>
          )}

          <div className="flex bg-white dark:bg-[#121A2F] rounded-xl p-1 border border-slate-200 dark:border-slate-800 shadow-sm">
            <button onClick={() => setActiveTab('apps')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'apps' ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Strumień Logów</button>
            <button onClick={() => setActiveTab('infra')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'infra' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Serwery</button>
            <button onClick={() => setActiveTab('audit')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'audit' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Historia Operacji</button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 p-4 rounded-2xl mb-6 flex items-center gap-3 shadow-sm"><AlertTriangle className="w-5 h-5 shrink-0" /><span>Błąd: {error}</span></div>}

      {activeTab === 'apps' && <AppsTab summaryData={summaryData} timelineData={timelineData} latestLogs={latestLogs} />}
      {activeTab === 'audit' && <AuditTab />}
      
      {activeTab === 'infra' && (
        <div className="space-y-6">
          
          <div className="w-full">
            <LiveAlertsWidget />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 dark:bg-[#121A2F]/60 backdrop-blur-md px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2 uppercase tracking-wider">Status:</span>
              <button onClick={() => setSelectedStatusFilter('all')} className={`text-xs px-4 py-2 rounded-xl font-bold transition-all ${selectedStatusFilter === 'all' ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 shadow-sm' : 'bg-slate-50 dark:bg-[#0A0F1C] text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-800'}`}>Wszystkie</button>
              <button onClick={() => setSelectedStatusFilter('active')} className={`text-xs px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${selectedStatusFilter === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shadow-sm' : 'bg-slate-50 dark:bg-[#0A0F1C] text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-800'}`}><CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Aktywne</button>
              <button onClick={() => setSelectedStatusFilter('inactive')} className={`text-xs px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${selectedStatusFilter === 'inactive' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 shadow-sm' : 'bg-slate-50 dark:bg-[#0A0F1C] text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-800'}`}><XCircle className="w-4 h-4 text-amber-500" /> Nieaktywne</button>
            </div>

            {allUniqueTags.length > 0 && (
              <div className="flex items-center gap-3">
                <Tag className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                <select value={selectedTagFilter} onChange={(e) => setSelectedTagFilter(e.target.value)} className="bg-slate-50 dark:bg-[#0A0F1C] font-semibold text-xs text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-cyan-500 transition-colors cursor-pointer shadow-sm">
                  <option value="all">Wszystkie tagi</option>
                  {allUniqueTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {filteredGroupedAgents.length === 0 && <div className="col-span-full text-center text-slate-500 py-12">Brak agentów. Użyj skanera!</div>}
            {filteredGroupedAgents.map(([machineName, services]) => (
              <AgentCard 
                key={machineName} 
                machineName={machineName} 
                services={services} 
                tags={machineTags[machineName] || []} 
                onOpenHistory={(m, s) => setHistoryTarget({ machine: m, service: s })} 
                onServiceAction={handleServiceAction} 
                onRemoveService={handleRemoveService} 
                onRefreshData={() => { fetchData(); fetchTags(); }} 
                onOpenMetrics={() => setMetricsTargetMachine(machineName)}
              />
            ))}
          </div>
        </div>
      )}

      {historyTarget && <HistoryModal machineName={historyTarget.machine} serviceName={historyTarget.service} onClose={() => setHistoryTarget(null)} />}
      {isScanModalOpen && <ScannerModal groupedAgents={groupedAgents} onClose={() => setIsScanModalOpen(false)} onToggleService={handleToggleService} />}
      {isAlertModalOpen && <AlertsModal uniqueMachines={uniqueMachines} groupedAgents={groupedAgents} onClose={() => setIsAlertModalOpen(false)} />}
      {isAlertHistoryModalOpen && <AlertHistoryModal onClose={() => setIsAlertHistoryModalOpen(false)} />}
      {metricsTargetMachine && (
        <MetricsHistoryModal 
          machineName={metricsTargetMachine} 
          onClose={() => setMetricsTargetMachine(null)} 
        />
      )}
    </main>
  );
}

export default function Dashboard() {
  return (
    <ThemeProvider>
      <DashboardContent />
    </ThemeProvider>
  );
}