'use client';

import { useState } from 'react';
import { Activity, Bell, Search, AlertTriangle } from 'lucide-react';
import { useFumetricsData } from '@/hooks/useFumetricsData';
import { AppsTab } from '@/components/dashboard/AppsTab';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { HistoryModal } from '@/components/modals/HistoryModal';
import { ScannerModal } from '@/components/modals/ScannerModal';
import { AlertsModal } from '@/components/modals/AlertsModal';
import { AgentStatusItem } from '@/types/fumetrics';

export default function Dashboard() {
  const { summaryData, timelineData, latestLogs, agentsData, setAgentsData, fetchData, error } = useFumetricsData();
  const [activeTab, setActiveTab] = useState<'apps' | 'infra'>('infra');

  // Stany Modali
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ machine: string, service?: string | null } | null>(null);

  const groupedAgents = agentsData.reduce((acc, curr) => {
    if (!acc[curr.machineName]) acc[curr.machineName] = [];
    acc[curr.machineName].push(curr);
    return acc;
  }, {} as Record<string, AgentStatusItem[]>);

  const handleToggleService = async (machineName: string, serviceName: string, isCurrentlyMonitored: boolean) => {
    const endpointPath = isCurrentlyMonitored ? 'config-services/remove' : 'config-services';
    if (isCurrentlyMonitored) {
      setAgentsData(prev => prev.filter(srv => !(srv.machineName === machineName && srv.serviceName === serviceName)));
    } else {
      setAgentsData(prev => [...prev, { machineName, osVersion: 'Oczekiwanie...', serviceName, state: 'OCZEKIWANIE', lastUpdated: 'Teraz', machineCpu: 0, machineRam: 0, machineDisk: 0, serviceCpu: 0, serviceRam: 0, serviceDisk: 0 }]);
    }
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/agents/${endpointPath}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineName, serviceName })
      });
    } catch { fetchData(); }
  };

  const handleRemoveService = async (machineName: string, serviceName: string) => {
    setAgentsData(prev => prev.filter(srv => !(srv.machineName === machineName && srv.serviceName === serviceName)));
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/agents/config-services/remove`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineName, serviceName })
      });
    } catch { fetchData(); }
  };

const handleServiceAction = async (machineName: string, serviceName: string, action: 'start' | 'stop' | 'restart') => {
    setAgentsData(prev => prev.map(s => 
      (s.machineName === machineName && s.serviceName === serviceName) 
        ? { ...s, state: 'OCZEKIWANIE' } 
        : s
    ));

    try {
      const response = await fetch(`http://${machineName}:5001/api/agent/services/${serviceName}/${action}`, { 
        method: 'POST' 
      });

      if (!response.ok) {
        throw new Error('Agent odrzucił żądanie');
      }
    } catch (error) { 
      console.error(`Nie udało się wykonać akcji '${action}' na serwerze ${machineName}:`, error);
      alert(`Nie udało się połączyć z agentem na maszynie ${machineName}. Upewnij się, że komputer jest włączony i Agent działa.`);
      fetchData();
    }
  };

  const uniqueMachines = Array.from(new Set(agentsData.map(a => a.machineName)));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      
      {/* NAGŁÓWEK */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-3"><Activity className="w-8 h-8 text-cyan-400" /><h1 className="text-2xl font-bold tracking-wider">FUMETRICS</h1></div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsAlertModalOpen(true)} className="bg-amber-600/20 text-amber-500 border border-amber-600/30 hover:bg-amber-600/30 text-xs px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Alerty E-mail</button>
          {activeTab === 'infra' && <button onClick={() => setIsScanModalOpen(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-cyan-900/20"><Search className="w-3.5 h-3.5" /> Skanuj / Dodaj Usługi</button>}
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
            <button onClick={() => setActiveTab('apps')} className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'apps' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>Aplikacje (Logi)</button>
            <button onClick={() => setActiveTab('infra')} className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'infra' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>Infrastruktura</button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl mb-6 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-red-400 shrink-0" /><span>Błąd: {error}</span></div>}

      {/* ZAKŁADKI */}
      {activeTab === 'apps' && <AppsTab summaryData={summaryData} timelineData={timelineData} latestLogs={latestLogs} />}
      
      {activeTab === 'infra' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {Object.entries(groupedAgents).length === 0 && <div className="col-span-full text-center text-slate-500 py-12">Brak agentów. Zeskanuj usługi!</div>}
          {Object.entries(groupedAgents).map(([machineName, services]) => (
            <AgentCard 
              key={machineName} 
              machineName={machineName} 
              services={services} 
              onOpenHistory={(m, s) => setHistoryTarget({ machine: m, service: s })}
              onServiceAction={handleServiceAction}
              onRemoveService={handleRemoveService}
            />
          ))}
        </div>
      )}

      {/* MODALE */}
      {historyTarget && <HistoryModal machineName={historyTarget.machine} serviceName={historyTarget.service} onClose={() => setHistoryTarget(null)} />}
      {isScanModalOpen && <ScannerModal groupedAgents={groupedAgents} onClose={() => setIsScanModalOpen(false)} onToggleService={handleToggleService} />}
      {isAlertModalOpen && <AlertsModal uniqueMachines={uniqueMachines} groupedAgents={groupedAgents} onClose={() => setIsAlertModalOpen(false)} />}
    </main>
  );
}