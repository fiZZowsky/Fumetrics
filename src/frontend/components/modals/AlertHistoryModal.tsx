import { useState, useEffect } from 'react';
import { X, Flame, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { AlertHistoryEntry } from '@/types/fumetrics';

interface AlertHistoryModalProps {
  onClose: () => void;
}

export function AlertHistoryModal({ onClose }: AlertHistoryModalProps) {
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts/history`);
        if (res.ok) {
          setHistory(await res.json());
        }
      } catch (err) {
        console.error("Błąd pobierania historii alertów", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    return new Intl.DateTimeFormat('pl-PL', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-8 shadow-2xl flex flex-col max-h-[85vh]">
        
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/50 pb-4">
          <h2 className="text-2xl font-extrabold flex items-center gap-3 text-slate-800 dark:text-slate-100">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            Dziennik Zdarzeń
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative">
          {loading ? (
            <div className="text-center text-slate-500 py-10">Ładowanie historii...</div>
          ) : history.length === 0 ? (
            <div className="text-center text-slate-500 py-10 font-medium">Brak zarejestrowanych incydentów w historii.</div>
          ) : (
            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 py-4 space-y-8">
              {history.map((entry) => {
                const isFiring = entry.state === 'FIRING';
                return (
                  <div key={entry.id} className="relative pl-8 animate-in slide-in-from-left-4 duration-500">
                    <div className={`absolute -left-4.25 top-0.5 p-1.5 rounded-full border-4 border-white dark:border-[#121A2F] ${
                      isFiring ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                    }`}>
                      {isFiring ? <Flame className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    <div className={`p-5 rounded-2xl border ${
                      isFiring 
                        ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20' 
                        : 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
                    }`}>
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                        <div>
                          <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                            isFiring ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          }`}>
                            {isFiring ? 'Rozpoczęcie Awarii' : 'Przywrócenie Normy'}
                          </span>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-2">
                            {entry.machineName} <span className="text-slate-400 mx-1">/</span> <span className={isFiring ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>{entry.serviceName === '*' ? 'Cały Serwer' : entry.serviceName}</span>
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-xl">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(entry.timestamp)}
                        </div>
                      </div>
                      
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-2">
                        <strong className="text-slate-700 dark:text-slate-300">Szczegóły:</strong> {entry.reason}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}