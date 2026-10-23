import { DashDonut, DashEmpty, DashChartSkeleton, DashPanel } from '@/features/dashboard/components/DashboardParts';
import { STATUS_BUB } from '../../utils/status.util';
import type { RequestStatus } from '../../types';

type Slice = { status: RequestStatus; count: number };

const STATUS_LABELS_ID: Record<string, string> = {
  SUBMITTED: 'Diajukan',
  UNDER_REVIEW: 'Sedang direview',
  APPROVED: 'Disetujui',
  PROCUREMENT: 'Pengadaan',
  AWAITING_DELIVERY: 'Menunggu pengiriman',
  INSTALLATION: 'Instalasi',
  AWAITING_USER_CONFIRMATION: 'Konfirmasi user',
  COMPLETED: 'Selesai',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

export function StatusDonut({ data, loading }: { data?: Slice[]; loading?: boolean }) {
  return (
    <DashPanel title="Distribusi Status Request">
      <p className="dash-panel-sub">Proporsi request berdasarkan tahapan</p>
      {loading ? <DashChartSkeleton /> : !data || data.length === 0 ? (
        <DashEmpty>Belum ada data distribusi status.</DashEmpty>
      ) : (
        <DashDonut unit="request" label="Distribusi status request"
          items={data.map((s) => ({ label: STATUS_LABELS_ID[s.status] ?? s.status, value: s.count, color: STATUS_BUB[s.status]?.color ?? 'var(--dash-gray)' }))} />
      )}
    </DashPanel>
  );
}
