import React, { useState } from 'react';
import {
    CheckCircle2,
    XCircle,
    Eye,
    ClipboardCheck,
    Ban,
    CalendarClock,
    ShieldCheck,
    HelpCircle,
    Clock,
    AlertCircle,
    UserCheck,
    Send,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface ActionPanelProps {
    r: HardwareRequest;
    onProposeSchedule?: () => void;
    onSelectSlot?: (schedule: InstallationSchedule) => void;
}

export function ActionPanel({ r, onProposeSchedule, onSelectSlot }: ActionPanelProps) {
    const { userId, role } = useHardwareRole();
    const isStaff = role === 'ICT_STAFF';
    const isUser = role === 'USER';
    const user = { id: userId, role };
    const caps = capsFor(user, r);
    const m = useHardwareMutations(r.id);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [issueOpen, setIssueOpen] = useState(false);

    // V2 Workflow Modals fallback
    const [proposeOpen, setProposeOpen] = useState(false);
    const [pickerSched, setPickerSched] = useState<InstallationSchedule | null>(null);

    const isInstallationOnly = String(r.justification || '').includes('[PENJADWALAN PEMASANGAN]');
    const arrivedItems = (r.items ?? []).filter((i) => i.deliveryStatus === 'ARRIVED');
    const itemsToSchedule = isInstallationOnly && arrivedItems.length === 0
        ? (r.items ?? [])
        : arrivedItems;
    const awaitingUserSchedule = r.schedules?.find((s) => s.status === 'PROPOSED_AWAITING_USER');
    const activeSchedule = (r.schedules && r.schedules.length > 0)
        ? [...r.schedules].reverse().find((s) => s.status !== 'CANCELLED') || r.schedules[r.schedules.length - 1]
        : r.installationSchedule;
    const hasConfirmedSchedule = activeSchedule && ['CONFIRMED', 'IN_PROGRESS', 'DONE'].includes(activeSchedule.status);
    const hasProposedSchedule = activeSchedule && activeSchedule.status === 'PROPOSED_AWAITING_USER';

    const handleOpenPropose = onProposeSchedule || (() => setProposeOpen(true));
    const handleOpenPicker = (sched: InstallationSchedule) => {
        if (onSelectSlot) {
            onSelectSlot(sched);
        } else {
            setPickerSched(sched);
        }
    };

    return (
        <div className="space-y-5">
            {/* ── ROLE-ADAPTIVE ACTION CARD ── */}
            <SectionCard
                title={isStaff ? 'Workflow Command Center' : 'Status & Aksi Permintaan'}
                className="transition-all border border-border/80 shadow-xs bg-card"
                action={
                    isStaff ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                            <ShieldCheck className="size-3 shrink-0" />
                            <span>Staf ICT</span>
                        </span>
                    ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <UserCheck className="size-3" />
                            <span>Pemohon</span>
                        </span>
                    )
                }
            >
                <div className="space-y-4">
                    {/* User Schedule Picker Alert */}
                    {awaitingUserSchedule && canSelectSlot(user, r, awaitingUserSchedule.status) && (
                        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 shadow-sm space-y-2.5">
                            <div className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-wider">
                                <CalendarClock className="size-4 animate-bounce" />
                                <span>Pilih Jadwal Instalasi</span>
                            </div>
                            <p className="text-xs text-foreground leading-relaxed">
                                Tim ICT telah mengusulkan slot waktu pemasangan. Silakan pilih slot yang paling sesuai dengan ketersediaan Anda di lokasi.
                            </p>
                            <button
                                type="button"
                                onClick={() => handleOpenPicker(awaitingUserSchedule)}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                            >
                                <CalendarClock className="size-4" />
                                <span>Pilih Slot Waktu Sekarang</span>
                            </button>
                        </div>
                    )}

                    {/* User Confirmation Required Alert */}
                    {r.status === 'AWAITING_USER_CONFIRMATION' && (
                        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 space-y-3">
                            <div className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
                                <AlertCircle className="size-4 text-cyan-600 dark:text-cyan-400" />
                                <span>Konfirmasi Penerimaan Diperlukan</span>
                            </div>
                            <p className="text-xs text-foreground leading-relaxed">
                                Teknisi telah menyelesaikan instalasi perangkat hardware. Mohon periksa apakah perangkat berfungsi normal dan konfirmasi penyelesaian.
                            </p>
                            <div className="grid grid-cols-1 gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm('Apakah seluruh perangkat telah terpasang dan berfungsi dengan baik?')) {
                                            m.confirmInstallMut.mutate({ id: r.id, payload: { kind: 'ACCEPT_AS_IS' } });
                                        }
                                    }}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                                >
                                    <CheckCircle2 className="size-4" />
                                    <span>Instalasi Sesuai & Selesai</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIssueOpen(true)}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-300 px-4 py-2 text-xs font-bold transition-all cursor-pointer"
                                >
                                    <XCircle className="size-3.5" />
                                    <span>Laporkan Masalah / Kendala</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STAFF COMMAND CENTER ACTIONS ── */}
                    {isStaff && (
                        <>
                            {/* State 1: SUBMITTED (Awaiting Review) */}
                            {r.status === 'SUBMITTED' && (caps.canReview || caps.canApprove || caps.canReject) && (
                                <div className="space-y-3 rounded-xl bg-muted/20 border border-border/80 p-4 shadow-2xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Eye className="size-3.5 text-primary" />
                                            <span>Peninjauan Permintaan</span>
                                        </span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                            Baru Diajukan
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Pengajuan baru masuk antrean. Periksa kebutuhan dan kelayakan spesifikasi hardware.
                                    </p>
                                    <div className="grid grid-cols-1 gap-2 pt-1">
                                        {caps.canReview && (
                                            <button
                                                type="button"
                                                onClick={() => m.reviewMut.mutate(r.id)}
                                                disabled={m.reviewMut.isPending}
                                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                                            >
                                                <Eye className="size-4" />
                                                <span>{m.reviewMut.isPending ? 'Memproses...' : 'Tandai Sedang Ditinjau'}</span>
                                            </button>
                                        )}
                                        {caps.canApprove && (
                                            <button
                                                type="button"
                                                onClick={() => m.approveMut.mutate(r.id)}
                                                disabled={m.approveMut.isPending}
                                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                                            >
                                                <CheckCircle2 className="size-4" />
                                                <span>Langsung Setujui</span>
                                            </button>
                                        )}
                                        {caps.canReject && (
                                            <button
                                                type="button"
                                                onClick={() => setRejectOpen(true)}
                                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-4 py-2 text-xs font-medium transition-colors cursor-pointer active:scale-[0.98]"
                                            >
                                                <XCircle className="size-3.5" />
                                                <span>Tolak Permintaan</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* State 2: UNDER_REVIEW (Decision time) */}
                            {r.status === 'UNDER_REVIEW' && (caps.canApprove || caps.canReject) && (
                                <div className="space-y-3 rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 shadow-2xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <ShieldCheck className="size-3.5 text-amber-600 dark:text-amber-400" />
                                            <span>Keputusan Peninjauan</span>
                                        </span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200">
                                            Sedang Ditinjau
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Pemeriksaan spesifikasi selesai. Tentukan persetujuan untuk melanjutkan proses.
                                    </p>
                                    <div className="grid grid-cols-1 gap-2 pt-1">
                                        {caps.canApprove && (
                                            <button
                                                type="button"
                                                onClick={() => m.approveMut.mutate(r.id)}
                                                disabled={m.approveMut.isPending}
                                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                                            >
                                                <CheckCircle2 className="size-4" />
                                                <span>{m.approveMut.isPending ? 'Menyetujui...' : 'Setujui Permintaan'}</span>
                                            </button>
                                        )}
                                        {caps.canReject && (
                                            <button
                                                type="button"
                                                onClick={() => setRejectOpen(true)}
                                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-4 py-2 text-xs font-medium transition-colors cursor-pointer active:scale-[0.98]"
                                            >
                                                <XCircle className="size-3.5" />
                                                <span>Tolak Permintaan</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* State 3: INSTALLATION */}
                            {r.status === 'INSTALLATION' && (
                                <>
                                    {/* Sub-state 3A: No schedule proposed yet */}
                                    {(!activeSchedule || activeSchedule.status === 'CANCELLED') ? (
                                        <div className="space-y-3 rounded-xl bg-primary/5 border border-primary/20 p-4 shadow-2xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                    <CalendarClock className="size-3.5 text-primary" />
                                                    <span>Jadwalkan Pemasangan</span>
                                                </span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                                                    Siap Dijadwalkan
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Perangkat siap dipasang. Tentukan teknisi yang bertugas dan usulkan pilihan slot waktu kepada pemohon.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleOpenPropose}
                                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                                            >
                                                <CalendarClock className="size-4" />
                                                <span>Atur & Usulkan Jadwal ke User</span>
                                            </button>
                                        </div>
                                    ) : hasProposedSchedule ? (
                                        /* Sub-state 3B: Schedule proposed, awaiting user selection */
                                        <div className="space-y-3 rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 shadow-2xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                    <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
                                                    <span>Usulan Jadwal Terkirim</span>
                                                </span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200">
                                                    Menunggu User
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Alternatif slot waktu telah dikirimkan ke pemohon. Menunggu pemohon memilih jadwal yang paling sesuai di lokasi.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleOpenPropose}
                                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground px-4 py-2 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                                            >
                                                <CalendarClock className="size-3.5 text-muted-foreground" />
                                                <span>Ubah Pilihan Slot Waktu</span>
                                            </button>
                                        </div>
                                    ) : (
                                        /* Sub-state 3C: Schedule confirmed/in-progress — Staff can finish installation */
                                        <div className="space-y-3 rounded-xl bg-primary/5 border border-primary/20 p-4 shadow-2xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                    <ClipboardCheck className="size-3.5 text-primary" />
                                                    <span>Penyelesaian Instalasi</span>
                                                </span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                                                    Pemasangan
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Setelah seluruh perangkat selesai dipasang dan dites di lokasi, serahkan konfirmasi kepada pemohon.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm('Tandai instalasi sebagai selesai untuk dikonfirmasi user?')) {
                                                        m.completeInstallMut.mutate(r.id);
                                                    }
                                                }}
                                                disabled={m.completeInstallMut.isPending}
                                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                                            >
                                                <ClipboardCheck className="size-4" />
                                                <span>{m.completeInstallMut.isPending ? 'Memproses...' : 'Selesaikan Pemasangan & Kirim ke User'}</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Contextual guidance for other states in Staff view */}
                            {(r.status === 'APPROVED' || r.status === 'PROCUREMENT') && (
                                <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                                        <span>Permintaan Disetujui</span>
                                    </div>
                                    <p className="leading-relaxed">
                                        Kelola SPP dan keputusan pengadaan barang pada modul <strong>Keputusan Pengadaan</strong> di bawah.
                                    </p>
                                </div>
                            )}

                            {r.status === 'AWAITING_DELIVERY' && (
                                <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                                        <Clock className="size-3.5 text-amber-600" />
                                        <span>Menunggu Kedatangan Barang</span>
                                    </div>
                                    <p className="leading-relaxed">
                                        Checklist barang yang tiba pada panel <strong>Status Pengiriman Item</strong> di bawah untuk mengaktifkan usulan jadwal instalasi.
                                    </p>
                                </div>
                            )}

                            {r.status === 'AWAITING_USER_CONFIRMATION' && (
                                <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                                        <Clock className="size-3.5 text-cyan-600" />
                                        <span>Menunggu Konfirmasi User</span>
                                    </div>
                                    <p className="leading-relaxed">
                                        Pemasangan selesai dilaporkan. User sedang memeriksa kelayakan perangkat di lokasi.
                                    </p>
                                </div>
                            )}

                            {r.status === 'COMPLETED' && (
                                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold">
                                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                                        <span>Permintaan Selesai (ACC)</span>
                                    </div>
                                    <p className="leading-relaxed">
                                        Seluruh perangkat telah dipasang, diterima, dan disetujui oleh pemohon.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Submit Draft Button */}
                    {caps.canSubmit && (
                        <button
                            type="button"
                            onClick={() => m.submitMut.mutate(r.id)}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                        >
                            <Send className="size-4" />
                            <span>Ajukan Request (Submit)</span>
                        </button>
                    )}

                    {/* User Cancel Action */}
                    {caps.canCancel && (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm('Apakah Anda yakin ingin membatalkan permintaan ini?')) {
                                    m.cancelMut.mutate(r.id);
                                }
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors cursor-pointer"
                        >
                            <Ban className="size-3.5" />
                            <span>Batalkan Permintaan</span>
                        </button>
                    )}

                    {/* Clean Status Card for User when waiting */}
                    {isUser && r.status !== 'AWAITING_USER_CONFIRMATION' && !awaitingUserSchedule && (
                        <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 text-xs text-muted-foreground space-y-1.5 shadow-2xs">
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <Clock className="size-4 text-primary shrink-0" />
                                <span>Status Terkini</span>
                            </div>
                            <p className="leading-relaxed text-foreground/80">
                                {r.status === 'COMPLETED'
                                    ? 'Permintaan hardware telah selesai sepenuhnya dan barang telah diverifikasi oleh Anda.'
                                    : activeSchedule?.status === 'RESCHEDULE_REQUESTED'
                                    ? 'Permintaan jadwal ulang Anda sedang diproses oleh tim teknisi ICT.'
                                    : hasConfirmedSchedule
                                    ? 'Jadwal pemasangan telah disepakati. Teknisi ICT akan hadir ke lokasi sesuai waktu yang telah dikonfirmasi.'
                                    : r.status === 'INSTALLATION'
                                    ? (isInstallationOnly
                                        ? 'Pengajuan pemasangan hardware Anda telah diterima. Tim ICT sedang menyiapkan teknisi dan akan segera mengusulkan pilihan slot waktu kepada Anda.'
                                        : 'Perangkat sedang dalam proses instalasi & pemasangan oleh teknisi ICT.')
                                    : r.status === 'AWAITING_DELIVERY'
                                    ? 'Perangkat sedang dalam proses pengiriman vendor menuju lokasi Anda.'
                                    : r.status === 'APPROVED' || r.status === 'PROCUREMENT'
                                    ? 'Permintaan telah disetujui atasan dan dalam proses pengadaan perangkat.'
                                    : 'Permintaan Anda sedang dalam proses peninjauan oleh tim ICT.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Dialogs */}
                <RejectDialog
                    open={rejectOpen}
                    onClose={() => setRejectOpen(false)}
                    onConfirm={(reason) => m.rejectMut.mutate({ id: r.id, reason })}
                />
                <ReportIssueDialog
                    open={issueOpen}
                    onClose={() => setIssueOpen(false)}
                    onConfirm={(comments) =>
                        m.confirmInstallMut.mutate({ id: r.id, payload: { kind: 'REPORT_ISSUE', comments } })
                    }
                />
            </SectionCard>

            {/* Procurement / SPP Decision Panel (For ICT Staff only in Procurement phase) */}
            {isStaff && canDecideProcurement(user, r) && (
                <ProcurementPanel request={r} />
            )}

            {/* Delivery Tracking & Scheduling Board (For ICT Staff & Delivery tracking only — not needed for direct installation) */}
            {isStaff && !isInstallationOnly && (r.status === 'AWAITING_DELIVERY' || r.status === 'INSTALLATION') && (
                <DeliveryBoard
                    request={r}
                    user={user}
                    onSchedule={handleOpenPropose}
                />
            )}

            {/* Schedule Propose Modal */}
            <ScheduleProposeModal
                open={proposeOpen}
                onOpenChange={setProposeOpen}
                requestId={r.id}
                arrivedItems={itemsToSchedule}
                defaultTechnicianId={user.id}
                siteName={r.site?.name}
            />

            {/* Slot Picker Modal */}
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
