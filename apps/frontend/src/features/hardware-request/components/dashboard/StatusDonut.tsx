import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { STATUS_META } from '../../utils/status.util';
import type { RequestStatus } from '../../types';

type Slice = { status: RequestStatus; count: number };

const STATUS_LABELS_ID: Record<string, string> = {
  SUBMITTED: 'Diajukan',
  UNDER_REVIEW: 'Sedang Direview',
  APPROVED: 'Disetujui',
  PROCUREMENT: 'Pengadaan Hardware',
  AWAITING_DELIVERY: 'Menunggu Pengiriman',
  INSTALLATION: 'Tahap Instalasi',
  AWAITING_USER_CONFIRMATION: 'Konfirmasi Penerima',
  COMPLETED: 'Selesai',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

export function StatusDonut({ data, loading }: { data?: Slice[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs h-80 flex flex-col justify-between animate-pulse">
        <div className="h-5 w-32 bg-muted/60 rounded-xl" />
        <div className="size-44 mx-auto rounded-full bg-muted/40" />
        <div className="h-4 w-48 mx-auto bg-muted/50 rounded-lg" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs h-80 flex flex-col items-center justify-center text-center">
        <PieIcon className="size-8 text-muted-foreground opacity-30 mb-2" />
        <p className="text-xs font-semibold text-muted-foreground">Belum ada data distribusi status.</p>
      </div>
    );
  }

  const totalCount = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <PieIcon className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Distribusi Status Request</h3>
            <p className="text-[11px] text-muted-foreground">Proporsi request berdasarkan tahapan</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-muted/60 border border-border text-foreground">
          Total {totalCount}
        </span>
      </div>

      <div className="relative my-2">
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              cornerRadius={4}
            >
              {data.map((s) => (
                <Cell
                  key={s.status}
                  fill={STATUS_META[s.status]?.hex || '#6366f1'}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: any, name: any) => [
                `${Number(v).toLocaleString('id-ID')} request`,
                STATUS_LABELS_ID[String(name)] || String(name),
              ]}
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
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black font-mono text-foreground leading-none">
            {totalCount}
          </span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-0.5">
            Request
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border max-h-28 overflow-y-auto custom-scrollbar">
        {data.map((s) => {
          const hex = STATUS_META[s.status]?.hex || '#6366f1';
          const label = STATUS_LABELS_ID[s.status] || s.status;
          const percentage = totalCount > 0 ? Math.round((s.count / totalCount) * 100) : 0;

          return (
            <div key={s.status} className="flex items-center justify-between text-xs pr-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                <span className="truncate text-muted-foreground font-medium text-[11px]">{label}</span>
              </div>
              <span className="font-mono font-bold text-foreground text-[11px] shrink-0 ml-1">
                {s.count} <span className="text-[10px] text-muted-foreground font-normal">({percentage}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
