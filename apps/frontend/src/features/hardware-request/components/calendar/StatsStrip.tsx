import React from 'react';
import { Calendar, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = { scheduled: number; today: number; unscheduled: number; rescheduleRequested: number };

function StatCard({
  value,
  label,
  icon: Icon,
  colorClass,
  bgClass,
  borderClass,
}: {
  value: number;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-3.5 transition-all duration-150 shadow-2xs hover:shadow-xs flex flex-col justify-between group',
        bgClass,
        borderClass
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className={cn('p-1.5 rounded-xl border', bgClass, borderClass, colorClass)}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-black font-mono tracking-tight', colorClass)}>
          {value}
        </span>
        <span className="text-[10px] text-muted-foreground">request</span>
      </div>
    </div>
  );
}

export function StatsStrip({ scheduled, today, unscheduled, rescheduleRequested }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatCard
        value={scheduled}
        label="Scheduled"
        icon={Calendar}
        colorClass="text-blue-600 dark:text-blue-400"
        bgClass="bg-blue-500/5 dark:bg-blue-500/10"
        borderClass="border-blue-500/20 dark:border-blue-500/30"
      />
      <StatCard
        value={today}
        label="Today"
        icon={Clock}
        colorClass="text-emerald-600 dark:text-emerald-400"
        bgClass="bg-emerald-500/5 dark:bg-emerald-500/10"
        borderClass="border-emerald-500/20 dark:border-emerald-500/30"
      />
      <StatCard
        value={unscheduled}
        label="Unscheduled"
        icon={AlertCircle}
        colorClass="text-amber-600 dark:text-amber-400"
        bgClass="bg-amber-500/5 dark:bg-amber-500/10"
        borderClass="border-amber-500/20 dark:border-amber-500/30"
      />
      <StatCard
        value={rescheduleRequested}
        label="Reschedule"
        icon={RefreshCw}
        colorClass="text-rose-600 dark:text-rose-400"
        bgClass="bg-rose-500/5 dark:bg-rose-500/10"
        borderClass="border-rose-500/20 dark:border-rose-500/30"
      />
    </div>
  );
}