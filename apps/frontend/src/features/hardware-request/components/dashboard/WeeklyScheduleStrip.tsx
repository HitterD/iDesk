import { useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

type Slot = {
  date?: string;
  count?: number;
  scheduledStart?: string;
  scheduledAt?: string;
};

export function WeeklyScheduleStrip({ data, loading }: { data?: Slot[]; loading?: boolean }) {
  const today = new Date();

  const normalizedSlots = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    // Case 1: Pre-aggregated array of { date: 'YYYY-MM-DD', count: N }
    if (data.length > 0 && typeof data[0] === 'object' && 'date' in data[0] && 'count' in data[0]) {
      return data as { date: string; count: number }[];
    }

    // Case 2: Array of raw schedules from backend (e.g. [{ scheduledStart: '...', ... }])
    // Generate 7 days starting from start of current week
    const weekStart = new Date(today);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const daysMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = format(d, 'yyyy-MM-dd');
      daysMap[key] = 0;
    }

    for (const item of data) {
      const timeStr = item.scheduledStart || item.scheduledAt;
      if (timeStr) {
        try {
          const itemDate = format(parseISO(timeStr), 'yyyy-MM-dd');
          if (itemDate in daysMap) {
            daysMap[itemDate]++;
          }
        } catch {
          // ignore invalid date strings
        }
      }
    }

    return Object.entries(daysMap).map(([date, count]) => ({ date, count }));
  }, [data]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs animate-pulse">
        <div className="h-5 w-40 bg-muted/60 rounded-xl mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-24 bg-muted/40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || normalizedSlots.length === 0) return null;

  const totalWeekly = normalizedSlots.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <CalendarDays className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Proyeksi Jadwal Instalasi 7 Hari ke Depan</h3>
            <p className="text-[11px] text-muted-foreground">Kapasitas dan beban instalasi harian</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-muted/60 border border-border text-foreground">
          {totalWeekly} Instalasi Terjadwal
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
        {normalizedSlots.map((d) => {
          let parsedDate = today;
          try {
            parsedDate = parseISO(d.date);
          } catch {
            // fallback to today
          }
          const isToday = isSameDay(parsedDate, today);

          return (
            <div
              key={d.date}
              className={cn(
                'relative flex flex-col items-center justify-between p-3.5 rounded-2xl border transition-all duration-150',
                isToday
                  ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30'
                  : 'bg-muted/20 border-border/80 hover:border-border hover:bg-muted/30'
              )}
            >
              {isToday && (
                <span className="absolute -top-2 px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-primary text-primary-foreground shadow-2xs">
                  Hari Ini
                </span>
              )}

              <div className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                {format(parsedDate, 'EEE', { locale: idLocale })}
              </div>

              <div className="text-sm font-bold text-foreground font-mono mt-0.5">
                {format(parsedDate, 'd MMM', { locale: idLocale })}
              </div>

              <div className="mt-2.5 flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-xl font-mono font-black tracking-tight',
                    d.count > 0
                      ? isToday
                        ? 'text-primary'
                        : 'text-foreground'
                      : 'text-muted-foreground/40'
                  )}
                >
                  {d.count}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">unit</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
