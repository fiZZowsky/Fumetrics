import { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Clock, Activity, Flame } from 'lucide-react';

interface ActiveAlert {
  ruleId: string;
  machineName: string;
  serviceName: string;
  firstSeen: string;
  lastSent: string | null;
  isFiring: boolean;
  durationMinutes: number;
}

export function LiveAlertsWidget() {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveAlerts = async () => {
      try {
        const token = localStorage.getItem('fumetrics_jwt');
        const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts/active`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          }
        });
        if (res.ok) {
          setAlerts(await res.json());
        }
      } catch (err) {
        console.error('Błąd pobierania aktywnych alertów', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveAlerts();
    const interval = setInterval(fetchActiveAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  return (
    <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col h-full transition-colors">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <Activity className="w-5 h-5 text-indigo-500" /> Monitorowanie na żywo
        </h3>
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
        </span>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2">
        {alerts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl">
            <div className="p-4 bg-emerald-500/20 rounded-full mb-4">
              <ShieldCheck className="w-12 h-12 text-emerald-500" />
            </div>
            <h4 className="text-emerald-500 font-extrabold text-lg mb-1">Infrastruktura stabilna</h4>
            <p className="text-slate-500 text-sm font-medium">Brak aktywnych incydentów. Wszystkie usługi działają poprawnie.</p>
          </div>
        ) : (
          alerts.map((alert, index) => {
            const isFiring = alert.isFiring;
            return (
              <div 
                key={`${alert.ruleId}-${index}`} 
                className={`relative overflow-hidden p-4 rounded-2xl border ${
                  isFiring 
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-amber-500/50 bg-amber-500/10'
                }`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 pointer-events-none ${isFiring ? 'bg-red-500' : 'bg-amber-500'}`}></div>

                <div className="flex justify-between items-start mb-2 relative z-10">
                  <div className="flex items-center gap-2">
                    {isFiring ? (
                      <Flame className="w-5 h-5 text-red-500 animate-pulse" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                    <span className={`font-extrabold text-sm uppercase tracking-wider ${isFiring ? 'text-red-500' : 'text-amber-500'}`}>
                      {isFiring ? 'Aktywny Alarm' : 'Weryfikacja Anomalii'}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3" /> {alert.durationMinutes} min
                  </span>
                </div>

                <div className="relative z-10">
                  <div className="text-slate-800 dark:text-slate-200 font-bold text-sm mb-1">
                    Serwer: <span className="font-mono bg-white/50 dark:bg-black/30 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400">{alert.machineName}</span>
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 font-bold text-sm">
                    Cel: <span className="font-mono bg-white/50 dark:bg-black/30 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400">{alert.serviceName === '*' ? 'Cała Maszyna' : alert.serviceName}</span>
                  </div>
                </div>

                {isFiring && (
                  <div className="mt-3 pt-3 border-t border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400 relative z-10">
                    Osiągnięto limit czasu zwłoki. Wysyłanie powiadomień aktywne.
                  </div>
                )}
                {!isFiring && (
                  <div className="mt-3 pt-3 border-t border-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-400 relative z-10">
                    Trwa pomiar przed wysłaniem powiadomienia (Tryb oczekiwania).
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}