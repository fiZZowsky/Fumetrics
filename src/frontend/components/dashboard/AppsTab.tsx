import ReactECharts from 'echarts-for-react';
import { Activity, CheckCircle, Server, Terminal } from 'lucide-react';
import { MetricItem, TimelineItem, LatestLogItem } from '@/types/fumetrics';
import { useTheme } from '@/hooks/useTheme';

export function AppsTab({ summaryData, timelineData, latestLogs }: { summaryData: MetricItem[], timelineData: TimelineItem[], latestLogs: LatestLogItem[] }) {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? '#9ca3af' : '#475569';
  const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';

  const getBarChartOptions = () => {
    const services = Array.from(new Set(summaryData.map(d => d.serviceName)));
    const levels = Array.from(new Set(summaryData.map(d => d.level)));
    const series = levels.map(level => ({
      name: level, type: 'bar',
      data: services.map(service => summaryData.find(d => d.serviceName === service && d.level === level)?.count || 0),
      itemStyle: { borderRadius: [4, 4, 0, 0], color: level.toLowerCase() === 'error' ? '#ef4444' : level.toLowerCase() === 'critical' ? '#b91c1c' : level.toLowerCase() === 'warning' ? '#f59e0b' : '#3b82f6' }
    }));
    return { backgroundColor: 'transparent', tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, legend: { data: levels, textStyle: { color: textColor } }, xAxis: { type: 'category', data: services, axisLine: { lineStyle: { color: gridColor } }, axisLabel: { color: textColor, fontWeight: 'bold' } }, yAxis: { type: 'value', axisLine: { lineStyle: { color: gridColor } }, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } }, series };
  };

  const getLineChartOptions = () => {
    const times = Array.from(new Set(timelineData.map(d => d.timeWindow))).sort();
    const levels = Array.from(new Set(timelineData.map(d => d.level)));
    const series = levels.map(level => ({
      name: level, type: 'line', smooth: true, showSymbol: false, areaStyle: { opacity: 0.15 },
      data: times.map(time => timelineData.find(d => d.timeWindow === time && d.level === level)?.count || 0),
      itemStyle: { color: level.toLowerCase() === 'error' ? '#ef4444' : level.toLowerCase() === 'critical' ? '#b91c1c' : level.toLowerCase() === 'warning' ? '#f59e0b' : '#3b82f6' }, lineStyle: { width: 4, shadowColor: 'rgba(0,0,0,0.2)', shadowBlur: 10 }
    }));
    return { backgroundColor: 'transparent', tooltip: { trigger: 'axis' }, legend: { data: levels, textStyle: { color: textColor } }, xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: gridColor } }, axisLabel: { color: textColor } }, yAxis: { type: 'value', axisLine: { lineStyle: { color: gridColor } }, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } }, series };
  };

  const getLevelColor = (level: string) => {
    const l = level.toLowerCase();
    if (l === 'critical') return 'text-red-600 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-400/10 dark:border-red-400/20';
    if (l === 'error') return 'text-rose-600 bg-rose-100 border-rose-200 dark:text-rose-400 dark:bg-rose-400/10 dark:border-rose-400/20';
    if (l === 'warning') return 'text-amber-600 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20';
    return 'text-blue-600 bg-blue-100 border-blue-200 dark:text-blue-400 dark:bg-blue-400/10 dark:border-blue-400/20';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800/60 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50"><div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2 font-bold"><span>Status Systemu</span><CheckCircle className="w-6 h-6 text-emerald-500" /></div><div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">Aktywny</div></div>
        <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800/60 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50"><div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2 font-bold"><span>Monitorowane Serwisy</span><Server className="w-6 h-6 text-cyan-500" /></div><div className="text-3xl font-extrabold text-slate-800 dark:text-white">{Array.from(new Set(summaryData.map(d => d.serviceName))).length}</div></div>
        <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800/60 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50"><div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2 font-bold"><span>Wszystkie Zdarzenia</span><Activity className="w-6 h-6 text-purple-500" /></div><div className="text-3xl font-extrabold text-slate-800 dark:text-white">{summaryData.reduce((acc, curr) => acc + curr.count, 0)}</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800/60 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50"><h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200">Aktywność w czasie (Ost. 5 min)</h2><ReactECharts option={getLineChartOptions()} style={{ height: '350px', width: '100%' }} /></div>
        <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800/60 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50"><h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200">Dystrybucja Logów wg Serwisów</h2><ReactECharts option={getBarChartOptions()} style={{ height: '350px', width: '100%' }} /></div>
      </div>
      <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800/60 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50">
        <div className="flex items-center gap-3 mb-6 text-slate-800 dark:text-slate-200"><Terminal className="w-6 h-6 text-cyan-600 dark:text-cyan-400" /><h2 className="text-xl font-bold">Live Log Stream</h2></div>
        <div className="overflow-x-auto max-h-100 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0F1C] custom-scrollbar shadow-inner">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-white/90 dark:bg-slate-900/90 sticky top-0 z-10 text-xs uppercase font-extrabold text-slate-500 dark:text-slate-400 backdrop-blur-md shadow-sm"><tr><th className="p-4 border-b border-slate-200 dark:border-slate-800 w-48">Czas (UTC)</th><th className="p-4 border-b border-slate-200 dark:border-slate-800 w-32">Poziom</th><th className="p-4 border-b border-slate-200 dark:border-slate-800 w-48">Serwis</th><th className="p-4 border-b border-slate-200 dark:border-slate-800">Wiadomość</th></tr></thead>
            <tbody className="text-sm font-mono text-slate-700 dark:text-slate-300">
              {latestLogs.map((log, index) => (
                <tr key={index} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-200 dark:border-slate-800/50 last:border-0">
                  <td className="p-4 text-slate-500">{log.timestamp}</td><td className="p-4"><span className={`px-3 py-1 rounded-md text-xs font-bold border ${getLevelColor(log.level)}`}>{log.level.toUpperCase()}</span></td><td className="p-4 font-bold text-slate-800 dark:text-slate-200">{log.serviceName}</td><td className="p-4 truncate max-w-xl text-slate-600 dark:text-slate-400">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}