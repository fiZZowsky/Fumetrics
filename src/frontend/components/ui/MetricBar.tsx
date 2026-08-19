import { LucideIcon } from 'lucide-react';

interface MetricBarProps { label: string; value: number; icon: LucideIcon; }

export function MetricBar({ label, value, icon: Icon }: MetricBarProps) {
  const colorClass = value > 85 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : value > 65 ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5"><Icon className="w-4 h-4" /> {label}</span>
        <span className={value > 85 ? 'text-red-500 dark:text-red-400 font-extrabold' : 'text-slate-700 dark:text-slate-300'}>{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}