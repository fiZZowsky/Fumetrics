import { useState, useEffect } from 'react';
import { X, Activity, Cpu, HardDrive, MemoryStick, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface MetricsHistoryModalProps {
  machineName: string;
  onClose: () => void;
}

interface MetricData {
  timestamp: string;
  cpu: number;
  ram: number;
  disk: number;
}

export function MetricsHistoryModal({ machineName, onClose }: MetricsHistoryModalProps) {
  const [data, setData] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState<number>(12);
  const [activeTab, setActiveTab] = useState<'cpu' | 'ram' | 'disk'>('cpu');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/agents/${machineName}/history?hours=${hours}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('fumetrics_jwt')}` } });
        if (res.ok) {
          const rawData = await res.json();
          const formattedData = rawData.map((d: any) => ({
            ...d,
            formattedTime: hours > 24 
              ? new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d.timestamp + 'Z'))
              : new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(d.timestamp + 'Z'))
          }));
          setData(formattedData);
        }
      } catch (err) {
        console.error("Błąd pobierania historii metryk", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [machineName, hours]);

  const renderChart = () => {
    const isCpu = activeTab === 'cpu';
    const isRam = activeTab === 'ram';
    
    const dataKey = isCpu ? 'cpu' : isRam ? 'ram' : 'disk';
    const color = isCpu ? '#3b82f6' : isRam ? '#8b5cf6' : '#10b981';
    const name = isCpu ? 'Zużycie CPU (%)' : isRam ? 'Zużycie RAM (%)' : 'Dysk / IO (%)';

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
          <XAxis dataKey="formattedTime" stroke="#64748b" fontSize={11} tickMargin={10} minTickGap={30} />
          <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc', fontSize: '12px', fontWeight: 'bold' }}
            itemStyle={{ color: color }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', paddingTop: '10px' }} />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={3} fillOpacity={1} fill="url(#colorGradient)" activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl p-8 shadow-2xl flex flex-col h-[80vh]">
        
        <div className="flex flex-wrap justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/50 pb-4 gap-4">
          <h2 className="text-2xl font-extrabold flex items-center gap-3 text-slate-800 dark:text-slate-100">
            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-xl">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            Historia Wydajności: <span className="text-blue-600 dark:text-blue-400 font-mono">{machineName}</span>
          </h2>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-800 rounded-xl p-1">
              <Clock className="w-4 h-4 text-slate-500 ml-2" />
              {[
                { h: 6, label: '6h' },
                { h: 12, label: '12h' },
                { h: 24, label: '24h' },
                { h: 168, label: '7d' },
                { h: 720, label: '30d' }
              ].map(opt => (
                <button key={opt.h} onClick={() => setHours(opt.h)} className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${hours === opt.h ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('cpu')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'cpu' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            <Cpu className="w-4 h-4" /> CPU
          </button>
          <button onClick={() => setActiveTab('ram')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'ram' ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            <MemoryStick className="w-4 h-4" /> RAM
          </button>
          <button onClick={() => setActiveTab('disk')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'disk' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            <HardDrive className="w-4 h-4" /> Dysk
          </button>
        </div>

        <div className="flex-1 min-h-0 bg-slate-50 dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-[#0A0F1C]/50 backdrop-blur-sm rounded-2xl z-10">
              <span className="text-sm font-bold text-slate-500 animate-pulse">Pobieranie statystyk...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium text-slate-500">Brak danych historycznych dla wybranego przedziału.</span>
            </div>
          ) : null}
          
          {renderChart()}
        </div>

      </div>
    </div>
  );
}