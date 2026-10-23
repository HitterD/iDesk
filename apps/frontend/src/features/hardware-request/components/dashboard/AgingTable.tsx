import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { DashChartSkeleton, DashEmpty, DashPanel } from '@/features/dashboard/components/DashboardParts';
import { HBars } from './HBars';
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

const MAX_LINKS = 3;

/** Mockup hbars: green / orange / red by age bucket. */
const BUCKET_META: Record<string, { label: string; color: string }> = {
  '0-3': { label: '0-3 hari', color: 'var(--dash-green)' },
  '3-7': { label: '3-7 hari', color: 'var(--dash-orange)' },
  '>7': { label: '> 7 hari', color: 'var(--dash-red)' },
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

  const meta = (bucket: string) => BUCKET_META[bucket] ?? BUCKET_META['0-3'];
  return (
    <DashPanel title="SLA & Aging Request">
      <p className="dash-panel-sub">Durasi usia request yang sedang aktif</p>
      {loading ? <DashChartSkeleton /> : !data || rows.length === 0 ? <DashEmpty>Belum ada data aging request.</DashEmpty> : (
        <>
          <HBars items={rows.map((row) => ({ key: row.bucket, label: meta(row.bucket).label, value: row.count, color: meta(row.bucket).color }))} />
          {rows.some((row) => row.requests?.length) && (
            <div className="res-tags" aria-label="Request terlama">
              {rows.flatMap((row) => (row.requests ?? []).slice(0, MAX_LINKS).map((r) => (
                <Link key={r.id} to={`${basePath}/${r.id}`} className={cn('res-tag is-mono', row.bucket === '>7' && 'is-overdue')} data-bucket={row.bucket}>
                  {r.requestNumber}<span className="res-muted">· {r.ageDays} hari</span>
                </Link>
              )))}
            </div>
          )}
          <div className="res-note"><Info aria-hidden="true" />Prioritaskan penyelesaian pada request yang mendekati batas waktu SLA.</div>
        </>
      )}
    </DashPanel>
  );
}
