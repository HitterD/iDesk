import { useMemo } from 'react';
import { DashChartSkeleton, DashEmpty, DashPanel } from '@/features/dashboard/components/DashboardParts';
import { HBars } from './HBars';

type Row = { category?: string; count?: number; quantity?: number; qty?: number };

const CATEGORY_LABELS: Record<string, string> = {
  LAPTOP: 'Laptop', DESKTOP: 'Desktop', MONITOR: 'Monitor', ACCESSORY: 'Aksesoris',
  NETWORK: 'Jaringan', SOFTWARE: 'Software', OTHER: 'Lainnya',
};

export function TopCategoriesBar({ data, loading }: { data?: Row[]; loading?: boolean }) {
  const items = useMemo(() => (Array.isArray(data) ? data : []).map((d) => {
    const category = d.category || 'OTHER';
    return { key: category, label: CATEGORY_LABELS[category] ?? category, value: Number(d.count ?? d.quantity ?? d.qty ?? 0) };
  }), [data]);

  return (
    <DashPanel title="Permintaan per Kategori">
      <p className="dash-panel-sub">Kategori hardware yang paling sering diminta · gunakan untuk proyeksi stok</p>
      {loading ? <DashChartSkeleton /> : items.length === 0 ? <DashEmpty>Belum ada data kategori perangkat.</DashEmpty> : <HBars items={items} suffix=" unit" wide />}
    </DashPanel>
  );
}
