import React, { useState } from 'react';
import { SectionCard } from '../common/SectionCard';
import { useHardwareMutations } from '../../hooks/useHardwareMutations';
import { capsFor, canDecideProcurement, canSelectSlot } from '../../utils/permission.util';
import { useHardwareRole } from '../../hooks/usePermissions';
import { RejectDialog } from './RejectDialog';
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
    const [wizardOpen, setWizardOpen] = useState(false);

    // V2 Workflow Modals
    const [proposeOpen, setProposeOpen] = useState(false);
    const [pickerSched, setPickerSched] = useState<InstallationSchedule | null>(null);

    const primary = 'inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-all duration-200 w-full shadow-sm';
    const secondary = 'inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-200 w-full shadow-sm';
    const danger = 'inline-flex items-center justify-center rounded-xl bg-rose-600 text-white px-3 py-2 text-xs font-bold hover:bg-rose-700 transition-all duration-200 w-full shadow-sm';

    const actions: Array<[boolean, React.ReactNode]> = [
        [caps.canSubmit, <button key="sub" className={primary} onClick={() => m.submitMut.mutate(r.id)}>Submit Request</button>],
        [caps.canCancel, <button key="cancel" className={secondary} onClick={() => m.cancelMut.mutate(r.id)}>Batalkan Request</button>],
        [caps.canReview, <button key="rev" className={primary} onClick={() => m.reviewMut.mutate(r.id)}>Mulai Review</button>],
        [caps.canApprove, <button key="appr" className={primary} onClick={() => m.approveMut.mutate(r.id)}>Setujui Request</button>],
        [caps.canReject, <button key="rej" className={danger} onClick={() => setRejectOpen(true)}>Tolak Request</button>],
        [r.status === 'INSTALLATION' && role === 'ICT_STAFF', <button key="installC" className={primary} onClick={() => setWizardOpen(true)}>Selesaikan Instalasi</button>],
    ];
    const visible = actions.filter(([ok]) => ok);

    const arrivedItems = r.items.filter((i) => i.deliveryStatus === 'ARRIVED');
    const awaitingUserSchedule = r.schedules?.find((s) => s.status === 'PROPOSED_AWAITING_USER');

    return (
        <div className="space-y-6">
            <SectionCard title="Aksi Tersedia">
                {visible.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-500 py-2 italic text-center">Tidak ada aksi untuk role Anda saat ini.</div>
                ) : (
                    <div className="flex flex-col gap-2.5">{visible.map(([, el]) => el)}</div>
                )}
                <RejectDialog
                    open={rejectOpen} onClose={() => setRejectOpen(false)}
                    onConfirm={(reason) => m.rejectMut.mutate({ id: r.id, reason })} />
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
                        className="mt-3 text-xs font-black text-primary hover:underline underline-offset-4"
                        onClick={() => setPickerSched(awaitingUserSchedule)}
                    >
                        PILIH SLOT JADWAL →
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
