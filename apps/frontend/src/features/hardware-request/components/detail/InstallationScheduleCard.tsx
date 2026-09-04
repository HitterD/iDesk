import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    CalendarClock,
    Clock,
    CheckCircle2,
    AlertCircle,
    User,
    Wrench,
    ExternalLink,
    ChevronRight,
    Sparkles,
    RotateCcw,
    Calendar,
} from 'lucide-react';
import { SectionCard } from '../common/SectionCard';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import type { HardwareRequest, InstallationSchedule, InstallStatus } from '../../types';

interface InstallationScheduleCardProps {
    request: HardwareRequest;
    schedule: InstallationSchedule;
    isStaff: boolean;
    onSelectSlot?: (schedule: InstallationSchedule) => void;
    onReschedule?: (schedule: InstallationSchedule) => void;
    onProposeNewSlots?: (schedule: InstallationSchedule) => void;
}

const INSTALL_STATUS_CONFIG: Record<InstallStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
    PROPOSED: {
        label: 'Diusulkan',
        bg: 'bg-amber-500/10 dark:bg-amber-500/20',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-500/30',
        icon: Clock,
    },
    PROPOSED_AWAITING_USER: {
        label: 'Menunggu Pilihan User',
        bg: 'bg-amber-500/15 dark:bg-amber-500/25',
        text: 'text-amber-800 dark:text-amber-200',
        border: 'border-amber-500/40',
        icon: AlertCircle,
    },
    CONFIRMED: {
        label: 'Jadwal Terkonfirmasi',
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-500/30',
        icon: CheckCircle2,
    },
    IN_PROGRESS: {
        label: 'Sedang Berlangsung',
        bg: 'bg-blue-500/10 dark:bg-blue-500/20',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-500/30',
        icon: Wrench,
    },
    DONE: {
        label: 'Instalasi Selesai',
        bg: 'bg-emerald-500/15 dark:bg-emerald-500/25',
        text: 'text-emerald-800 dark:text-emerald-200',
        border: 'border-emerald-500/40',
        icon: CheckCircle2,
    },
    RESCHEDULE_REQUESTED: {
        label: 'Permintaan Reschedule',
        bg: 'bg-rose-500/10 dark:bg-rose-500/20',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-500/30',
        icon: RotateCcw,
    },
    RESCHEDULED: {
        label: 'Jadwal Diubah',
        bg: 'bg-purple-500/10 dark:bg-purple-500/20',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-500/30',
        icon: CalendarClock,
    },
    CANCELLED: {
        label: 'Jadwal Dibatalkan',
        bg: 'bg-slate-500/10 dark:bg-slate-500/20',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-500/30',
        icon: AlertCircle,
    },
};

export function InstallationScheduleCard({
    request,
    schedule,
    isStaff,
    onSelectSlot,
    onReschedule,
    onProposeNewSlots,
}: InstallationScheduleCardProps) {
    const statusCfg = INSTALL_STATUS_CONFIG[schedule.status] || INSTALL_STATUS_CONFIG.PROPOSED;
    const StatusIcon = statusCfg.icon;

    const isConfirmed = schedule.status === 'CONFIRMED' || schedule.status === 'IN_PROGRESS' || schedule.status === 'DONE';
    const isAwaitingUser = schedule.status === 'PROPOSED_AWAITING_USER';
    const isRescheduleRequested = schedule.status === 'RESCHEDULE_REQUESTED';

    const startDate = schedule.scheduledStart ? new Date(schedule.scheduledStart) : null;
    const endDate = schedule.scheduledEnd ? new Date(schedule.scheduledEnd) : null;

    const formatTimeRange = (start?: string | null, end?: string | null) => {
        if (!start) return '—';
        const s = new Date(start);
        const e = end ? new Date(end) : null;
        const timeStart = s.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const timeEnd = e ? e.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
        return timeEnd ? `${timeStart} – ${timeEnd}` : timeStart;
    };

    const scheduledItems = (schedule.items && schedule.items.length > 0)
        ? schedule.items.map((si) => si.item?.categorySnapshot?.name || si.item?.name || 'Perangkat')
        : (request.items ?? []).map((i) => i.categorySnapshot?.name || i.name || 'Perangkat');

    const uniqueItems = Array.from(new Set(scheduledItems));

    return (
        <SectionCard
            title="Jadwal Pemasangan Hardware"
            action={
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all',
                        statusCfg.bg,
                        statusCfg.text,
                        statusCfg.border
                    )}
                >
                    <StatusIcon className="size-3.5" />
                    <span>{statusCfg.label}</span>
                </span>
            }
        >
            <div className="space-y-4">
                {/* ── CONFIRMED JADWAL HIGHLIGHT BANNER ── */}
                {isConfirmed && startDate && (
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-primary/5 to-transparent border border-emerald-500/30 p-4 sm:p-5 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5">
                                <div className="size-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <Calendar className="size-6" />
                                </div>
                                <div>
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-0.5">
                                        Waktu Pemasangan Terkonfirmasi
                                    </span>
                                    <h4 className="text-base sm:text-lg font-black text-foreground">
                                        {startDate.toLocaleDateString('id-ID', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                        })}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm font-semibold text-muted-foreground">
                                        <Clock className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span>pk {formatTimeRange(schedule.scheduledStart, schedule.scheduledEnd)} WIB</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action to request reschedule if still active */}
                            {schedule.status === 'CONFIRMED' && (
                                <button
                                    type="button"
                                    onClick={() => onReschedule?.(schedule)}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-card hover:bg-muted border border-border text-foreground transition-all shadow-2xs cursor-pointer shrink-0"
                                >
                                    <RotateCcw className="size-3.5 text-muted-foreground" />
                                    <span>Ajukan Jadwal Ulang</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── PROPOSED SLOTS (WAITING USER SELECTION) ── */}
                {isAwaitingUser && (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs sm:text-sm font-extrabold uppercase tracking-wider">
                                <Sparkles className="size-4 text-amber-600 dark:text-amber-400" />
                                <span>Pilihan Slot Jadwal dari Staf ICT</span>
                            </div>
                            {schedule.rescheduleCount > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300">
                                    Reschedule #{schedule.rescheduleCount}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">
                            Berikut adalah alternatif slot waktu yang diusulkan untuk pemasangan perangkat.
                            Silakan pilih salah satu slot yang paling cocok dengan ketersediaan Anda di lokasi.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {(schedule.proposedSlots ?? []).map((slot, idx) => {
                                const s = new Date(slot.start);
                                const e = new Date(slot.end);
                                return (
                                    <motion.div
                                        key={idx}
                                        whileHover={{ y: -2 }}
                                        className="p-3 rounded-xl bg-card border border-amber-500/30 shadow-2xs flex flex-col justify-between gap-2"
                                    >
                                        <div>
                                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                                                Opsi #{idx + 1}
                                            </span>
                                            <div className="text-xs font-bold text-foreground mt-0.5">
                                                {s.toLocaleDateString('id-ID', {
                                                    weekday: 'short',
                                                    day: 'numeric',
                                                    month: 'short',
                                                })}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                                                <Clock className="size-3 text-slate-400" />
                                                <span>
                                                    {s.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} – {e.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {!isStaff && (
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-500/20">
                                <button
                                    type="button"
                                    onClick={() => onReschedule?.(schedule)}
                                    className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                                >
                                    Waktu tidak ada yang cocok? Minta Reschedule
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onSelectSlot?.(schedule)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                                >
                                    <CalendarClock className="size-3.5" />
                                    <span>Pilih Slot Waktu Sekarang</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── RESCHEDULE REQUESTED BANNER ── */}
                {isRescheduleRequested && (
                    <div className={cn(
                        'rounded-2xl border p-4 sm:p-5 space-y-3 transition-all',
                        isStaff
                            ? 'border-rose-500/30 bg-rose-500/10'
                            : 'border-amber-500/30 bg-amber-500/10'
                    )}>
                        <div className="flex items-center justify-between gap-3">
                            <div className={cn(
                                'flex items-center gap-2 text-xs sm:text-sm font-extrabold uppercase tracking-wider',
                                isStaff ? 'text-rose-700 dark:text-rose-300' : 'text-amber-800 dark:text-amber-200'
                            )}>
                                <RotateCcw className="size-4 shrink-0" />
                                <span>{isStaff ? 'Permintaan Jadwal Ulang dari User' : 'Permintaan Jadwal Ulang Terkirim'}</span>
                            </div>
                            {schedule.rescheduleCount > 0 && (
                                <span className={cn(
                                    'text-[10px] font-bold px-2 py-0.5 rounded-md',
                                    isStaff ? 'bg-rose-500/20 text-rose-800 dark:text-rose-200' : 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                                )}>
                                    Reschedule #{schedule.rescheduleCount}
                                </span>
                            )}
                        </div>

                        <p className="text-xs text-foreground leading-relaxed">
                            {isStaff ? (
                                <>Alasan user meminta reschedule: <span className="font-bold italic">"{schedule.rescheduleReason || 'Jadwal belum sesuai ketersediaan'}"</span></>
                            ) : (
                                <>Permintaan jadwal ulang Anda (Alasan: <span className="font-bold italic">"{schedule.rescheduleReason || 'Jadwal belum sesuai ketersediaan'}"</span>) telah diteruskan ke tim teknisi ICT. Teknisi akan segera mengusulkan slot waktu alternatif.</>
                            )}
                        </p>

                        {isStaff && (
                            <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Silakan usulkan slot waktu baru yang cocok:</span>
                                <button
                                    type="button"
                                    onClick={() => onProposeNewSlots ? onProposeNewSlots(schedule) : onSelectSlot?.(schedule)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                                >
                                    <CalendarClock className="size-3.5" />
                                    <span>Usulkan Jadwal Alternatif Baru</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── AGENT & ITEMS GRID ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Assigned Agent / Technician */}
                    <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs flex items-start gap-3">
                        <UserAvatar user={schedule.technician} size="sm" />
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                Agent Pelaksana (Teknisi)
                            </span>
                            <div className="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">
                                {schedule.technician?.fullName || 'Agent ICT'}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                                {schedule.technician?.email || `${request.site?.name || 'Site'} Support`}
                            </div>
                        </div>
                    </div>

                    {/* Scheduled Items Summary */}
                    <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs flex items-start gap-3">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                            <Wrench className="size-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                Perangkat yang Dipasang
                            </span>
                            <div className="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">
                                {uniqueItems.join(', ') || 'Semua item tiba'}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                                Lokasi: {request.site?.name ?? '—'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── LINKED TICKET BAR ── */}
                {schedule.ticketId && (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="size-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                                <Wrench className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                                <span className="font-extrabold text-purple-900 dark:text-purple-200">
                                    Tiket Pemasangan Hardware Telah Dibuat
                                </span>
                                <p className="text-[11px] text-purple-700 dark:text-purple-300 truncate">
                                    Tiket otomatis terhubung pada Ticket Board dan di-assign ke Agent.
                                </p>
                            </div>
                        </div>

                        <Link
                            to={`/tickets/${schedule.ticketId}`}
                            className="inline-flex items-center gap-1 font-bold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-purple-300 dark:border-purple-700 shadow-2xs hover:shadow-xs transition-all shrink-0 cursor-pointer"
                        >
                            <span>Buka Tiket</span>
                            <ExternalLink className="size-3" />
                        </Link>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}
