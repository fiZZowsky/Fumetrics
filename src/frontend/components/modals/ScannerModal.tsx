import { useState, useEffect } from 'react';
import { Search, Heart, X, CheckSquare, Square, Trash2 } from 'lucide-react';
import { ScannedService, SavedServer, AgentStatusItem } from '@/types/fumetrics';

interface ScannerModalProps {
  groupedAgents: Record<string, AgentStatusItem[]>;
  onClose: () => void;
  onToggleService: (machineName: string, serviceName: string, isMonitored: boolean) => void;
}

export function ScannerModal({ groupedAgents, onClose, onToggleService }: ScannerModalProps) {
  const [machineName, setMachineName] = useState(''); const [ip, setIp] = useState('localhost'); const [port, setPort] = useState('5001');
  const [services, setServices] = useState<ScannedService[]>([]); const [loading, setLoading] = useState(false); const [searchQuery, setSearchQuery] = useState('');
  const [savedServers, setSavedServers] = useState<SavedServer[]>([]);

  const fetchSavedServers = async () => { try { const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/saved-servers`); if (res.ok) setSavedServers(await res.json()); } catch {} };
  useEffect(() => { fetchSavedServers(); }, []);

  const handleScan = async (overrideIp = ip, overridePort = port) => {
    setLoading(true); setSearchQuery('');
    try { const res = await fetch(`http://${overrideIp}:${overridePort}/api/agent/services`); if (!res.ok) throw new Error(); setServices(await res.json()); } catch { alert('Nie udało się połączyć z agentem pod wskazanym adresem.'); setServices([]); } finally { setLoading(false); }
  };

  const toggleFavorite = async () => {
    if (!machineName || !ip || !port) return;
    const isSaved = savedServers.some(s => s.machineName === machineName && s.ipAddress === ip && s.port === port);
    if (isSaved) setSavedServers(prev => prev.filter(s => !(s.machineName === machineName && s.ipAddress === ip && s.port === port)));
    else setSavedServers(prev => [...prev, { machineName, ipAddress: ip, port }]);
    try { const endpoint = isSaved ? 'saved-servers/remove' : 'saved-servers'; await fetch(`http://${window.location.hostname}:5170/api/metrics/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineName, ipAddress: ip, port }) }); } catch { fetchSavedServers(); }
  };

  const removeFavorite = async (e: React.MouseEvent, srv: SavedServer) => {
    e.stopPropagation(); setSavedServers(prev => prev.filter(s => s !== srv));
    try { await fetch(`http://${window.location.hostname}:5170/api/metrics/saved-servers/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(srv) }); } catch { fetchSavedServers(); }
  };

  const isCurrentSaved = savedServers.some(s => s.machineName === machineName && s.ipAddress === ip && s.port === port);
  const isHostMonitored = machineName ? (groupedAgents[machineName] || []).some(s => s.serviceName === '*') : false;
  const filteredServices = services.filter(s => s.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) || s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || s.processId.toString().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl p-8 shadow-2xl flex flex-col max-h-[85vh] transition-colors">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-extrabold flex items-center gap-3 text-slate-800 dark:text-slate-100"><div className="p-2 bg-cyan-100 dark:bg-cyan-500/20 rounded-xl"><Search className="w-6 h-6 text-cyan-600 dark:text-cyan-400" /></div> Skaner Usług Windows</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
          <div className="w-full md:w-1/3 flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-[#0A0F1C] p-5 shadow-inner">
            <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Heart className="w-4 h-4 text-rose-500" /> Zapisane Serwery</h3>
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
              {savedServers.length === 0 ? <div className="text-sm text-slate-500 text-center py-8">Brak zapisanych serwerów.</div> : (
                savedServers.map((srv, idx) => (
                  <div key={idx} onClick={() => { setMachineName(srv.machineName); setIp(srv.ipAddress); setPort(srv.port); handleScan(srv.ipAddress, srv.port); }} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-cyan-400 dark:hover:border-cyan-500 shadow-sm transition-all group flex justify-between items-center">
                     <div><div className="font-bold text-sm text-slate-800 dark:text-slate-200">{srv.machineName}</div><div className="text-[11px] text-slate-500 font-mono mt-1">{srv.ipAddress}:{srv.port}</div></div>
                     <button onClick={e => removeFavorite(e, srv)} className="text-slate-400 hover:text-rose-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 dark:bg-slate-800 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="w-full md:w-2/3 flex flex-col min-h-87.5">
            <div className="flex flex-col gap-4 mb-5 bg-slate-50 dark:bg-[#0A0F1C] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nazwa Maszyny</label><input type="text" value={machineName} onChange={e => setMachineName(e.target.value)} className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2.5 border border-slate-300 dark:border-slate-700 outline-none focus:border-cyan-500 shadow-sm transition-colors" /></div>
                <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Adres IP</label><input type="text" value={ip} onChange={e => setIp(e.target.value)} className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2.5 border border-slate-300 dark:border-slate-700 outline-none focus:border-cyan-500 shadow-sm transition-colors" /></div>
                <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Port Agenta</label><input type="text" value={port} onChange={e => setPort(e.target.value)} className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2.5 border border-slate-300 dark:border-slate-700 outline-none focus:border-cyan-500 shadow-sm transition-colors" /></div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-2">
                <button onClick={toggleFavorite} className={`p-2.5 rounded-xl border flex items-center justify-center transition-colors shadow-sm ${isCurrentSaved ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-500' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-400 dark:hover:border-slate-500'}`} title={isCurrentSaved ? "Usuń z zapisanych" : "Zapisz maszynę w ulubionych"}><Heart className="w-5 h-5" fill={isCurrentSaved ? "currentColor" : "none"} /></button>
                <button onClick={() => handleScan()} className="bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm px-6 py-2.5 rounded-xl font-bold transition-all shadow-md">{loading ? 'Szukanie...' : 'Szukaj Usług'}</button>
                <button onClick={() => onToggleService(machineName, '*', isHostMonitored)} disabled={!machineName} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-6 py-2.5 rounded-xl font-bold transition-all shadow-md">{isHostMonitored ? 'Przestań śledzić serwer' : 'Śledź sam serwer'}</button>
              </div>
            </div>

            {services.length > 0 && (
              <div className="mb-4 relative shrink-0">
                <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filtruj listę usług po nazwie lub PID..." className="w-full bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-xl pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-700 outline-none focus:border-cyan-500 shadow-sm transition-colors" />
              </div>
            )}

            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-[#0A0F1C] shadow-inner custom-scrollbar">
               {services.length === 0 ? <div className="text-center py-12 text-slate-500 font-medium">Brak danych. Kliknij "Szukaj Usług", aby pobrać listę z Agenta.</div> : (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white/90 dark:bg-slate-900/90 text-[10px] uppercase font-extrabold text-slate-500 z-10 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                      <tr><th className="p-4 pl-6">Śledź</th><th className="p-4">Nazwa Usługi</th><th className="p-4">PID</th><th className="p-4">Stan Windows</th></tr>
                    </thead>
                    <tbody className="text-sm font-mono text-slate-700 dark:text-slate-300">
                      {filteredServices.map(srv => {
                        const isMonitored = (groupedAgents[machineName] || []).some(s => s.serviceName === srv.serviceName);
                        return (
                          <tr key={srv.serviceName} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-4 pl-6"><button onClick={() => onToggleService(machineName, srv.serviceName, isMonitored)} className="text-cyan-500 transition-colors">{isMonitored ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />}</button></td>
                            <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{srv.serviceName} <span className="font-normal text-slate-500 dark:text-slate-400 block mt-0.5">{srv.displayName}</span></td>
                            <td className="p-4 text-cyan-600 dark:text-cyan-400 font-bold">{srv.processId > 0 ? srv.processId : '-'}</td>
                            <td className="p-4"><span className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md text-xs font-bold text-slate-600 dark:text-slate-400 shadow-sm">{srv.state}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}