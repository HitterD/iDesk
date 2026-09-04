import { Wrench, Users, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type Row = {
  technicianId?: string;
  id?: string;
  technicianName?: string;
  name?: string;
  openCount?: number;
  active?: number;
  todayCount?: number;
  completed30?: number;
};

export function TechnicianWorkload({ data, loading }: { data?: Row[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs h-80 flex flex-col justify-between animate-pulse">
        <div className="h-5 w-32 bg-muted/60 rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted/40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs h-80 flex flex-col items-center justify-center text-center">
        <Users className="size-8 text-muted-foreground opacity-30 mb-2" />
        <p className="text-xs font-semibold text-muted-foreground">Belum ada data beban teknisi.</p>
      </div>
    );
  }

  const normalized = data.map((r, idx) => ({
    id: r.technicianId || r.id || `tech-${idx}`,
    name: r.technicianName || r.name || 'Teknisi',
    openCount: Number(r.active ?? r.openCount ?? 0),
    todayCount: Number(r.completed30 ?? r.todayCount ?? 0),
  }));

  const max = Math.max(1, ...normalized.map((r) => r.openCount));

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Wrench className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Beban Kerja Teknisi</h3>
            <p className="text-[11px] text-muted-foreground">Distribusi tiket aktif & jadwal</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-muted/60 border border-border text-foreground">
          {normalized.length} Teknisi
        </span>
      </div>

      <ul className="space-y-3 my-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
        {normalized.map((r) => {
          const initials = r.name
            .split(' ')
            .filter(Boolean)
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'TK';
          const percent = Math.min(100, Math.round((r.openCount / max) * 100));

          return (
            <li
              key={r.id}
              className="p-3 rounded-2xl bg-muted/20 border border-border/80 hover:border-border transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-7 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                    {initials}
                  </div>
                  <span className="text-xs font-bold text-foreground truncate">
                    {r.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                    {r.openCount} aktif
                  </span>
                  {r.todayCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                      <Calendar className="size-3" />
                      {r.todayCount} selesai (30d)
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-primary transition-all duration-300 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-2 border-t border-border">
        <span>Teknisi dengan beban tertinggi disarankan tidak ditugaskan dulu.</span>
      </div>
    </div>
  );
}
