import { LucideIcon } from 'lucide-react';

interface MetricBarProps {
  label: string;
  value: number;
  icon: LucideIcon;
}

export function MetricBar({ label, value, icon: Icon }: MetricBarProps) {
  const colorClass = value > 85 ? "bg-red-500" : value > 65 ? "bg-amber-400" : "bg-emerald-500";
  
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
        <span className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</span>
        <span className={value > 85 ? 'text-red-400 font-bold' : ''}>{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}