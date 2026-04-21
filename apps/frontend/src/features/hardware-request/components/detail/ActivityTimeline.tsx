import { useActivity } from '../../hooks/useActivity';
import { fmtRelative } from '../../utils/format.util';
import { SectionCard } from '../common/SectionCard';

const ACTION_LABEL: Record<string, string> = {
    CREATED: 'Request Dibuat',
    SUBMITTED: 'Request Disubmit',
    REVIEWED: 'Sedang Direview',
    APPROVED: 'Permintaan Disetujui',
    REJECTED: 'Permintaan Ditolak',
    CANCELLED: 'Permintaan Dibatalkan',
    PROCUREMENT_UPDATED: 'Data Procurement Diperbarui',
    PROCUREMENT_DECIDED: 'Keputusan Item Selesai',
    PROCUREMENT_COMPLETED: 'Procurement Selesai',
    SCHEDULE_PROPOSED: 'Jadwal Diusulkan',
    SCHEDULE_CONFIRMED: 'Jadwal Dikonfirmasi',
    SCHEDULE_RESCHEDULED: 'Jadwal Diubah',
    INSTALL_STARTED: 'Instalasi Dimulai',
    INSTALL_SCHEDULE_DONE: 'Instalasi Selesai',
    INSTALL_COMPLETED: 'Instalasi Selesai (Admin)',
    COMPLETED: 'Request Selesai',
    CLOSED: 'Request Ditutup',
};

export function ActivityTimeline({ requestId }: { requestId: string }) {
    const q = useActivity(requestId);
    const rows = q.data ?? [];
    return (
        <SectionCard title="Aktivitas Terbaru">
            <ol className="relative space-y-6">
                <div className="absolute left-1 top-2 bottom-2 w-px bg-slate-100 dark:bg-slate-800" aria-hidden />
                {rows.map(a => (
                    <li key={a.id} className="relative pl-6 flex flex-col gap-1 transition-all duration-300">
                        <span className="absolute left-0 top-1.5 size-2 rounded-full bg-slate-900 dark:bg-white ring-4 ring-white dark:ring-slate-900 z-10" />
                        <div className="text-[12px] font-bold text-slate-900 dark:text-slate-200 uppercase tracking-tight">{ACTION_LABEL[a.action] ?? a.action}</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-500">
                            <span className="text-slate-700 dark:text-slate-400">{a.actor?.fullName ?? 'System'}</span>
                            <span>•</span>
                            <span>{fmtRelative(a.createdAt)}</span>
                        </div>
                    </li>
                ))}
                {rows.length === 0 && <li className="text-xs text-slate-500 dark:text-slate-600 py-4 text-center">Belum ada aktivitas tercatat.</li>}
            </ol>
        </SectionCard>
    );
}
