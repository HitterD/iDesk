type KpiData = {
  totalActive: number;
  inProcurement: number;
  pendingInstall: number;
  completedThisMonth: number;
};

const cards: { key: keyof KpiData; label: string; accent: string }[] = [
  { key: 'totalActive', label: 'Total Active', accent: 'border-slate-800 text-slate-900 bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700' },
  { key: 'inProcurement', label: 'In Procurement', accent: 'border-violet-600 text-violet-700 bg-violet-50/50 dark:bg-violet-900/10 dark:text-violet-400 dark:border-violet-800' },
  { key: 'pendingInstall', label: 'Pending Install', accent: 'border-amber-500 text-amber-700 bg-amber-50/50 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800' },
  { key: 'completedThisMonth', label: 'Completed (Month)', accent: 'border-emerald-600 text-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800' },
];

export function KpiCards({ data, loading }: { data?: KpiData; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.key} className={`rounded-xl border p-4 shadow-sm ${c.accent}`}>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-2">{c.label}</div>
          <div className="text-3xl font-mono font-black tracking-tight">
            {loading || !data ? '—' : data[c.key].toLocaleString('id-ID')}
          </div>
        </div>
      ))}
    </div>
  );
}
