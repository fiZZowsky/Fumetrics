import { useState, useEffect } from 'react';
import { Cpu, HardDrive, MemoryStick, Play, RefreshCw, ShieldAlert, Square, Trash2, Activity, AlertTriangle, Plus, X } from 'lucide-react';
import { MetricBar } from '../ui/MetricBar';
import { AgentStatusItem } from '@/types/fumetrics';

interface AgentCardProps {
  machineName: string;
  services: AgentStatusItem[];
  tags: string[];
  onOpenHistory: (machineName: string, serviceName?: string) => void;
  onServiceAction: (machineName: string, serviceName: string, action: 'start' | 'stop' | 'restart') => void;
  onRemoveService: (machineName: string, serviceName: string) => void;
  onRefreshData: () => void;
}

export function AgentCard({ machineName, services, tags = [], onOpenHistory, onServiceAction, onRemoveService, onRefreshData }: AgentCardProps) {
  const machineMetrics = services[0];
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const getStateColor = (state: string) => {
    const s = state.toUpperCase();
    if (s === 'RUNNING') return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    if (s === 'STOPPED' || s === 'FAILED') return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
  };

  const isAgentOffline = () => {
    if (!machineMetrics?.lastUpdated || machineMetrics.lastUpdated === 'Teraz' || machineMetrics.lastUpdated === 'Brak danych') return false;
    try {
      const dateStr = machineMetrics.lastUpdated.replace(' ', 'T');
      const utcDateStr = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('-', 10) ? dateStr : dateStr + 'Z';
      const lastUpdateDate = new Date(utcDateStr);
      if (isNaN(lastUpdateDate.getTime())) return false;
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - lastUpdateDate.getTime()) / 1000);
      return diffInSeconds > 30;
    } catch {
      return false;
    }
  };

  const offline = isAgentOffline();

  const formatLastUpdated = (dateString?: string) => {
    if (!dateString || dateString === 'Brak danych' || dateString === 'Teraz') return dateString || 'Brak danych';
    const dotIndex = dateString.indexOf('.');
    if (dotIndex !== -1) {
      return dateString.substring(0, dotIndex);
    }
    return dateString;
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/machines/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineName, tag: newTagInput.trim() })
      });
      setNewTagInput('');
      setIsAddingTag(false);
      onRefreshData();
    } catch (err) {
      console.error("Błąd dodawania tagu", err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/machines/tags/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineName, tag: tagToRemove })
      });
      onRefreshData();
    } catch (err) {
      console.error("Błąd usuwania tagu", err);
    }
  };

  return (
    <div className={`bg-slate-900 border ${offline ? 'border-amber-900/50' : 'border-slate-800'} rounded-2xl shadow-lg overflow-hidden flex flex-col hover:border-slate-700 transition-colors relative`}>
      
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onOpenHistory(machineName)} title="Kliknij, aby zobaczyć wykres historyczny serwera">
            <div className={`p-2 rounded-lg transition-colors ${offline ? 'bg-slate-800' : 'bg-indigo-500/20'}`}>
              <HardDrive className={`w-6 h-6 ${offline ? 'text-slate-500' : 'text-indigo-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-lg ${offline ? 'text-slate-300' : 'text-white'}`}>{machineName}</h3>
                {offline && (
                  <div title="Agent nie odpowiedział na 3 kolejne próby synchronizacji (>30s).">
                    <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400">{machineMetrics?.osVersion}</p>
            </div>
          </div>
          {!offline && services.some(s => s.state.toUpperCase() !== 'RUNNING' && s.serviceName !== '*') && (
            <div title="Niektóre usługi są zatrzymane!"><ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" /></div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {tags.map(tag => (
            <span key={tag} className="bg-slate-800 text-cyan-400 text-[10px] font-medium px-2.5 py-0.5 rounded-full border border-slate-700 flex items-center gap-1 group/tag">
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="text-slate-400 hover:text-rose-400 transition-colors" title="Usuń tag">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {!isAddingTag ? (
            <button onClick={() => setIsAddingTag(true)} className="text-[10px] text-slate-500 hover:text-cyan-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 flex items-center gap-1 transition-colors">
              <Plus className="w-3 h-3" /> Dodaj tag
            </button>
          ) : (
            <form onSubmit={handleAddTag} className="flex items-center gap-1">
              <input 
                type="text" 
                value={newTagInput} 
                onChange={e => setNewTagInput(e.target.value)} 
                placeholder="np. Produkcja" 
                className="bg-slate-950 text-xs text-slate-100 px-2 py-0.5 rounded border border-cyan-600 outline-none w-24"
                autoFocus
                onBlur={() => setIsAddingTag(false)}
              />
            </form>
          )}
        </div>
      </div>

      <div className={`p-5 bg-slate-950/30 border-b border-slate-800 grid grid-cols-3 gap-4 ${offline ? 'opacity-40 grayscale' : ''} transition-all`}>
        <MetricBar label="CPU" value={machineMetrics?.machineCpu || 0} icon={Cpu} />
        <MetricBar label="RAM" value={machineMetrics?.machineRam || 0} icon={Activity} />
        <MetricBar label="Dysk" value={machineMetrics?.machineDisk || 0} icon={HardDrive} />
      </div>

      <div className={`p-5 flex-1 space-y-3 ${offline ? 'opacity-60' : ''} transition-opacity`}>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Monitorowane Usługi</p>
        <div className="space-y-2">
          {services.map(srv => {
            const isHost = srv.serviceName === '*';
            return (
            <div key={srv.serviceName} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800/50 group">
              <div className="flex flex-col cursor-pointer hover:text-cyan-400 transition-colors" onClick={() => onOpenHistory(machineName, isHost ? undefined : srv.serviceName)}>
                <span className={`font-mono text-xs font-bold ${isHost ? 'text-indigo-400' : 'text-slate-200'} group-hover:text-cyan-400`}>
                  {isHost ? '🌟 CAŁA MASZYNA' : srv.serviceName}
                </span>
                {!isHost && (
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-blue-400" /> {srv.serviceCpu || 0}%</span>
                    <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3 text-emerald-400" /> {srv.serviceRam || 0} MB</span>
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-purple-400" /> {srv.serviceDisk || 0} MB/s</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1.5">
                {!isHost && (
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-[10px] font-medium text-slate-500 uppercase">{offline ? 'NIEDOSTĘPNY' : srv.state}</span>
                    <div className={`w-2.5 h-2.5 rounded-full ${offline ? 'bg-amber-500 animate-pulse' : getStateColor(srv.state)}`} />
                  </div>
                )}
                
                <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                  {!isHost && !offline && srv.state.toUpperCase() !== 'RUNNING' && <button onClick={() => onServiceAction(machineName, srv.serviceName, 'start')} className="text-slate-500 hover:text-emerald-400 p-1" title="Uruchom"><Play className="w-3.5 h-3.5" /></button>}
                  {!isHost && !offline && srv.state.toUpperCase() === 'RUNNING' && (
                    <><button onClick={() => onServiceAction(machineName, srv.serviceName, 'stop')} className="text-slate-500 hover:text-amber-400 p-1" title="Zatrzymaj"><Square className="w-3.5 h-3.5" /></button><button onClick={() => onServiceAction(machineName, srv.serviceName, 'restart')} className="text-slate-500 hover:text-blue-400 p-1" title="Restart"><RefreshCw className="w-3.5 h-3.5" /></button></>
                  )}
                  <button onClick={() => onRemoveService(machineName, srv.serviceName)} className="text-slate-600 hover:text-rose-400 p-1 ml-1" title="Przestań monitorować"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>
      
      <div className={`p-2.5 bg-slate-950 text-[11px] text-center border-t border-slate-800 ${offline ? 'text-amber-500/80 font-medium' : 'text-slate-500'}`}>
        Ost. synchronizacja: {formatLastUpdated(machineMetrics?.lastUpdated)} {offline && '(Offline)'}
      </div>
    </div>
  );
}