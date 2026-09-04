import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Timer, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { RequestStatus } from '../../types';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { cn } from '@/lib/utils';

type RawAgingItem = {
  id: string;
  requestNumber: string;
  status: RequestStatus;
  days?: number;
  ageDays?: number;
};

type BucketRow = {
  bucket: '0-3' | '3-7' | '>7';
  count: number;
  requests: { id: string; requestNumber: string; ageDays: number; status: RequestStatus }[];
};

const labels: Record<string, string> = {
  '0-3': '0-3 hari',
  '3-7': '3-7 hari',
  '>7': '> 7 hari',
};

const BUCKET_META: Record<
  string,
  { label: string; sublabel: string; color: string; bg: string; border: string; icon: any }
> = {
  '0-3': {
    label: '0-3 hari',
    sublabel: 'Normal (SLA)',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
  },
  '3-7': {
    label: '3-7 hari',
    sublabel: 'Perhatian',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: Clock,
  },
  '>7': {
    label: '> 7 hari',
    sublabel: 'Kritis (Overdue)',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/25',
    border: 'border-rose-500/30',
    icon: AlertTriangle,
  },
};

export function AgingTable({ data, loading }: { data?: any[]; loading?: boolean }) {
  const basePath = useHardwareBasePath();

  // Normalize data: backend might return raw list of aging items or pre-bucketed array
  const rows: BucketRow[] = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    // If already bucketed (has 'bucket' property)
    if (data.length > 0 && typeof data[0] === 'object' && 'bucket' in data[0]) {
      return data as BucketRow[];
    }

    // Otherwise, data is raw items from backend: [{ id, requestNumber, status, days }]
    const b0_3: BucketRow['requests'] = [];
    const b3_7: BucketRow['requests'] = [];
    const b7plus: BucketRow['requests'] = [];

    for (const item of data as RawAgingItem[]) {
      const days = Number(item.days ?? item.ageDays ?? 0);
      const req = {
        id: item.id,
        requestNumber: item.requestNumber,
        ageDays: days,
        status: item.status,
      };

      if (days <= 3) {
        b0_3.push(req);
      } else if (days <= 7) {
        b3_7.push(req);
      } else {
        b7plus.push(req);
      }
    }

    return [
      { bucket: '0-3', count: b0_3.length, requests: b0_3 },
      { bucket: '3-7', count: b3_7.length, requests: b3_7 },
      { bucket: '>7', count: b7plus.length, requests: b7plus },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs h-80 flex flex-col justify-between animate-pulse">
        <div className="h-5 w-32 bg-muted/60 rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted/40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs h-80 flex flex-col items-center justify-center text-center">
        <Timer className="size-8 text-muted-foreground opacity-30 mb-2" />
        <p className="text-xs font-semibold text-muted-foreground">Belum ada data aging request.</p>
      </div>
    );
  }

  const total = rows.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Timer className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">SLA & Aging Request</h3>
            <p className="text-[11px] text-muted-foreground">Durasi usia tiket request yang sedang aktif</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-muted/60 border border-border text-foreground">
          {total} Tiket
        </span>
      </div>

      <div className="overflow-x-auto my-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/80 pb-2">
              <th className="py-2.5 px-3">Rentang Usia</th>
              <th className="py-2.5 px-3">Jumlah</th>
              <th className="py-2.5 px-3">Tiket Terlama</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium">
            {rows.map((row) => {
              const bucketKey = String(row.bucket || '0-3');
              const meta = BUCKET_META[bucketKey] || BUCKET_META['0-3'];
              const Icon = meta.icon || Clock;
              const isOverdue = bucketKey === '>7';

              return (
                <tr
                  key={bucketKey}
                  className={cn(
                    'transition-colors',
                    isOverdue
                      ? 'bg-rose-50 dark:bg-rose-950/20 font-semibold'
                      : 'hover:bg-muted/30'
                  )}
                >
                  {/* Bucket column */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('size-3.5 shrink-0', meta.color)} />
                      <span className={cn('font-bold', isOverdue ? 'text-rose-700 dark:text-rose-400' : 'text-foreground')}>
                        {labels[bucketKey] || bucketKey}
                      </span>
                    </div>
                  </td>

                  {/* Count column */}
                  <td className="py-3 px-3">
                    <span
                      className={cn(
                        'inline-flex items-center font-mono font-bold px-2 py-0.5 rounded-lg border text-[11px]',
                        isOverdue
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                          : 'bg-muted/60 text-foreground border-border'
                      )}
                    >
                      {row.count} unit
                    </span>
                  </td>

                  {/* Top Requests */}
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(row.requests || []).slice(0, 3).map((r) => (
                        <Link
                          key={r.id}
                          to={`${basePath}/${r.id}`}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold transition-all shadow-2xs border',
                            isOverdue
                              ? 'bg-card text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10'
                              : 'bg-card text-foreground border-border hover:text-primary hover:border-primary/50'
                          )}
                        >
                          <span>{r.requestNumber}</span>
                          <span className="text-[10px] opacity-70 font-normal">({r.ageDays}d)</span>
                        </Link>
                      ))}
                      {row.requests && row.requests.length > 3 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{row.requests.length - 3} lagi
                        </span>
                      )}
                      {(!row.requests || row.requests.length === 0) && (
                        <span className="text-[10px] text-muted-foreground/60">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-2 border-t border-border">
        <span>Prioritaskan penyelesaian pada tiket yang mendekati batas waktu SLA.</span>
      </div>
    </div>
  );
}
