type Row = { technicianId: string; technicianName: string; openCount: number; todayCount: number };

export function TechnicianWorkload({ data, loading }: { data?: Row[]; loading?: boolean }) {
  if (loading) return <div className="h-48 animate-pulse rounded-lg bg-slate-100" />;
  if (!data) return null;
  const max = Math.max(1, ...data.map((r) => r.openCount));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Beban Technician</h3>
      <ul className="space-y-2">
        {data.map((r) => (
          <li key={r.technicianId}>
            <div className="flex items-center justify-between text-xs text-slate-700">
              <span className="truncate">{r.technicianName}</span>
              <span>
                {r.openCount} open · {r.todayCount} hari ini
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${(r.openCount / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
