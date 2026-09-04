import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowRight,
    UserCheck,
    UserX,
    X,
    Loader2,
    AlertCircle,
    Info,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';

export interface TargetAgentInfo {
    id: string;
    fullName: string;
    email?: string;
    role?: string;
    site?: { code?: string; name?: string };
}

export interface ReassignTicketInfo {
    id: string;
    ticketNumber?: string;
    title?: string;
    assignedTo?: {
        id: string;
        fullName: string;
        email?: string;
        role?: string;
        site?: { code?: string; name?: string };
    } | null;
}

interface ReassignConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: ReassignTicketInfo | null;
    targetAgent: TargetAgentInfo | null; // null means unassign
    onConfirm: (reason: string) => Promise<void> | void;
    isLoading?: boolean;
}

const REASON_PRESETS = [
    { id: 'overload', label: 'Beban Kerja Penuh / Overload' },
    { id: 'skillset', label: 'Kebutuhan Spesialis / Skillset' },
    { id: 'off_duty', label: 'Agent Sedang Off / Cuti' },
    { id: 'misrouted', label: 'Salah Assign / Re-route' },
    { id: 'other', label: 'Lainnya' },
];

export const ReassignConfirmDialog: React.FC<ReassignConfirmDialogProps> = ({
    isOpen,
    onClose,
    ticket,
    targetAgent,
    onConfirm,
    isLoading = false,
}) => {
    const [selectedPreset, setSelectedPreset] = useState<string>('overload');
    const [customReason, setCustomReason] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedPreset('overload');
            setCustomReason('');
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen || !ticket) return null;

    const isUnassign = !targetAgent || !targetAgent.id;
    const oldAgent = ticket.assignedTo;

    const handleConfirm = async () => {
        const presetObj = REASON_PRESETS.find((p) => p.id === selectedPreset);
        const presetLabel = presetObj ? presetObj.label : selectedPreset;

        if (selectedPreset === 'other' && !customReason.trim()) {
            setError('Mohon tuliskan alasan pengalihan pada kolom catatan.');
            return;
        }

        let finalReason = '';
        if (selectedPreset === 'other') {
            finalReason = customReason.trim();
        } else if (customReason.trim()) {
            finalReason = `${presetLabel}: ${customReason.trim()}`;
        } else {
            finalReason = presetLabel;
        }

        try {
            setError(null);
            await onConfirm(finalReason);
        } catch (err: any) {
            setError(err?.message || 'Gagal mengalihkan tiket');
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => {
                if (!isLoading) onClose();
            }}
        >
            <div
                className="relative w-full max-w-lg overflow-hidden bg-card text-card-foreground border border-border/80 shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div
                            className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
                                isUnassign
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    : 'bg-primary/10 text-primary border-primary/20'
                            )}
                        >
                            {isUnassign ? (
                                <UserX className="w-5 h-5" />
                            ) : (
                                <UserCheck className="w-5 h-5" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground">
                                {isUnassign ? 'Lepas Penugasan Tiket' : 'Konfirmasi Pengalihan PIC'}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                #{ticket.ticketNumber || ticket.id.slice(0, 8)} — {ticket.title || 'Support Request'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5">
                    {/* PIC Comparison Box */}
                    <div className="p-3.5 bg-muted/40 rounded-xl border border-border/70 flex items-center justify-between gap-3">
                        {/* Old Agent */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {oldAgent ? (
                                <UserAvatar user={oldAgent} size="sm" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-dashed border-border">
                                    <UserX className="w-4 h-4" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                    PIC Saat Ini
                                </div>
                                <div className="text-xs font-semibold text-foreground truncate">
                                    {oldAgent?.fullName || 'Belum Ditugaskan'}
                                </div>
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-background border border-border shadow-2xs shrink-0 text-muted-foreground">
                            <ArrowRight className="w-3.5 h-3.5 text-primary" />
                        </div>

                        {/* New Agent */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end text-right">
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                    {isUnassign ? 'Status Baru' : 'PIC Baru'}
                                </div>
                                <div
                                    className={cn(
                                        'text-xs font-semibold truncate',
                                        isUnassign
                                            ? 'text-amber-600 dark:text-amber-400 italic'
                                            : 'text-primary'
                                    )}
                                >
                                    {isUnassign ? 'Unassigned (Lepas PIC)' : targetAgent.fullName}
                                </div>
                            </div>
                            {isUnassign ? (
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
                                    <UserX className="w-4 h-4" />
                                </div>
                            ) : (
                                <UserAvatar user={targetAgent} size="sm" />
                            )}
                        </div>
                    </div>

                    {/* Presets */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                            <span>Alasan Pengalihan PIC</span>
                            <span className="text-[11px] font-normal text-muted-foreground">
                                Tercatat pada audit trail
                            </span>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {REASON_PRESETS.map((preset) => {
                                const isSelected = selectedPreset === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedPreset(preset.id);
                                            setError(null);
                                        }}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border',
                                            isSelected
                                                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                                : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
                                        )}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Note / Textarea */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                            <span>
                                Keterangan Tambahan{' '}
                                {selectedPreset === 'other' ? (
                                    <span className="text-destructive font-normal">*Wajib</span>
                                ) : (
                                    <span className="text-muted-foreground font-normal">(Opsional)</span>
                                )}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                {customReason.length}/500
                            </span>
                        </label>
                        <textarea
                            value={customReason}
                            onChange={(e) => {
                                setCustomReason(e.target.value.slice(0, 500));
                                if (error) setError(null);
                            }}
                            placeholder={
                                selectedPreset === 'other'
                                    ? 'Jelaskan alasan mengapa tiket ini dialihkan ke agent lain...'
                                    : 'Tambahkan catatan spesifik jika diperlukan (misal: penyerahan tiket karena eskalasi hardware)...'
                            }
                            rows={3}
                            className={cn(
                                'w-full px-3 py-2 text-xs bg-background border rounded-xl outline-none transition-all resize-none',
                                'focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground',
                                error
                                    ? 'border-destructive focus:ring-destructive'
                                    : 'border-border'
                            )}
                        />
                        {error && (
                            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{error}</span>
                            </p>
                        )}
                    </div>

                    {/* Info Notice */}
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-semibold">Pencatatan Audit Trail</p>
                            <p className="opacity-90 leading-relaxed">
                                Pengalihan penugasan dan alasan ini akan terekam di log audit sistem serta dicatat pada timeline riwayat tiket.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-muted/30">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isLoading || (selectedPreset === 'other' && !customReason.trim())}
                        className={cn(
                            'px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                            isUnassign
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-primary hover:bg-primary/90'
                        )}
                    >
                        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{isUnassign ? 'Lepas Penugasan' : 'Konfirmasi Pengalihan'}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
