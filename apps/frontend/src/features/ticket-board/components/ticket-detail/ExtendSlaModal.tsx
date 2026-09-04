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
    Sparkles,
    Send,
} from 'lucide-react';
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
    color: string;
}[] = [
    {
        id: 'WAITING_USER',
        title: 'Menunggu User',
        description: 'Menunggu konfirmasi, kelengkapan data, atau respon dari user',
        icon: HelpCircle,
        color: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    },
    {
        id: 'WAITING_VENDOR',
        title: 'Menunggu Vendor',
        description: 'Menunggu pengiriman sparepart, servis pihak ke-3, atau RMA',
        icon: Building2,
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    {
        id: 'WAITING_APPROVAL',
        title: 'Persetujuan Manajerial',
        description: 'Memerlukan persetujuan biaya, pergantian unit, atau otoritas',
        icon: FileCheck2,
        color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    {
        id: 'TECHNICAL_COMPLEXITY',
        title: 'Kompleksitas Teknis',
        description: 'Kendala teknis mendalam yang membutuhkan waktu investigasi ekstra',
        icon: Cpu,
        color: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
    {
        id: 'EXTERNAL_DEPENDENCY',
        title: 'Dependensi Eksternal',
        description: 'Gangguan provider ISP, server pusat, atau listrik/gedung',
        icon: Network,
        color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    {
        id: 'OTHER',
        title: 'Alasan Lainnya',
        description: 'Hambatan operasional lain yang telah disepakati',
        icon: MoreHorizontal,
        color: 'text-slate-500 bg-slate-500/10 border-slate-500/30',
    },
];

const PRESETS = [
    { label: '+4 Jam', hours: 4 },
    { label: '+1 Hari Kerja', hours: 8 },
    { label: '+2 Hari Kerja', hours: 16 },
    { label: '+3 Hari Kerja', hours: 24 },
    { label: '+1 Minggu', hours: 40 },
];

export const ExtendSlaModal: React.FC<ExtendSlaModalProps> = ({
    isOpen,
    onClose,
    ticket,
    onConfirm,
    isLoading = false,
}) => {
    const currentTargetDate = useMemo(() => {
        return ticket.slaTarget ? new Date(ticket.slaTarget) : new Date();
    }, [ticket.slaTarget]);

    const minDate = useMemo(() => {
        const now = new Date();
        return currentTargetDate > now ? currentTargetDate : now;
    }, [currentTargetDate]);

    // Initial default: +1 work day from current target or now
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const base = currentTargetDate > new Date() ? currentTargetDate : new Date();
        return new Date(base.getTime() + 8 * 60 * 60 * 1000);
    });
    const [selectedCategory, setSelectedCategory] = useState<SlaAdjustmentReasonCategory>('WAITING_USER');
    const [reasonText, setReasonText] = useState<string>('');
    const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(1);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            const base = currentTargetDate > new Date() ? currentTargetDate : new Date();
            const defaultTarget = new Date(base.getTime() + 8 * 60 * 60 * 1000);
            setSelectedDate(defaultTarget);
            setSelectedPresetIndex(1);
            setSelectedCategory('WAITING_USER');
            setReasonText('');
        }
    }, [isOpen, currentTargetDate]);

    if (!isOpen) return null;

    const handleApplyPreset = (hours: number, index: number) => {
        setSelectedPresetIndex(index);
        const base = currentTargetDate > new Date() ? currentTargetDate : new Date();
        const newDate = new Date(base.getTime() + hours * 60 * 60 * 1000);
        setSelectedDate(newDate);
    };

    const handleDateChange = (date: Date) => {
        setSelectedDate(date);
        setSelectedPresetIndex(null);
    };

    const isValidDate = Boolean(selectedDate && !isNaN(selectedDate.getTime()) && selectedDate > new Date());
    const isReasonValid = reasonText.trim().length >= 5;
    const canSubmit = isValidDate && isReasonValid && !isLoading;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || !selectedDate) return;

        await onConfirm({
            reasonCategory: selectedCategory,
            reasonText: reasonText.trim(),
            newTargetDate: selectedDate.toISOString(),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="extend-sla-title"
            >
                {/* Header */}
                <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-transparent dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-transparent">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 id="extend-sla-title" className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    Perpanjang Target SLA
                                </h2>
                                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {ticket.title}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                        title="Tutup"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body (Scrollable) */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* 1. Target Date Selector */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                1. Pilih Target Deadline Baru
                            </label>
                            <span className="text-[11px] text-slate-400">Waktu Indonesia Barat (WIB)</span>
                        </div>

                        {/* Preset Shortcut Chips */}
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map((preset, idx) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset.hours, idx)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-2xs active:scale-[0.97]",
                                        selectedPresetIndex === idx
                                            ? "bg-blue-600 text-white border-blue-600 shadow-blue-500/20"
                                            : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                            placeholder="Pilih Tanggal & Waktu Deadline"
                        />

                        {/* Visual Target Comparison Card */}
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/70 to-indigo-50/70 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-between gap-2 shadow-2xs">
                            <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                    Target Sebelumnya
                                </span>
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate block">
                                    {ticket.slaTarget ? formatDateTimeID(ticket.slaTarget) : 'Belum ditentukan'}
                                </span>
                            </div>

                            <ArrowRight className="w-4 h-4 text-blue-500 shrink-0" />

                            <div className="min-w-0 text-right">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-0.5">
                                    Target Diperpanjang Ke
                                </span>
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 truncate block">
                                    {selectedDate && !isNaN(selectedDate.getTime())
                                        ? formatDateTimeID(selectedDate.toISOString())
                                        : '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Reason Category Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
                            2. Kategori Alasan Penundaan
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {CATEGORY_OPTIONS.map((cat) => {
                                const Icon = cat.icon;
                                const isSelected = selectedCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={cn(
                                            "flex items-start gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs",
                                            isSelected
                                                ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 dark:border-blue-500 ring-1 ring-blue-500/30"
                                                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                        )}
                                    >
                                        <div className={cn("p-2 rounded-xl border shrink-0", cat.color)}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                                                    {cat.title}
                                                </h4>
                                                {isSelected && (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                                                {cat.description}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. Reason Text Description */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                3. Penjelasan Rinci Penundaan <span className="text-rose-500">*</span>
                            </label>
                            <span className={cn(
                                "text-[11px] font-mono",
                                reasonText.trim().length < 5 ? "text-rose-500" : "text-slate-400"
                            )}>
                                {reasonText.trim().length} / 1000
                            </span>
                        </div>

                        <textarea
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                            maxLength={1000}
                            rows={3}
                            placeholder="Jelaskan secara spesifik hambatan yang terjadi (misal: Menunggu pengiriman kabel modul fiber optik dari vendor PT. ABC dengan estimasi tiba hari Kamis)..."
                            className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-900 dark:text-white text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-2xs resize-none leading-relaxed"
                            required
                        />
                        {reasonText.trim().length > 0 && reasonText.trim().length < 5 && (
                            <p className="text-[11px] text-rose-500 font-medium">
                                Penjelasan minimal 5 karakter agar alasan terdokumentasi dengan baik.
                            </p>
                        )}
                    </div>

                    {/* 4. Transparency Announcement Info Card */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
                        <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 text-[11px] leading-relaxed">
                            <p className="font-semibold text-slate-900 dark:text-white">Transparansi Penundaan</p>
                            <p className="text-slate-500 dark:text-slate-400">
                                Sistem akan secara otomatis memposting pemberitahuan perpanjangan waktu dan alasan ini ke ruang obrolan tiket agar requester mengetahui perkiraan penyelesaian terbaru.
                            </p>
                        </div>
                    </div>
                </form>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs hover:shadow-blue-500/20 active:scale-[0.98] transition-all cursor-pointer"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Menyimpan...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Perpanjang SLA</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExtendSlaModal;
