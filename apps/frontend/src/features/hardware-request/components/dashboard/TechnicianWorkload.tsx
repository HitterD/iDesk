import { Info } from 'lucide-react';
import { DASH_COLORS, DashChartSkeleton, DashEmpty, DashPanel } from '@/features/dashboard/components/DashboardParts';
import { HBars } from './HBars';

type Row = {
  technicianId?: string;
  id?: string;
  technicianName?: string;
  name?: string;
  openCount?: number;
  active?: number;
  todayCount?: number;
  completed30?: number;
};

export function TechnicianWorkload({ data, loading }: { data?: Row[]; loading?: boolean }) {
  const rows = (Array.isArray(data) ? data : []).map((r, idx) => ({
    id: r.technicianId || r.id || `tech-${idx}`,
    name: r.technicianName || r.name || 'Teknisi',
    active: Number(r.active ?? r.openCount ?? 0),
    completed: Number(r.completed30 ?? r.todayCount ?? 0),
  }));
  const top = Math.max(0, ...rows.map((r) => r.active));

  return (
    <DashPanel title="Beban Kerja Teknisi">
      <p className="dash-panel-sub">Instalasi aktif per teknisi · selesai 30 hari terakhir</p>
      {loading ? <DashChartSkeleton /> : rows.length === 0 ? <DashEmpty>Belum ada data beban teknisi.</DashEmpty> : (
        <>
          <HBars items={rows.map((r) => ({
            key: r.id,
            label: r.name,
            value: r.active,
            color: top > 0 && r.active === top ? DASH_COLORS.orange : undefined,
          }))} />
          <div className="res-tags" aria-label="Selesai 30 hari">
            {rows.filter((r) => r.completed > 0).map((r) => <span key={r.id} className="res-tag">{r.name} · {r.completed} selesai</span>)}
          </div>
          <div className="res-note"><Info aria-hidden="true" />Teknisi dengan beban tertinggi disarankan tidak ditugaskan dulu.</div>
        </>
      )}
    </DashPanel>
  );
}
