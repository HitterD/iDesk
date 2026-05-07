import React, { useState } from 'react';
import { CheckCircle2, XCircle, Eye, ClipboardCheck, Ban, RefreshCw, CalendarClock } from 'lucide-react';
import { SectionCard } from '../common/SectionCard';
import { useHardwareMutations } from '../../hooks/useHardwareMutations';
import { capsFor, canDecideProcurement, canSelectSlot } from '../../utils/permission.util';
import { useHardwareRole } from '../../hooks/usePermissions';
import { RejectDialog } from './RejectDialog';
import { ReportIssueDialog } from './ReportIssueDialog';
import { ProcurementPanel } from '../procurement/ProcurementPanel';
import { DeliveryBoard } from '../delivery/DeliveryBoard';
import { ScheduleProposeModal } from '../scheduling/ScheduleProposeModal';
import { SlotPickerModal } from '../scheduling/SlotPickerModal';
import type { HardwareRequest, InstallationSchedule } from '../../types';

export function ActionPanel({ r }: { r: HardwareRequest }) {
    const { userId, role } = useHardwareRole();
    const user = { id: userId, role: role as 'USER' | 'ICT_STAFF' };
    const caps = capsFor(user, r);
    const m = useHardwareMutations(r.id);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [issueOpen, setIssueOpen] = useState(false);

    // V2 Workflow Modals
    const [proposeOpen, setProposeOpen] = useState(false);
    const [pickerSched, setPickerSched] = useState<InstallationSchedule | null>(null);

    // Button styles — larger, high-contrast CTA
    const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 w-full shadow-sm hover:shadow-md active:scale-[0.98]';
    const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 w-full';
    const danger = 'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 text-white px-4 py-3 text-sm font-bold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 w-full shadow-sm hover:shadow-md active:scale-[0.98]';

    const actions: Array<[boolean, React.ReactNode]> = [
        [caps.canSubmit,  <button key="sub"     className={primary}    onClick={() => m.submitMut.mutate(r.id)}><CheckCircle2 className="size-4" />Submit Request</button>],
        [caps.canCancel,  <button key="cancel"  className={secondary}  onClick={() => m.cancelMut.mutate(r.id)}><Ban className="size-4" />Batalkan Request</button>],
        [caps.canReview,  <button key="rev"     className={primary}    onClick={() => m.reviewMut.mutate(r.id)}><Eye className="size-4" />Mulai Review</button>],
        [caps.canApprove, <button key="appr"    className={primary}    onClick={() => m.approveMut.mutate(r.id)}><CheckCircle2 className="size-4" />Setujui Request</button>],
        [caps.canReject,  <button key="rej"     className={danger}     onClick={() => setRejectOpen(true)}><XCircle className="size-4" />Tolak Request</button>],
        [r.status === 'INSTALLATION' && role === 'ICT_STAFF', <button key="installC" className={primary} onClick={() => window.confirm('Tandai instalasi sebagai selesai (menunggu konfirmasi user)?') && m.completeInstallMut.mutate(r.id)}><ClipboardCheck className="size-4" />Selesaikan Instalasi</button>],
        [r.status === 'AWAITING_USER_CONFIRMATION' && role === 'USER', <button key="confY" className={primary} onClick={() => window.confirm('Apakah instalasi sudah sesuai?') && m.confirmInstallMut.mutate({ id: r.id, payload: { kind: 'ACCEPT_AS_IS' } })}><CheckCircle2 className="size-4" />Instalasi Sesuai & Selesai</button>],
        [r.status === 'AWAITING_USER_CONFIRMATION' && role === 'USER', <button key="confN" className={danger} onClick={() => setIssueOpen(true)}><XCircle className="size-4" />Laporkan Masalah</button>],
    ];
    const visible = actions.filter(([ok]) => ok);

    const arrivedItems = r.items.filter((i) => i.deliveryStatus === 'ARRIVED');
    const awaitingUserSchedule = r.schedules?.find((s) => s.status === 'PROPOSED_AWAITING_USER');

    return (
        <div className="space-y-6">
            <SectionCard title="Aksi Tersedia">
                {visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 py-4">
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic text-center">
                            Tidak ada aksi tersedia untuk role Anda saat ini.
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">{visible.map(([, el]) => el)}</div>
                )}
                <RejectDialog
                    open={rejectOpen} onClose={() => setRejectOpen(false)}
                    onConfirm={(reason) => m.rejectMut.mutate({ id: r.id, reason })} />
                <ReportIssueDialog
                    open={issueOpen} onClose={() => setIssueOpen(false)}
                    onConfirm={(comments) => m.confirmInstallMut.mutate({ id: r.id, payload: { kind: 'REPORT_ISSUE', comments } })} />
            </SectionCard>

            {canDecideProcurement(user, r) && (
                <ProcurementPanel request={r} />
            )}

            {(r.status === 'AWAITING_DELIVERY' || r.status === 'INSTALLATION') && (
                <DeliveryBoard
                    request={r}
                    user={user}
                    onSchedule={() => setProposeOpen(true)}
                />
            )}

            {awaitingUserSchedule && canSelectSlot(user, r, awaitingUserSchedule.status) && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 dark:bg-primary/10 p-4 shadow-sm animate-pulse-subtle">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Pemberitahuan</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">ICT mengusulkan jadwal</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Silakan pilih slot waktu yang sesuai untuk proses instalasi: 
                        <br/>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {r.items.map(i => i.catalogName || i.categorySnapshot?.name || i.category).join(', ')}
                        </span>
                    </p>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-3 text-sm font-bold hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
                        onClick={() => setPickerSched(awaitingUserSchedule)}
                    >
                        <CalendarClock className="size-4" />
                        Pilih Slot Jadwal
                    </button>
                </div>
            )}

            <ScheduleProposeModal
                open={proposeOpen}
                onOpenChange={setProposeOpen}
                requestId={r.id}
                arrivedItems={arrivedItems}
                defaultTechnicianId={user.id}
            />

            {pickerSched && (
                <SlotPickerModal
                    open={!!pickerSched}
                    onOpenChange={(o) => !o && setPickerSched(null)}
                    requestId={r.id}
                    schedule={pickerSched}
                />
            )}
        </div>
    );
}
