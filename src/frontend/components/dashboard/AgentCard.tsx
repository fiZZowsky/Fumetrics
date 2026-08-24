import { useState, useEffect } from 'react';
import { Cpu, HardDrive, MemoryStick, Play, RefreshCw, ShieldAlert, Square, Trash2, Activity, AlertTriangle, Plus, X, LineChart } from 'lucide-react';
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
  onOpenMetrics?: () => void;
}

export function AgentCard({ machineName, services, tags = [], onOpenHistory, onServiceAction, onRemoveService, onRefreshData, onOpenMetrics }: AgentCardProps) {
  const machineMetrics = services[0];
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => { const int = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(int); }, []);

  const getStateColor = (state: string) => {
    const s = state.toUpperCase();
    if (s === 'RUNNING') return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    if (s === 'STOPPED' || s === 'FAILED') return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
  };

  const isAgentOffline = () => {
    if (!machineMetrics?.lastUpdated || machineMetrics.lastUpdated === 'Teraz' || machineMetrics.lastUpdated === 'Brak danych') return false;
    try {
      const d = machineMetrics.lastUpdated.replace(' ', 'T');
      const time = new Date(d.endsWith('Z') || d.includes('+') || d.includes('-', 10) ? d : d + 'Z').getTime();
      if (isNaN(time)) return false;
      return Math.floor((new Date().getTime() - time) / 1000) > 30;
    } catch { return false; }
  };

  const offline = isAgentOffline();
  const formatLastUpdated = (s?: string) => s && s !== 'Brak danych' && s !== 'Teraz' && s.indexOf('.') !== -1 ? s.substring(0, s.indexOf('.')) : s || 'Brak danych';

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;
    try { await fetch(`http://${window.location.hostname}:5170/api/metrics/machines/tags`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineName, tag: newTagInput.trim() }) }); setNewTagInput(''); setIsAddingTag(false); onRefreshData(); } catch {}
  };
  const handleRemoveTag = async (tag: string) => {
    try { await fetch(`http://${window.location.hostname}:5170/api/metrics/machines/tags/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineName, tag }) }); onRefreshData(); } catch {}
  };

  return (
    <div className={`bg-white dark:bg-[#121A2F] border ${offline ? 'border-amber-200 dark:border-amber-900/50' : 'border-slate-200 dark:border-slate-800/60'} rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50 overflow-hidden flex flex-col hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-all duration-300 relative group`}>
      
      <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-900/30 backdrop-blur-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group/title" onClick={() => onOpenHistory(machineName)} title="Wykres historyczny serwera">
            <div className={`p-3 rounded-2xl transition-colors ${offline ? 'bg-slate-100 dark:bg-slate-800' : 'bg-indigo-50 dark:bg-indigo-500/10 group-hover/title:bg-indigo-100 dark:group-hover/title:bg-indigo-500/20'}`}>
              <HardDrive className={`w-7 h-7 ${offline ? 'text-slate-400 dark:text-slate-500' : 'text-indigo-600 dark:text-indigo-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-extrabold text-xl ${offline ? 'text-slate-400 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{machineName}</h3>
                {offline && <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse drop-shadow-md" />}
              </div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{machineMetrics?.osVersion}</p>
            </div>
          </div>
          {!offline && services.some(s => s.state.toUpperCase() !== 'RUNNING' && s.serviceName !== '*') && <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse drop-shadow-md" />}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {tags.map(tag => (
            <span key={tag} className="bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 text-[10px] font-bold px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-sm group/tag">
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="text-slate-400 hover:text-rose-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
          {!isAddingTag ? (
            <button onClick={() => setIsAddingTag(true)} className="text-[10px] font-bold text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 bg-white dark:bg-[#0A0F1C] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-1 shadow-sm transition-all">
              <Plus className="w-3.5 h-3.5" /> Dodaj
            </button>
          ) : (
            <form onSubmit={handleAddTag} className="flex items-center gap-1">
              <input type="text" value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="Tag..." className="bg-white dark:bg-[#0A0F1C] text-xs font-bold text-slate-700 dark:text-slate-200 px-3 py-1 rounded-lg border border-cyan-500 outline-none w-24 shadow-sm" autoFocus onBlur={() => setIsAddingTag(false)} />
            </form>
          )}
        </div>
      </div>

      <div className={`p-6 bg-white dark:bg-[#0A0F1C]/30 border-b border-slate-100 dark:border-slate-800/60 ${offline ? 'opacity-40 grayscale' : ''} transition-all`}>
        <div className="grid grid-cols-3 gap-6">
          <MetricBar label="CPU" value={machineMetrics?.machineCpu || 0} icon={Cpu} />
          <MetricBar label="RAM" value={machineMetrics?.machineRam || 0} icon={Activity} />
          <MetricBar label="Dysk" value={machineMetrics?.machineDisk || 0} icon={HardDrive} />
        </div>
        
        <button 
          onClick={onOpenMetrics}
          className="w-full mt-5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <LineChart className="w-4 h-4" /> Historia Wydajności
        </button>
      </div>

      <div className={`p-6 flex-1 space-y-4 ${offline ? 'opacity-60' : ''} transition-opacity`}>
        <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Śledzone Usługi</p>
        <div className="space-y-3">
          {services.map(srv => {
            const isHost = srv.serviceName === '*';
            return (
            <div key={srv.serviceName} className="flex items-center justify-between bg-slate-50 dark:bg-[#0A0F1C] p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm group/srv hover:border-cyan-200 dark:hover:border-cyan-500/30 transition-all">
              <div className="flex flex-col cursor-pointer transition-colors" onClick={() => onOpenHistory(machineName, isHost ? undefined : srv.serviceName)}>
                <span className={`font-mono text-sm font-bold ${isHost ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'} group-hover/srv:text-cyan-600 dark:group-hover/srv:text-cyan-400`}>
                  {isHost ? '🌟 CAŁA MASZYNA' : srv.serviceName}
                </span>
                {!isHost && (
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> {srv.serviceCpu || 0}%</span>
                    <span className="flex items-center gap-1"><MemoryStick className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> {srv.serviceRam || 0} MB</span>
                    <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" /> {srv.serviceDisk || 0} MB/s</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {!isHost && (
                  <div className="flex items-center gap-2 mr-3 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">{offline ? 'OFFLINE' : srv.state}</span>
                    <div className={`w-2.5 h-2.5 rounded-full ${offline ? 'bg-amber-500 animate-pulse' : getStateColor(srv.state)}`} />
                  </div>
                )}
                
                <div className="flex items-center gap-1">
                  {!isHost && !offline && srv.state.toUpperCase() !== 'RUNNING' && <button onClick={() => onServiceAction(machineName, srv.serviceName, 'start')} className="text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 p-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800" title="Uruchom"><Play className="w-4 h-4" /></button>}
                  {!isHost && !offline && srv.state.toUpperCase() === 'RUNNING' && (
                    <><button onClick={() => onServiceAction(machineName, srv.serviceName, 'stop')} className="text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 p-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800" title="Zatrzymaj"><Square className="w-4 h-4" /></button><button onClick={() => onServiceAction(machineName, srv.serviceName, 'restart')} className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 p-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800" title="Restart"><RefreshCw className="w-4 h-4" /></button></>
                  )}
                  <button onClick={() => onRemoveService(machineName, srv.serviceName)} className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 ml-1" title="Przestań monitorować"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>
      
      <div className={`p-3 bg-slate-50 dark:bg-[#0A0F1C]/50 text-xs font-semibold text-center border-t border-slate-100 dark:border-slate-800/60 ${offline ? 'text-amber-600 dark:text-amber-500/80' : 'text-slate-400 dark:text-slate-500'}`}>
        Ost. synchronizacja: {formatLastUpdated(machineMetrics?.lastUpdated)} {offline && '(Offline)'}
      </div>
    </div>
  );
}