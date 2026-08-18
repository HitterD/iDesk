import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

type Slot = { date: string; count: number };

export function WeeklyScheduleStrip({ data, loading }: { data?: Slot[]; loading?: boolean }) {
  if (loading) return <div className="h-20 animate-pulse rounded-lg bg-slate-100" />;
  if (!data) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[hsl(var(--card))] p-4 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Jadwal Instalasi 7 Hari</h3>
      <div className="grid grid-cols-7 gap-2">
        {data.map((d) => (
          <div key={d.date} className="rounded-md border p-2 text-center">
            <div className="text-xs uppercase text-slate-500">
              {format(parseISO(d.date), 'EEE', { locale: idLocale })}
            </div>
            <div className="text-xs text-slate-700">
              {format(parseISO(d.date), 'd MMM', { locale: idLocale })}
            </div>
            <div className="mt-1 text-lg font-semibold text-indigo-600">{d.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
