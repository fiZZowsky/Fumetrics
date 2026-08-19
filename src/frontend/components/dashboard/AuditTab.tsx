import { useState, useEffect } from 'react';
import { TerminalSquare, RefreshCw, Play, Square } from 'lucide-react';

interface AuditLog { timestamp: string; action: string; targetMachine: string; targetService: string; userIP: string; }

export function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => { setLoading(true); try { const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/audit`); if (res.ok) setLogs(await res.json()); } catch {} finally { setLoading(false); } };
  useEffect(() => { fetchLogs(); }, []);

  const getActionIcon = (action: string) => {
    switch(action.toUpperCase()) { case 'RESTART': return <RefreshCw className="w-5 h-5 text-blue-500" />; case 'START': return <Play className="w-5 h-5 text-emerald-500" />; case 'STOP': return <Square className="w-5 h-5 text-rose-500" />; default: return <TerminalSquare className="w-5 h-5 text-slate-400" />; }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800/60 p-8 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50 flex flex-col min-h-[60vh]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
            <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-xl"><TerminalSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" /></div>
            <h2 className="text-2xl font-extrabold tracking-wide">Historia Operacji Administracyjnych</h2>
          </div>
          <button onClick={fetchLogs} className="text-sm font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Odśwież Dziennik
          </button>
        </div>

        <div className="flex-1 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0F1C] custom-scrollbar shadow-inner">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-white/90 dark:bg-slate-900/90 sticky top-0 z-10 text-xs uppercase font-extrabold text-slate-500 dark:text-slate-400 backdrop-blur-md shadow-sm">
              <tr><th className="p-5 border-b border-slate-200 dark:border-slate-800 w-48">Czas (UTC)</th><th className="p-5 border-b border-slate-200 dark:border-slate-800 w-32">Akcja</th><th className="p-5 border-b border-slate-200 dark:border-slate-800">Maszyna Celowa</th><th className="p-5 border-b border-slate-200 dark:border-slate-800">Usługa Celowa</th><th className="p-5 border-b border-slate-200 dark:border-slate-800">IP Zlecającego</th></tr>
            </thead>
            <tbody className="text-sm font-mono text-slate-700 dark:text-slate-300">
              {logs.length === 0 && !loading && <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-sans">Brak zarejestrowanych operacji. Kliknij na karcie maszyny akcję Start/Stop, aby wygenerować log.</td></tr>}
              {logs.map((log, index) => (
                <tr key={index} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-200 dark:border-slate-800/50 last:border-0">
                  <td className="p-5 text-slate-500">{log.timestamp}</td>
                  <td className="p-5 flex items-center gap-3 font-extrabold">{getActionIcon(log.action)} {log.action}</td>
                  <td className="p-5 font-bold text-slate-800 dark:text-slate-200">{log.targetMachine}</td>
                  <td className="p-5 text-cyan-600 dark:text-cyan-400 font-bold">{log.targetService}</td>
                  <td className="p-5 text-slate-500">{log.userIP}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}