import React from 'react';
import { Activity, ShoppingBag, CalendarClock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type KpiData = {
  totalActive: number;
  inProcurement: number;
  pendingInstall: number;
  completedThisMonth: number;
};

const cards: {
  key: keyof KpiData;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}[] = [
  {
    key: 'totalActive',
    label: 'Total Request Aktif',
    sublabel: 'Dalam alur proses berjalan',
    icon: Activity,
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    bgClass: 'bg-indigo-500/5 dark:bg-indigo-500/10',
    borderClass: 'border-indigo-500/20 dark:border-indigo-500/30',
  },
  {
    key: 'inProcurement',
    label: 'Dalam Pengadaan',
    sublabel: 'Menunggu PO / Vendor / Tiba',
    icon: ShoppingBag,
    colorClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-500/5 dark:bg-violet-500/10',
    borderClass: 'border-violet-500/20 dark:border-violet-500/30',
  },
  {
    key: 'pendingInstall',
    label: 'Menunggu Instalasi',
    sublabel: 'Siap & terjadwal ke teknisi',
    icon: CalendarClock,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/5 dark:bg-amber-500/10',
    borderClass: 'border-amber-500/20 dark:border-amber-500/30',
  },
  {
    key: 'completedThisMonth',
    label: 'Selesai Bulan Ini',
    sublabel: 'Telah terpasang & dikonfirmasi',
    icon: CheckCircle2,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    borderClass: 'border-emerald-500/20 dark:border-emerald-500/30',
  },
];

export function KpiCards({ data, loading }: { data?: KpiData; loading?: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.key}
            className={cn(
              'relative overflow-hidden rounded-3xl border p-5 shadow-2xs transition-all duration-200 hover:shadow-xs flex flex-col justify-between group',
              c.bgClass,
              c.borderClass
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {c.label}
              </span>
              <div className={cn('p-2 rounded-2xl border', c.bgClass, c.borderClass, c.colorClass)}>
                <Icon className="size-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className={cn('text-3xl sm:text-4xl font-mono font-black tracking-tight', c.colorClass)}>
                {loading || !data ? (
                  <div className="h-9 w-16 bg-muted/60 rounded-xl animate-pulse" />
                ) : (
                  data[c.key].toLocaleString('id-ID')
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-2 font-medium">
              {c.sublabel}
            </p>
          </div>
        );
      })}
    </div>
  );
}
