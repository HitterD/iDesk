import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { STATUS_META } from '../../utils/status.util';
import type { RequestStatus } from '../../types';

type Slice = { status: RequestStatus; count: number };

export function StatusDonut({ data, loading }: { data?: Slice[]; loading?: boolean }) {
  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  if (!data || data.length === 0) return <p className="text-sm text-slate-500">Belum ada data.</p>;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[hsl(var(--card))] p-4 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Distribusi Status</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((s) => (
              <Cell key={s.status} fill={STATUS_META[s.status]?.hex || '#4338ca'} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => Number(v).toLocaleString('id-ID')} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
