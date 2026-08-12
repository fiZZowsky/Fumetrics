import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { HardDrive, Server, X } from 'lucide-react';
import { AgentHistoryItem } from '@/types/fumetrics';

interface HistoryModalProps {
  machineName: string;
  serviceName?: string | null;
  onClose: () => void;
}

export function HistoryModal({ machineName, serviceName, onClose }: HistoryModalProps) {
  const [history, setHistory] = useState<AgentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<'1h' | '24h' | '30d'>('1h');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const url = serviceName 
          ? `http://${window.location.hostname}:5170/api/metrics/agents/${machineName}/services/${serviceName}/history?range=${range}`
          : `http://${window.location.hostname}:5170/api/metrics/agents/${machineName}/history?range=${range}`;
        const res = await fetch(url);
        if (res.ok) setHistory(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [machineName, serviceName, range]);

  const getChartOptions = () => {
    const times = history.map(h => h.timestamp);
    const isService = !!serviceName;
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: isService ? ['CPU (%)', 'RAM (MB)', 'Dysk (MB/s)'] : ['CPU (%)', 'RAM (%)', 'Dysk (%)'], textStyle: { color: '#9ca3af' } },
      xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af' } },
      yAxis: [
        { type: 'value', name: 'Procent', max: isService ? undefined : 100, axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#374151' } } },
        ...(isService ? [{ type: 'value', name: 'Wartość (MB, MB/s)', position: 'right', axisLine: { lineStyle: { color: '#4b5563' } }, axisLabel: { color: '#9ca3af', formatter: '{value}' }, splitLine: { show: false } }] as any : [])
      ],
      series: [
        { name: 'CPU (%)', type: 'line', smooth: true, showSymbol: false, data: history.map(h => h.cpu), itemStyle: { color: '#3b82f6' }, areaStyle: { opacity: 0.1 }, yAxisIndex: 0 },
        { name: isService ? 'RAM (MB)' : 'RAM (%)', type: 'line', smooth: true, showSymbol: false, data: history.map(h => h.ram), itemStyle: { color: '#10b981' }, areaStyle: { opacity: 0.1 }, yAxisIndex: isService ? 1 : 0 },
        { name: isService ? 'Dysk (MB/s)' : 'Dysk (%)', type: 'line', smooth: true, showSymbol: false, data: history.map(h => h.disk), itemStyle: { color: '#8b5cf6' }, areaStyle: { opacity: 0.1 }, yAxisIndex: isService ? 1 : 0 }
      ]
    };
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl p-6 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
              {serviceName ? <Server className="w-6 h-6" /> : <HardDrive className="w-6 h-6" />}
              {serviceName ? `${serviceName} (${machineName})` : machineName}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-sm text-slate-400">Historia obciążenia z:</p>
              <select value={range} onChange={e => setRange(e.target.value as any)} className="bg-slate-800 text-slate-200 text-xs rounded-md px-2 py-1 border border-slate-700 outline-none cursor-pointer">
                <option value="1h">Ostatnia godzina</option>
                <option value="24h">Ostatnie 24h</option>
                <option value="30d">Ostatni miesiąc</option>
              </select>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>
        {loading ? <div className="h-100 flex items-center justify-center text-slate-500">Ładowanie danych...</div> : <ReactECharts option={getChartOptions()} style={{ height: '400px', width: '100%' }} />}
      </div>
    </div>
  );
}