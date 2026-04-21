type KpiData = {
  totalActive: number;
  inProcurement: number;
  pendingInstall: number;
  completedThisMonth: number;
};

const cards: { key: keyof KpiData; label: string; accent: string }[] = [
  { key: 'totalActive', label: 'Total Active', accent: 'bg-sky-50 text-sky-700 border-sky-200' },
  { key: 'inProcurement', label: 'In Procurement', accent: 'bg-violet-50 text-violet-700 border-violet-200' },
  { key: 'pendingInstall', label: 'Pending Install', accent: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'completedThisMonth', label: 'Completed This Month', accent: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

export function KpiCards({ data, loading }: { data?: KpiData; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.key} className={`rounded-lg border p-4 ${c.accent}`}>
          <div className="text-xs font-medium uppercase tracking-wide opacity-80">{c.label}</div>
          <div className="mt-2 text-3xl font-semibold">
            {loading || !data ? '—' : data[c.key].toLocaleString('id-ID')}
          </div>
        </div>
      ))}
    </div>
  );
}
