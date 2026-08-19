import { useState, useEffect } from 'react';
import { Bell, X, Trash2, Edit2 } from 'lucide-react';
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
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRule) 
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

  const editRule = (rule: AlertRule) => { setNewRule(rule); setEditingId(rule.id!); };
  const cancelEdit = () => { setNewRule({ machineName: '', serviceName: '', metric: 'State', threshold: 'STOPPED', email: '', cooldownMinutes: 15 }); setEditingId(null); };
  const isMachineLevel = newRule.serviceName === '*';

  return (
    <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl p-8 shadow-2xl flex flex-col max-h-[85vh] transition-colors">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-extrabold flex items-center gap-3 text-slate-800 dark:text-slate-100"><div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl"><Bell className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div> Konfiguracja Powiadomień Email</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        
        <div className={`border p-5 rounded-2xl mb-8 grid grid-cols-1 md:grid-cols-3 gap-5 transition-colors shadow-inner ${editingId ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50' : 'bg-slate-50 dark:bg-[#0A0F1C] border-slate-200 dark:border-slate-800'}`}>
           <div>
             <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Serwer</label>
             <select value={newRule.machineName} onChange={e => setNewRule({...newRule, machineName: e.target.value, serviceName: ''})} className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition-colors shadow-sm">
               <option value="">-- Wybierz Maszynę --</option>
               {uniqueMachines.map(m => <option key={m} value={m}>{m}</option>)}
             </select>
           </div>
           <div>
             <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cel (Usługa lub Serwer)</label>
             <select value={newRule.serviceName} onChange={e => { const val = e.target.value; setNewRule(prev => ({ ...prev, serviceName: val, metric: val === '*' ? 'MachineCpu' : 'State', threshold: val === '*' ? '80' : 'STOPPED' })); }} className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition-colors shadow-sm" disabled={!newRule.machineName}>
               <option value="">-- Wybierz Cel --</option>
               <option value="*">-- CAŁY SERWER --</option>
               {newRule.machineName && groupedAgents[newRule.machineName]?.map(s => <option key={s.serviceName} value={s.serviceName}>{s.serviceName}</option>)}
             </select>
           </div>
           <div>
             <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Warunek</label>
             <div className="flex gap-2 mt-1.5">
               <select value={newRule.metric} onChange={e => setNewRule({...newRule, metric: e.target.value})} className="w-1/2 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 shadow-sm" disabled={!newRule.serviceName}>
                 {!isMachineLevel && (<><option value="State">Status Usługi</option><option value="ServiceCpu">CPU Usługi (%) {'>'}</option><option value="ServiceRam">RAM Usługi (MB) {'>'}</option><option value="ServiceDisk">Dysk Usługi (MB/s) {'>'}</option></>)}
                 {isMachineLevel && (<><option value="MachineCpu">CPU Serwera (%) {'>'}</option><option value="MachineRam">RAM Serwera (%) {'>'}</option><option value="MachineDisk">Dysk Serwera (%) {'>'}</option></>)}
               </select>
               <input type="text" value={newRule.threshold} onChange={e => setNewRule({...newRule, threshold: e.target.value})} placeholder={newRule.metric === 'State' ? "STOPPED" : "80"} className="w-1/2 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 shadow-sm" disabled={!newRule.serviceName} />
             </div>
           </div>
           <div>
             <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email</label>
             <input type="text" value={newRule.email} onChange={e => setNewRule({...newRule, email: e.target.value})} placeholder="admin@firma.pl" className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 shadow-sm" />
           </div>
           <div>
             <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Częstotliwość (Cooldown min.)</label>
             <input type="number" value={newRule.cooldownMinutes} onChange={e => setNewRule({...newRule, cooldownMinutes: parseInt(e.target.value)})} min="1" className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 shadow-sm" />
           </div>
           <div className="flex items-end gap-3">
             <button onClick={saveRule} className={`flex-1 text-white text-sm font-bold p-2.5 rounded-xl transition-colors shadow-md ${editingId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-amber-500 hover:bg-amber-400'}`}>
               {editingId ? 'Zapisz Zmiany' : 'Utwórz Alert'}
             </button>
             {editingId && <button onClick={cancelEdit} className="w-1/3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-sm font-bold p-2.5 rounded-xl transition-colors">Anuluj</button>}
           </div>
        </div>

        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Aktywne Reguły Powiadomień</h3>
        <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-[#0A0F1C] shadow-inner">
           <table className="w-full text-left border-collapse">
              <thead className="bg-white/90 dark:bg-slate-900/90 text-[10px] font-extrabold uppercase text-slate-500 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-800">
                <tr><th className="p-4">Serwer / Cel</th><th className="p-4">Warunek</th><th className="p-4 max-w-50">Odbiorcy</th><th className="p-4">Cooldown</th><th className="p-4 text-right">Akcje</th></tr>
              </thead>
              <tbody className="text-sm font-mono text-slate-700 dark:text-slate-300">
                {rules.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-sans">Brak skonfigurowanych alertów.</td></tr>}
                {rules.map(rule => (
                   <tr key={rule.id} className={`border-b border-slate-200 dark:border-slate-800 transition-colors ${editingId === rule.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                        {rule.machineName} <span className="text-slate-400 font-normal"> / {rule.serviceName === '*' ? <span className="text-indigo-500 dark:text-indigo-400 font-extrabold">Cała Maszyna</span> : rule.serviceName}</span>
                      </td>
                      <td className="p-4 text-amber-600 dark:text-amber-400 font-bold">{rule.metric} {rule.metric === 'State' ? '==' : '>'} {rule.threshold}</td>
                      <td className="p-4 truncate max-w-50" title={rule.email}>{rule.email}</td>
                      <td className="p-4 text-slate-500">Co {rule.cooldownMinutes} min.</td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        <button onClick={() => editRule(rule)} className="text-slate-400 hover:text-indigo-500 p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors" title="Edytuj Alert"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => removeRule(rule.id!)} className="text-slate-400 hover:text-rose-500 p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors" title="Usuń Alert"><Trash2 className="w-4 h-4" /></button>
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