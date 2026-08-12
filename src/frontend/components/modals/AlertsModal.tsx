import { useState, useEffect } from 'react';
import { Bell, X, Trash2, Edit2, Server } from 'lucide-react';
import { AlertRule, AgentStatusItem } from '@/types/fumetrics';

interface AlertsModalProps {
  uniqueMachines: string[];
  groupedAgents: Record<string, AgentStatusItem[]>;
  onClose: () => void;
}

export function AlertsModal({ uniqueMachines, groupedAgents, onClose }: AlertsModalProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [newRule, setNewRule] = useState<AlertRule>({ machineName: '', serviceName: '', metric: 'State', threshold: 'STOPPED', email: '', cooldownMinutes: 15 });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts`);
      if (res.ok) setRules(await res.json());
    } catch {}
  };

  useEffect(() => { fetchRules(); }, []);

  const saveRule = async () => {
    if (!newRule.machineName || !newRule.serviceName || !newRule.email || !newRule.threshold) {
      alert("Wypełnij wszystkie wymagane pola alertu!"); return;
    }
    try {
      const method = editingId ? 'PUT' : 'POST';
      await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts`, { 
        method, 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(newRule) 
      });
      cancelEdit();
      fetchRules();
    } catch {}
  };

  const removeRule = async (id: string) => {
    if(!confirm("Czy na pewno chcesz usunąć ten alert?")) return;
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts/${id}`, { method: 'DELETE' });
      fetchRules();
    } catch {}
  };

  const editRule = (rule: AlertRule) => {
    setNewRule(rule);
    setEditingId(rule.id!);
  };

  const cancelEdit = () => {
    setNewRule({ machineName: '', serviceName: '', metric: 'State', threshold: 'STOPPED', email: '', cooldownMinutes: 15 });
    setEditingId(null);
  };

  const isMachineLevel = newRule.serviceName === '*';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Bell className="w-6 h-6 text-amber-400" /> Konfiguracja Powiadomień Email</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><X className="w-6 h-6" /></button>
        </div>
        
        <div className={`border p-4 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 transition-colors ${editingId ? 'bg-amber-950/20 border-amber-800/50' : 'bg-slate-950 border-slate-800'}`}>
           <div>
             <label className="text-[11px] text-slate-400 uppercase">Serwer</label>
             <select value={newRule.machineName} onChange={e => setNewRule({...newRule, machineName: e.target.value, serviceName: ''})} className="w-full mt-1 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none">
               <option value="">-- Wybierz Maszynę --</option>
               {uniqueMachines.map(m => <option key={m} value={m}>{m}</option>)}
             </select>
           </div>
           <div>
             <label className="text-[11px] text-slate-400 uppercase">Cel (Usługa lub Serwer)</label>
             <select 
                value={newRule.serviceName} 
                onChange={e => {
                  const val = e.target.value;
                  setNewRule(prev => ({
                    ...prev, 
                    serviceName: val, 
                    metric: val === '*' ? 'MachineCpu' : 'State', 
                    threshold: val === '*' ? '80' : 'STOPPED' 
                  }));
                }} 
                className="w-full mt-1 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none"
                disabled={!newRule.machineName}
             >
               <option value="">-- Wybierz Cel --</option>
               <option value="*">-- SERWER --</option>
               {newRule.machineName && groupedAgents[newRule.machineName]?.map(s => <option key={s.serviceName} value={s.serviceName}>{s.serviceName}</option>)}
             </select>
           </div>
           <div>
             <label className="text-[11px] text-slate-400 uppercase">Warunek</label>
             <div className="flex gap-2 mt-1">
               <select value={newRule.metric} onChange={e => setNewRule({...newRule, metric: e.target.value})} className="w-1/2 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none" disabled={!newRule.serviceName}>
                 {!isMachineLevel && (
                   <>
                     <option value="State">Status Usługi</option>
                     <option value="ServiceCpu">CPU Usługi (%) {'>'}</option>
                     <option value="ServiceRam">RAM Usługi (MB) {'>'}</option>
                     <option value="ServiceDisk">Dysk Usługi (MB/s) {'>'}</option>
                   </>
                 )}
                 {isMachineLevel && (
                   <>
                     <option value="MachineCpu">CPU Serwera (%) {'>'}</option>
                     <option value="MachineRam">RAM Serwera (%) {'>'}</option>
                     <option value="MachineDisk">Dysk Serwera (%) {'>'}</option>
                   </>
                 )}
               </select>
               <input type="text" value={newRule.threshold} onChange={e => setNewRule({...newRule, threshold: e.target.value})} placeholder={newRule.metric === 'State' ? "STOPPED" : "80"} className="w-1/2 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none" disabled={!newRule.serviceName} />
             </div>
           </div>
           <div>
             <label className="text-[11px] text-slate-400 uppercase">Email</label>
             <input type="text" value={newRule.email} onChange={e => setNewRule({...newRule, email: e.target.value})} placeholder="admin@firma.pl, dev@firma.pl" className="w-full mt-1 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none" />
           </div>
           <div>
             <label className="text-[11px] text-slate-400 uppercase">Częstotliwość (Cooldown min.)</label>
             <input type="number" value={newRule.cooldownMinutes} onChange={e => setNewRule({...newRule, cooldownMinutes: parseInt(e.target.value)})} min="1" className="w-full mt-1 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none" />
           </div>
           <div className="flex items-end gap-2">
             <button onClick={saveRule} className={`w-full text-white text-xs font-bold p-2 rounded transition-colors ${editingId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-amber-600 hover:bg-amber-500'}`}>
               {editingId ? 'Zapisz Zmiany' : 'Utwórz Alert'}
             </button>
             {editingId && (
               <button onClick={cancelEdit} className="w-1/3 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold p-2 rounded transition-colors">
                 Anuluj
               </button>
             )}
           </div>
        </div>

        <h3 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-800 pb-2">Aktywne Reguły Powiadomień</h3>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900 text-[10px] uppercase text-slate-400">
                <tr><th className="p-3">Serwer / Cel</th><th className="p-3">Warunek</th><th className="p-3 max-w-50">Odbiorcy</th><th className="p-3">Cooldown</th><th className="p-3 text-right">Akcje</th></tr>
              </thead>
              <tbody className="text-xs font-mono text-slate-300">
                {rules.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-500">Brak skonfigurowanych alertów.</td></tr>}
                {rules.map(rule => (
                   <tr key={rule.id} className={`border-b border-slate-900 transition-colors ${editingId === rule.id ? 'bg-indigo-900/20' : 'hover:bg-slate-900/50'}`}>
                      <td className="p-3 font-semibold text-slate-200">
                        {rule.machineName} 
                        <span className="text-slate-500 font-normal"> / {rule.serviceName === '*' ? <span className="text-indigo-400 font-bold">Cała Maszyna</span> : rule.serviceName}</span>
                      </td>
                      <td className="p-3 text-amber-400">{rule.metric} {rule.metric === 'State' ? '==' : '>'} {rule.threshold}</td>
                      <td className="p-3 truncate max-w-50" title={rule.email}>{rule.email}</td>
                      <td className="p-3">Co {rule.cooldownMinutes} min.</td>
                      <td className="p-3 text-right flex justify-end gap-2">
                        <button onClick={() => editRule(rule)} className="text-slate-500 hover:text-indigo-400 p-1 transition-colors" title="Edytuj Alert"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => removeRule(rule.id!)} className="text-slate-600 hover:text-rose-400 p-1 transition-colors" title="Usuń Alert"><Trash2 className="w-4 h-4" /></button>
                      </td>
                   </tr>
                ))}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}