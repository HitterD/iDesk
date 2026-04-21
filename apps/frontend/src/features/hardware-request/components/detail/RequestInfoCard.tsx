import { SectionCard } from '../common/SectionCard';
import { fmtDateTime } from '../../utils/format.util';
import type { HardwareRequest } from '../../types';

export function RequestInfoCard({ r }: { r: any }) {
    return (
        <SectionCard title="Informasi Request">
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="space-y-1">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Requester</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-200">{r.requester?.fullName ?? '—'}</dd>
                </div>
                <div className="space-y-1">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Divisi</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-200">{r.division || '—'}</dd>
                </div>
                <div className="space-y-1">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Site / Lokasi</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-200">{r.site?.name ?? '—'}</dd>
                </div>
                <div className="space-y-1">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Diajukan Pada</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-200">{fmtDateTime(r.submittedAt)}</dd>
                </div>
                <div className="space-y-1 col-span-2">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Nama Penerima</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-200">
                        {r.recipientName || r.recipient?.fullName || 'Sama dengan requester'}
                    </dd>
                </div>
                <div className="space-y-1 col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Justifikasi Kebutuhan</dt>
                    <dd className="text-slate-700 dark:text-slate-400 leading-relaxed whitespace-pre-wrap italic">
                        "{r.justification}"
                    </dd>
                </div>
                {r.rejectReason && (
                    <div className="space-y-1 col-span-2 mt-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
                        <dt className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Alasan Penolakan</dt>
                        <dd className="text-sm font-medium text-rose-700 dark:text-rose-400 whitespace-pre-wrap">{r.rejectReason}</dd>
                    </div>
                )}
            </dl>
        </SectionCard>
    );
}
