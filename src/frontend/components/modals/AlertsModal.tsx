import { useState, useEffect } from 'react';
import { Bell, X, Trash2 } from 'lucide-react';
import { AlertRule, AgentStatusItem } from '@/types/fumetrics';

interface AlertsModalProps {
  uniqueMachines: string[];
  groupedAgents: Record<string, AgentStatusItem[]>;
  onClose: () => void;
}

export function AlertsModal({ uniqueMachines, groupedAgents, onClose }: AlertsModalProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [newRule, setNewRule] = useState<AlertRule>({ machineName: '', serviceName: '', metric: 'State', threshold: 'STOPPED', email: '', cooldownMinutes: 15 });

  const fetchRules = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts`);
      if (res.ok) setRules(await res.json());
    } catch {}
  };

  useEffect(() => { fetchRules(); }, []);

  const saveRule = async () => {
    if (!newRule.machineName || !newRule.serviceName || !newRule.email || !newRule.threshold) {
      alert("Wypełnij wszystkie pola alertu"); return;
    }
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRule) });
      setNewRule({ machineName: '', serviceName: '', metric: 'State', threshold: 'STOPPED', email: '', cooldownMinutes: 15 });
      fetchRules();
    } catch {}
  };

  const removeRule = async (id: string) => {
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts/${id}`, { method: 'DELETE' });
      fetchRules();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Bell className="w-6 h-6 text-amber-400" /> Konfiguracja Powiadomień Email</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><X className="w-6 h-6" /></button>
        </div>
        
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
           <div><label className="text-[11px] text-slate-400 uppercase">Serwer</label><select value={newRule.machineName} onChange={e => setNewRule({...newRule, machineName: e.target.value})} className="w-full mt-1 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none"><option value="">-- Wybierz Maszynę --</option>{uniqueMachines.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
           <div><label className="text-[11px] text-slate-400 uppercase">Usługa</label><select value={newRule.serviceName} onChange={e => setNewRule({...newRule, serviceName: e.target.value})} className="w-full mt-1 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none"><option value="">-- Wybierz Usługę --</option>{newRule.machineName && groupedAgents[newRule.machineName]?.map(s => <option key={s.serviceName} value={s.serviceName}>{s.serviceName}</option>)}</select></div>
           <div><label className="text-[11px] text-slate-400 uppercase">Warunek</label><div className="flex gap-2 mt-1"><select value={newRule.metric} onChange={e => setNewRule({...newRule, metric: e.target.value})} className="w-1/2 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none"><option value="State">Status</option><option value="ServiceCpu">CPU (%) {'>'}</option><option value="ServiceRam">RAM (MB) {'>'}</option></select><input type="text" value={newRule.threshold} onChange={e => setNewRule({...newRule, threshold: e.target.value})} className="w-1/2 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none" /></div></div>
           <div><label className="text-[11px] text-slate-400 uppercase">Email Odbiorcy</label><input type="email" value={newRule.email} onChange={e => setNewRule({...newRule, email: e.target.value})} className="w-full mt-1 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none" /></div>
           <div><label className="text-[11px] text-slate-400 uppercase">Częstotliwość (min)</label><input type="number" value={newRule.cooldownMinutes} onChange={e => setNewRule({...newRule, cooldownMinutes: parseInt(e.target.value)})} min="1" className="w-full mt-1 bg-slate-900 text-xs text-slate-200 p-2 border border-slate-700 rounded outline-none" /></div>
           <div className="flex items-end"><button onClick={saveRule} className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold p-2 rounded">Utwórz Alert</button></div>
        </div>

        <h3 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-800 pb-2">Aktywne Reguły Powiadomień</h3>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900 text-[10px] uppercase text-slate-400"><tr><th className="p-3">Serwer / Usługa</th><th className="p-3">Warunek</th><th className="p-3">Odbiorca</th><th className="p-3">Cooldown</th><th className="p-3 text-right">Akcje</th></tr></thead>
              <tbody className="text-xs font-mono text-slate-300">
                {rules.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-500">Brak alertów.</td></tr>}
                {rules.map(rule => (
                   <tr key={rule.id} className="border-b border-slate-900 hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-200">{rule.machineName} <span className="text-slate-500 font-normal">/ {rule.serviceName}</span></td>
                      <td className="p-3 text-amber-400">{rule.metric} {rule.metric === 'State' ? '==' : '>'} {rule.threshold}</td>
                      <td className="p-3">{rule.email}</td><td className="p-3">{rule.cooldownMinutes} m</td>
                      <td className="p-3 text-right"><button onClick={() => removeRule(rule.id!)} className="text-slate-600 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button></td>
                   </tr>
                ))}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}