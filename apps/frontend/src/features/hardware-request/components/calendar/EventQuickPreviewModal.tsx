import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
    Calendar,
    Clock,
    User,
    MapPin,
    ArrowRight,
    X,
    CheckCircle2,
    Cpu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CalendarEventData } from '../../types/calendar.types';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../utils/status.util';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { cn } from '@/lib/utils';

interface EventQuickPreviewModalProps {
    event: CalendarEventData | null;
    onClose: () => void;
}

export function EventQuickPreviewModal({ event, onClose }: EventQuickPreviewModalProps) {
    const basePath = useHardwareBasePath();

    if (!event) return null;

    const isAwaitingConfirm =
        event.status === 'DONE' && event.requestStatus === 'AWAITING_USER_CONFIRMATION';
    const isAwaitingSlot = event.status === 'PROPOSED_AWAITING_USER';

    const chip = isAwaitingConfirm
        ? { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-300 dark:border-cyan-800', dot: 'bg-cyan-500', text: 'text-cyan-900 dark:text-cyan-300', badge: 'MENUNGGU KONFIRMASI' }
        : INSTALL_STATUS_CHIP[event.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;

    const scheduledDate = event.scheduledAt ? parseISO(event.scheduledAt) : new Date();
    const formattedDate = format(scheduledDate, 'EEEE, dd MMMM yyyy', { locale: idLocale });
    const formattedTime = format(scheduledDate, 'HH:mm');

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
                    aria-hidden="true"
                />

                {/* Dialog Content */}
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="preview-modal-title"
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-10"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/20">
                        <div className="flex items-center gap-2.5">
                            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Cpu className="size-5" />
                            </div>
                            <div>
                                <h3 id="preview-modal-title" className="text-base font-bold text-foreground font-mono">
                                    {event.requestNumber}
                                </h3>
                                <p className="text-xs text-muted-foreground">Jadwal Instalasi Hardware</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                            aria-label="Tutup preview"
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 sm:p-5 space-y-4">
                        {/* Status chip banner */}
                        <div className={cn('flex items-center justify-between p-3 rounded-xl border', chip.bg, chip.border)}>
                            <div className="flex items-center gap-2">
                                <span className={cn('size-2 rounded-full', chip.dot, isAwaitingConfirm && 'animate-pulse')} />
                                <span className={cn('text-xs font-bold uppercase tracking-wider', chip.text)}>
                                    {isAwaitingConfirm ? 'Konfirmasi Anda Diperlukan' : isAwaitingSlot ? 'Pilih Slot Instalasi' : chip.badge}
                                </span>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                                Status Schedule
                            </span>
                        </div>

                        {/* Schedule Info Grid */}
                        <div className="grid grid-cols-1 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/60">
                            <div className="flex items-start gap-3">
                                <Calendar className="size-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-xs text-muted-foreground block">Hari & Tanggal</span>
                                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                                        {formattedDate}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-xs text-muted-foreground block">Waktu / Jam</span>
                                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                                        {formattedTime} WIB
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <User className="size-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-xs text-muted-foreground block">Teknisi Bertugas</span>
                                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                                        {event.technicianName || 'Belum ditentukan'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-xs text-muted-foreground block">Lokasi / Site</span>
                                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                                        {event.siteName || '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 sm:p-5 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-colors cursor-pointer"
                        >
                            Tutup
                        </button>
                        <Link
                            to={`${basePath}/${event.requestId}`}
                            onClick={onClose}
                            className={cn(
                                'w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98]',
                                isAwaitingConfirm
                                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                            )}
                        >
                            {isAwaitingConfirm ? (
                                <>
                                    <CheckCircle2 className="size-3.5" />
                                    <span>Konfirmasi Sekarang</span>
                                </>
                            ) : (
                                <>
                                    <span>Buka Detail Request</span>
                                    <ArrowRight className="size-3.5" />
                                </>
                            )}
                        </Link>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
