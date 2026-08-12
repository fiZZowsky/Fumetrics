import { useState, useEffect } from 'react';
import { Search, Heart, X, CheckSquare, Square, Trash2 } from 'lucide-react';
import { ScannedService, SavedServer, AgentStatusItem } from '@/types/fumetrics';

interface ScannerModalProps {
  groupedAgents: Record<string, AgentStatusItem[]>;
  onClose: () => void;
  onToggleService: (machineName: string, serviceName: string, isMonitored: boolean) => void;
}

export function ScannerModal({ groupedAgents, onClose, onToggleService }: ScannerModalProps) {
  const [machineName, setMachineName] = useState('');
  const [ip, setIp] = useState('localhost');
  const [port, setPort] = useState('5001');
  const [services, setServices] = useState<ScannedService[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedServers, setSavedServers] = useState<SavedServer[]>([]);

  const fetchSavedServers = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/saved-servers`);
      if (res.ok) setSavedServers(await res.json());
    } catch (err) {}
  };

  useEffect(() => { fetchSavedServers(); }, []);

  const handleScan = async (overrideIp = ip, overridePort = port) => {
    setLoading(true); setSearchQuery('');
    try {
      const res = await fetch(`http://${overrideIp}:${overridePort}/api/agent/services`);
      if (!res.ok) throw new Error();
      setServices(await res.json());
    } catch {
      alert('Nie udało się połączyć z agentem pod wskazanym adresem.');
      setServices([]);
    } finally { setLoading(false); }
  };

  const toggleFavorite = async () => {
    if (!machineName || !ip || !port) return;
    const isSaved = savedServers.some(s => s.machineName === machineName && s.ipAddress === ip && s.port === port);
    
    if (isSaved) {
      setSavedServers(prev => prev.filter(s => !(s.machineName === machineName && s.ipAddress === ip && s.port === port)));
    } else {
      setSavedServers(prev => [...prev, { machineName, ipAddress: ip, port }]);
    }
    
    try {
      const endpoint = isSaved ? 'saved-servers/remove' : 'saved-servers';
      await fetch(`http://${window.location.hostname}:5170/api/metrics/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineName, ipAddress: ip, port })
      });
    } catch { fetchSavedServers(); }
  };

  const removeFavorite = async (e: React.MouseEvent, srv: SavedServer) => {
    e.stopPropagation();
    setSavedServers(prev => prev.filter(s => s !== srv));
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/saved-servers/remove`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(srv)
      });
    } catch { fetchSavedServers(); }
  };

  const isCurrentSaved = savedServers.some(s => s.machineName === machineName && s.ipAddress === ip && s.port === port);
  const isHostMonitored = machineName ? (groupedAgents[machineName] || []).some(s => s.serviceName === '*') : false;
  const filteredServices = services.filter(s => s.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) || s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || s.processId.toString().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><Search className="w-5 h-5 text-cyan-400" /> Skaner Usług Windows</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
          {/* Lewa kolumna: Ulubione */}
          <div className="w-full md:w-1/3 flex flex-col border border-slate-800 rounded-xl bg-slate-950 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-rose-400" /> Zapisane Serwery</h3>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {savedServers.length === 0 ? <div className="text-xs text-slate-600 text-center py-6">Brak zapisanych serwerów.</div> : (
                savedServers.map((srv, idx) => (
                  <div key={idx} onClick={() => { setMachineName(srv.machineName); setIp(srv.ipAddress); setPort(srv.port); handleScan(srv.ipAddress, srv.port); }} className="bg-slate-900 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-cyan-500 hover:bg-slate-800/80 transition-all group flex justify-between items-center shadow-md">
                     <div><div className="font-bold text-sm text-slate-200">{srv.machineName}</div><div className="text-[10px] text-slate-500 font-mono mt-0.5">{srv.ipAddress}:{srv.port}</div></div>
                     <button onClick={e => removeFavorite(e, srv)} className="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Prawa kolumna */}
          <div className="w-full md:w-2/3 flex flex-col min-h-87.5">
            
            {/* Responsywny i ładny formularz */}
            <div className="flex flex-col gap-4 mb-4 bg-slate-950 p-4 rounded-xl border border-slate-800 shrink-0">
              
              {/* Rząd 1: Pola tekstowe */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Nazwa Maszyny</label>
                  <input type="text" value={machineName} onChange={e => setMachineName(e.target.value)} className="w-full mt-1 bg-slate-900 text-xs text-slate-200 rounded-lg px-3 py-2 border border-slate-700 outline-none focus:border-cyan-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Adres IP</label>
                  <input type="text" value={ip} onChange={e => setIp(e.target.value)} className="w-full mt-1 bg-slate-900 text-xs text-slate-200 rounded-lg px-3 py-2 border border-slate-700 outline-none focus:border-cyan-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Port Agenta</label>
                  <input type="text" value={port} onChange={e => setPort(e.target.value)} className="w-full mt-1 bg-slate-900 text-xs text-slate-200 rounded-lg px-3 py-2 border border-slate-700 outline-none focus:border-cyan-500 transition-colors" />
                </div>
              </div>

              {/* Rząd 2: Przyciski akcji (wyrównane do prawej) */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-800/50 mt-1">
                <button 
                  onClick={toggleFavorite} 
                  className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${isCurrentSaved ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`} 
                  title={isCurrentSaved ? "Usuń z zapisanych" : "Zapisz maszynę w ulubionych"}
                >
                  <Heart className="w-4 h-4" fill={isCurrentSaved ? "currentColor" : "none"} />
                </button>
                <button 
                  onClick={() => handleScan()} 
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Szukanie...' : 'Szukaj Usług'}
                </button>
                <button 
                  onClick={() => onToggleService(machineName, '*', isHostMonitored)} 
                  disabled={!machineName}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {isHostMonitored ? 'Przestań śledzić serwer' : 'Śledź sam serwer'}
                </button>
              </div>

            </div>

            {/* Pasek wyszukiwania */}
            {services.length > 0 && (
              <div className="mb-3 relative shrink-0">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filtruj listę usług..." className="w-full bg-slate-950 text-xs text-slate-200 rounded-lg pl-9 pr-3 py-2.5 border border-slate-800 outline-none focus:border-cyan-500 transition-colors" />
              </div>
            )}

            {/* Tabela wyników */}
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 p-2 custom-scrollbar">
               {services.length === 0 ? <div className="text-center py-12 text-slate-500 text-xs">Brak danych. Kliknij "Szukaj Usług", aby pobrać listę z Agenta.</div> : (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase text-slate-400 z-10">
                      <tr>
                        <th className="p-3">Śledź</th>
                        <th className="p-3">Nazwa Usługi</th>
                        <th className="p-3">PID</th>
                        <th className="p-3">Stan Windows</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono text-slate-300">
                      {filteredServices.map(srv => {
                        const isMonitored = (groupedAgents[machineName] || []).some(s => s.serviceName === srv.serviceName);
                        return (
                          <tr key={srv.serviceName} className="border-b border-slate-900 hover:bg-slate-900/50">
                            <td className="p-3">
                              <button onClick={() => onToggleService(machineName, srv.serviceName, isMonitored)} className="text-cyan-400 transition-colors">
                                {isMonitored ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />}
                              </button>
                            </td>
                            <td className="p-3 font-semibold text-slate-200">
                              {srv.serviceName} <span className="font-normal text-slate-500 block">{srv.displayName}</span>
                            </td>
                            <td className="p-3 text-cyan-400">{srv.processId > 0 ? srv.processId : '-'}</td>
                            <td className="p-3">{srv.state}</td>
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