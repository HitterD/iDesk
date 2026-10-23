import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './TicketActionDialog';
import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock,
    Calendar,
    AlertCircle,
    CheckCircle2,
    X,
    Loader2,
    ArrowRight,
    HelpCircle,
    Building2,
    FileCheck2,
    Cpu,
    Network,
    MoreHorizontal,
    Send,
} from 'lucide-react';
import { formatSlaDuration, MS_PER_MINUTE } from '@/lib/utils/slaDuration';
import { cn } from '@/lib/utils';
import { SlaAdjustmentReasonCategory } from './types';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { ModernDateTimePicker } from '@/components/ui/ModernDateTimePicker';

export interface ExtendSlaModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: {
        id: string;
        ticketNumber?: string;
        title: string;
        slaTarget?: string | null;
        priority?: string;
        status?: string;
        slaRemainingMinutes?: number | null;
    };
    onConfirm: (data: {
        reasonCategory: SlaAdjustmentReasonCategory;
        reasonText: string;
        newTargetDate?: string;
        minutes?: number;
    }) => Promise<void>;
    isLoading?: boolean;
}

const CATEGORY_OPTIONS: {
    id: SlaAdjustmentReasonCategory;
    title: string;
    description: string;
    icon: React.ElementType;
}[] = [
    {
        id: 'WAITING_USER',
        title: 'Menunggu User',
        description: 'Konfirmasi atau respon user',
        icon: HelpCircle,
    },
    {
        id: 'WAITING_VENDOR',
        title: 'Menunggu Vendor',
        description: 'Sparepart, servis vendor, RMA',
        icon: Building2,
    },
    {
        id: 'WAITING_APPROVAL',
        title: 'Persetujuan Manajerial',
        description: 'Persetujuan biaya atau pergantian unit',
        icon: FileCheck2,
    },
    {
        id: 'TECHNICAL_COMPLEXITY',
        title: 'Kompleksitas Teknis',
        description: 'Investigasi kendala teknis mendalam',
        icon: Cpu,
    },
    {
        id: 'EXTERNAL_DEPENDENCY',
        title: 'Dependensi Eksternal',
        description: 'Gangguan ISP, server, daya/gedung',
        icon: Network,
    },
    {
        id: 'OTHER',
        title: 'Alasan Lainnya',
        description: 'Hambatan operasional lain yang disepakati',
        icon: MoreHorizontal,
    },
];

const DEFAULT_ADDED_MINUTES = 60;
const MAX_ADDED_MINUTES = 10080;

const PRESETS: { label: string; days: number }[] = [
    { label: '1 Minggu', days: 7 },
    { label: '2 Minggu', days: 14 },
    { label: '1 Bulan', days: 30 },
];

export const ExtendSlaModal: React.FC<ExtendSlaModalProps> = ({
    isOpen,
    onClose,
    ticket,
    onConfirm,
    isLoading = false,
}) => {
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const [addedMinutes, setAddedMinutes] = useState(DEFAULT_ADDED_MINUTES);
    const currentTargetDate = useMemo(() => {
        return ticket.slaTarget ? new Date(ticket.slaTarget) : new Date();
    }, [ticket.slaTarget]);

    const minDate = useMemo(() => {
        const now = new Date();
        return currentTargetDate > now ? currentTargetDate : now;
    }, [currentTargetDate]);

    const maxDate = useMemo(() => {
        const now = new Date();
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    }, []);

    // Initial default: 1 Minggu from current target or now
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const base = currentTargetDate > new Date() ? currentTargetDate : new Date();
        return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    });
    const [selectedCategory, setSelectedCategory] = useState<SlaAdjustmentReasonCategory>('WAITING_USER');
    const [reasonText, setReasonText] = useState<string>('');
    const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(0);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            const base = currentTargetDate > new Date() ? currentTargetDate : new Date();
            const defaultTarget = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
            setSelectedDate(defaultTarget);
            setSelectedPresetIndex(0);
            setSelectedCategory('WAITING_USER');
            setReasonText('');
            setAddedMinutes(DEFAULT_ADDED_MINUTES);
        }
    }, [isOpen, currentTargetDate]);


    const handleApplyPreset = (preset: (typeof PRESETS)[0], index: number) => {
        setSelectedPresetIndex(index);
        const base = currentTargetDate > new Date() ? currentTargetDate : new Date();
        const durationMs = preset.days * 24 * 60 * 60 * 1000;
        const newDate = new Date(base.getTime() + durationMs);
        setSelectedDate(newDate);
    };

    const handleDateChange = (date: Date) => {
        setSelectedDate(date);
        setSelectedPresetIndex(null);
    };

    const isBeyondMaxDate = Boolean(selectedDate && maxDate && selectedDate > maxDate);
    const isValidDate = Boolean(
        selectedDate &&
        !isNaN(selectedDate.getTime()) &&
        selectedDate > new Date() &&
        !isBeyondMaxDate
    );
    const isReasonValid = reasonText.trim().length >= 5;
    const isValidMinutes = Number.isSafeInteger(addedMinutes) && addedMinutes > 0 && addedMinutes <= MAX_ADDED_MINUTES;
    const canSubmit = (isPaused ? isValidMinutes : isValidDate) && isReasonValid && !isLoading;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || !selectedDate) return;

        await onConfirm({
            reasonCategory: selectedCategory,
            reasonText: reasonText.trim(),
            ...(isPaused ? { minutes: addedMinutes } : { newTargetDate: selectedDate.toISOString() }),
        });
    };

    return (
        <TicketActionDialog open={isOpen} onClose={onClose} title="Perpanjang SLA" busy={isLoading}>
            <div className="ticket-action-inner">
                {/* Header (Apple Sheet Style) */}
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 id="extend-sla-title" className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
                                    Perpanjang Target SLA
                                </h2>
                                <span className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                                    #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {ticket.title}
                            </p>
                        </div>
                    </div>
                    <Button variant="soft"
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        title="Tutup"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-left">
                    {isPaused ? (
                        <div className="space-y-2.5 text-xs">
                            <label htmlFor="sla-added-minutes" className="font-semibold">Tambahan menit</label>
                            <input
                                id="sla-added-minutes" type="number" min={1} max={MAX_ADDED_MINUTES} step={1}
                                value={Number.isNaN(addedMinutes) ? '' : addedMinutes}
                                onChange={(event) => setAddedMinutes(event.target.valueAsNumber)}
                                className="w-full rounded-xl border border-slate-200 dark:border-white/10 p-2 bg-transparent"
                            />
                            <p>Sisa sebelumnya: {ticket.slaRemainingMinutes != null ? formatSlaDuration(ticket.slaRemainingMinutes * MS_PER_MINUTE) : 'Belum tersedia'} (dijeda)</p>
                            <p>Sisa baru: {ticket.slaRemainingMinutes != null && isValidMinutes ? formatSlaDuration((ticket.slaRemainingMinutes + addedMinutes) * MS_PER_MINUTE) : '—'} (dijeda)</p>
                        </div>
                    ) : (
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                Target Deadline Baru
                            </label>
                            <span className="text-[10px] text-slate-400">WIB</span>
                        </div>

                        {/* Apple Segmented Capsule Bar (1 Minggu, 2 Minggu, 1 Bulan) */}
                        <div className="p-1 bg-slate-100/90 dark:bg-white/5 rounded-2xl grid grid-cols-3 gap-1 border border-slate-200/60 dark:border-white/5">
                            {PRESETS.map((preset, idx) => (
                                <button
                                    key={preset.label}
                                    aria-pressed={selectedPresetIndex === idx}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset, idx)}
                                    className={cn(
                                        "py-1.5 px-3 text-center text-xs font-medium rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-[0.97]",
                                        selectedPresetIndex === idx
                                            ? "bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs font-semibold"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-white/5"
                                    )}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* Modern Date & Time Picker */}
                        <ModernDateTimePicker
                            value={selectedDate}
                            onChange={handleDateChange}
                            minDate={minDate}
                            maxDate={maxDate}
                            placeholder="Pilih Tanggal & Waktu Deadline"
                        />

                        {isBeyondMaxDate && (
                            <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1.5 mt-1 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                Target deadline baru tidak boleh melebihi 90 hari ke depan
                            </p>
                        )}

                        {/* Unified Target Summary Row */}
                        <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sebelumnya:</span>
                                <span className="font-medium text-slate-600 dark:text-slate-400 truncate">
                                    {ticket.slaTarget ? formatDateTimeID(ticket.slaTarget) : 'Belum ditentukan'}
                                </span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 mx-2" />
                            <div className="flex items-center gap-1.5 min-w-0 text-right">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Baru:</span>
                                <span className="font-semibold text-primary truncate">
                                    {selectedDate && !isNaN(selectedDate.getTime())
                                        ? formatDateTimeID(selectedDate.toISOString())
                                        : '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    )}

                    {/* 2. Kategori Alasan Penundaan (Apple Compact Grid) */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-primary" />
                            Kategori Alasan
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {CATEGORY_OPTIONS.map((cat) => {
                                const Icon = cat.icon;
                                const isSelected = selectedCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        aria-pressed={isSelected}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={cn(
                                            "group flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer relative active:scale-[0.98]",
                                            isSelected
                                                ? "bg-primary/5 dark:bg-primary/10 border-primary ring-1 ring-primary/30"
                                                : "bg-white dark:bg-white/[0.03] border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 hover:bg-slate-50/60 dark:hover:bg-white/[0.06]"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white"
                                            )}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <h4
                                                    className={cn(
                                                        "text-xs font-semibold truncate",
                                                        isSelected
                                                            ? "text-primary"
                                                            : "text-slate-800 dark:text-slate-200"
                                                    )}
                                                >
                                                    {cat.title}
                                                </h4>
                                                {isSelected && (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-normal">
                                                {cat.description}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. Penjelasan Rinci Penundaan */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Rincian Hambatan <span className="text-rose-500">*</span>
                            </label>
                            <span
                                className={cn(
                                    "text-[10px] font-mono",
                                    reasonText.trim().length < 5 ? "text-rose-500" : "text-slate-400"
                                )}
                            >
                                {reasonText.trim().length} / 1000
                            </span>
                        </div>

                        <textarea
                                id="ticket-sla-reason"
                                aria-label="Rincian hambatan"
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                            maxLength={1000}
                            rows={2}
                            placeholder="Jelaskan kendala (contoh: Menunggu pengiriman sparepart modul dari vendor PT ABC dengan estimasi 5 hari kerja)..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none leading-relaxed"
                            required
                        />
                        {reasonText.trim().length > 0 && reasonText.trim().length < 5 && (
                            <p className="text-[10px] text-rose-500 font-medium">
                                Penjelasan minimal 5 karakter agar alasan terdokumentasi dengan baik.
                            </p>
                        )}
                    </div>

                    {/* Footnote (tanpa logo AI) */}
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5 leading-relaxed">
                        Pembaruan target dan alasan akan otomatis tercatat transparan di ruang obrolan tiket.
                    </p>
                </form>

                {/* Footer Actions */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2.5">
                    <Button variant="soft"
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Batal
                    </Button>
                    <Button variant="primary" className="ticket-action-sla" aria-busy={isLoading}
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Menyimpan...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-3 h-3" />
                                <span>Perpanjang SLA</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </TicketActionDialog>
    );
};

export default ExtendSlaModal;
