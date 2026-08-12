import { Cpu, HardDrive, MemoryStick, Play, RefreshCw, ShieldAlert, Square, Trash2, Activity } from 'lucide-react';
import { MetricBar } from '../ui/MetricBar';
import { AgentStatusItem } from '@/types/fumetrics';

interface AgentCardProps {
  machineName: string;
  services: AgentStatusItem[];
  onOpenHistory: (machineName: string, serviceName?: string) => void;
  onServiceAction: (machineName: string, serviceName: string, action: 'start' | 'stop' | 'restart') => void;
  onRemoveService: (machineName: string, serviceName: string) => void;
}

export function AgentCard({ machineName, services, onOpenHistory, onServiceAction, onRemoveService }: AgentCardProps) {
  const machineMetrics = services[0];

  const getStateColor = (state: string) => {
    const s = state.toUpperCase();
    if (s === 'RUNNING') return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    if (s === 'STOPPED' || s === 'FAILED') return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col hover:border-slate-700 transition-colors">
      <div onClick={() => onOpenHistory(machineName)} className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors" title="Kliknij, aby zobaczyć wykres historyczny serwera">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg"><HardDrive className="w-6 h-6 text-indigo-400" /></div>
          <div><h3 className="font-bold text-lg">{machineName}</h3><p className="text-xs text-slate-400">{machineMetrics?.osVersion}</p></div>
        </div>
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
              <div className="flex flex-col cursor-pointer hover:text-cyan-400 transition-colors" onClick={() => onOpenHistory(machineName, srv.serviceName)} title="Pokaż wykres historii tej usługi">
                <span className="font-mono text-xs font-bold text-slate-200 group-hover:text-cyan-400">{srv.serviceName}</span>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-blue-400" /> {srv.serviceCpu || 0}%</span>
                  <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3 text-emerald-400" /> {srv.serviceRam || 0} MB</span>
                  <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-purple-400" /> {srv.serviceDisk || 0} MB/s</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-2 mr-2"><span className="text-[10px] font-medium text-slate-500 uppercase">{srv.state}</span><div className={`w-2.5 h-2.5 rounded-full ${getStateColor(srv.state)}`} /></div>
                <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                  {srv.state.toUpperCase() !== 'RUNNING' && <button onClick={() => onServiceAction(machineName, srv.serviceName, 'start')} className="text-slate-500 hover:text-emerald-400 p-1"><Play className="w-3.5 h-3.5" /></button>}
                  {srv.state.toUpperCase() === 'RUNNING' && (
                    <><button onClick={() => onServiceAction(machineName, srv.serviceName, 'stop')} className="text-slate-500 hover:text-amber-400 p-1"><Square className="w-3.5 h-3.5" /></button><button onClick={() => onServiceAction(machineName, srv.serviceName, 'restart')} className="text-slate-500 hover:text-blue-400 p-1"><RefreshCw className="w-3.5 h-3.5" /></button></>
                  )}
                  <button onClick={() => onRemoveService(machineName, srv.serviceName)} className="text-slate-600 hover:text-rose-400 p-1 ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-2.5 bg-slate-950 text-[11px] text-center text-slate-500 border-t border-slate-800">Ost. synchronizacja: {machineMetrics?.lastUpdated}</div>
    </div>
  );
}