import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

type Row = { category: string; count: number };

export function TopCategoriesBar({ data, loading }: { data?: Row[]; loading?: boolean }) {
  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[hsl(var(--card))] p-4 shadow-sm">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Top Categories</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis type="number" allowDecimals={false} fontSize={12} />
          <YAxis type="category" dataKey="category" fontSize={12} width={100} />
          <Tooltip />
          <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
