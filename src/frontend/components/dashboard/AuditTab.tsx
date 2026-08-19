import { useState, useEffect } from 'react';
import { TerminalSquare, RefreshCw, Play, Square } from 'lucide-react';

interface AuditLog {
  timestamp: string;
  action: string;
  targetMachine: string;
  targetService: string;
  userIP: string;
}

export function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/audit`);
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionIcon = (action: string) => {
    switch(action.toUpperCase()) {
      case 'RESTART': return <RefreshCw className="w-4 h-4 text-blue-400" />;
      case 'START': return <Play className="w-4 h-4 text-emerald-400" />;
      case 'STOP': return <Square className="w-4 h-4 text-rose-400" />;
      default: return <TerminalSquare className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col min-h-[60vh]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-300">
            <TerminalSquare className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-medium">Dziennik Operacji Użytkowników</h2>
          </div>
          <button onClick={fetchLogs} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Odśwież
          </button>
        </div>

        <div className="flex-1 overflow-x-auto rounded-lg border border-slate-800 bg-[#0A0F1C] custom-scrollbar">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-900/80 sticky top-0 z-10 text-xs uppercase text-slate-400 backdrop-blur-sm">
              <tr>
                <th className="p-4 border-b border-slate-800 font-semibold w-48">Czas (UTC)</th>
                <th className="p-4 border-b border-slate-800 font-semibold w-32">Akcja</th>
                <th className="p-4 border-b border-slate-800 font-semibold">Maszyna Celowa</th>
                <th className="p-4 border-b border-slate-800 font-semibold">Usługa Celowa</th>
                <th className="p-4 border-b border-slate-800 font-semibold">Adres IP Zlecającego</th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono text-slate-300">
              {logs.length === 0 && !loading && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Brak zarejestrowanych operacji.</td></tr>}
              {logs.map((log, index) => (
                <tr key={index} className="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0">
                  <td className="p-4 text-slate-500">{log.timestamp}</td>
                  <td className="p-4 flex items-center gap-2 font-bold">{getActionIcon(log.action)} {log.action}</td>
                  <td className="p-4 font-semibold text-slate-200">{log.targetMachine}</td>
                  <td className="p-4 text-cyan-400">{log.targetService}</td>
                  <td className="p-4 text-slate-500">{log.userIP}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}