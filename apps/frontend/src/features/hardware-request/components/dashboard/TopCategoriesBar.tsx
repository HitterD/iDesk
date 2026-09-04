import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Layers } from 'lucide-react';

type Row = { category?: string; count?: number; quantity?: number; qty?: number };

export function TopCategoriesBar({ data, loading }: { data?: Row[]; loading?: boolean }) {
  const normalizedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((d) => ({
      category: d.category || 'OTHER',
      count: Number(d.count ?? d.quantity ?? d.qty ?? 0),
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs h-80 flex flex-col justify-between animate-pulse">
        <div className="h-5 w-32 bg-muted/60 rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-muted/40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || normalizedData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs h-80 flex flex-col items-center justify-center text-center">
        <Layers className="size-8 text-muted-foreground opacity-30 mb-2" />
        <p className="text-xs font-semibold text-muted-foreground">Belum ada data kategori perangkat.</p>
      </div>
    );
  }

  const total = normalizedData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Layers className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Permintaan per Kategori</h3>
            <p className="text-[11px] text-muted-foreground">Kategori hardware yang paling sering diminta</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-muted/60 border border-border text-foreground">
          {total} Item
        </span>
      </div>

      <div className="my-2">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={normalizedData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              type="category"
              dataKey="category"
              fontSize={11}
              width={85}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
            />
            <Tooltip
              formatter={(v: any) => [`${Number(v).toLocaleString('id-ID')} unit`, 'Jumlah']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '1rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-2 border-t border-border">
        <span>Gunakan data ini untuk proyeksi stok & pengadaan berikutnya.</span>
      </div>
    </div>
  );
}
