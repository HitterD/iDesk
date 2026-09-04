import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    GitMerge,
    Crown,
    X,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Tag,
    User as UserIcon,
    Clock,
    ArrowRight,
    ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './ticket-detail/constants';

export interface MergeCandidateTicket {
    id: string;
    ticketNumber?: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    category?: string;
    createdAt?: string;
    slaTarget?: string;
    user?: {
        id?: string;
        fullName?: string;
        email?: string;
        department?: {
            name?: string;
        };
    };
    assignedTo?: {
        fullName?: string;
    } | null;
}

interface MergeTicketsModalProps {
    isOpen: boolean;
    onClose: () => void;
    tickets: MergeCandidateTicket[];
    onSuccess?: () => void;
}

export const MergeTicketsModal: React.FC<MergeTicketsModalProps> = ({
    isOpen,
    onClose,
    tickets,
    onSuccess,
}) => {
    const [primaryTicketId, setPrimaryTicketId] = useState<string>('');
    const [reason, setReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [entered, setEntered] = useState<boolean>(false);
    const queryClient = useQueryClient();

    // Default primary ticket to the first ticket in the list
    useEffect(() => {
        if (isOpen && tickets.length > 0) {
            setPrimaryTicketId(tickets[0].id);
            setReason('');
            setError(null);
            setEntered(false);
            const timer = setTimeout(() => setEntered(true), 50);
            return () => clearTimeout(timer);
        } else {
            setEntered(false);
        }
    }, [isOpen, tickets]);

    if (!isOpen || tickets.length < 2) return null;

    const primaryTicket = tickets.find((t) => t.id === primaryTicketId) || tickets[0];
    const secondaryTickets = tickets.filter((t) => t.id !== primaryTicket.id);

    const handleMergeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!primaryTicketId || secondaryTickets.length === 0) {
            setError('Pilih minimal 1 tiket utama dan tiket lainnya untuk digabungkan.');
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            await api.post('/tickets/merge', {
                primaryTicketId: primaryTicket.id,
                secondaryTicketIds: secondaryTickets.map((t) => t.id),
                reason: reason.trim() || undefined,
            });

            toast.success(`${secondaryTickets.length} tiket berhasil digabungkan ke #${primaryTicket.ticketNumber || primaryTicket.id}`);
            
            // Invalidate queries so lists and details refresh automatically
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['ticket', primaryTicket.id] });
            secondaryTickets.forEach((t) => {
                queryClient.invalidateQueries({ queryKey: ['ticket', t.id] });
            });

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Gagal menggabungkan tiket';
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 select-none"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200",
                    entered ? "opacity-100" : "opacity-0"
                )}
                onClick={() => {
                    if (!isSubmitting) onClose();
                }}
            />

            {/* Modal Box */}
            <div
                className={cn(
                    "relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden transition-all duration-200",
                    entered ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/70 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-2xs">
                            <GitMerge className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                                    Gabungkan Tiket (Merge)
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                                    {tickets.length} Tiket
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Satukan tiket kendala yang sama menjadi 1 tiket diskusi terpusat
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleMergeSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                    {error && (
                        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Instruction Box */}
                    <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2.5">
                        <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="space-y-1 leading-relaxed">
                            <p className="font-semibold">
                                Pilih 1 Tiket Utama (Parent) di bawah:
                            </p>
                            <p className="text-blue-700/90 dark:text-blue-300/80 text-[11px]">
                                Pelapor dari tiket lainnya akan otomatis didaftarkan sebagai <strong>Peserta (Participants)</strong> di tiket utama. SLA, status, dan penugasan agent akan mengikuti tiket utama.
                            </p>
                        </div>
                    </div>

                    {/* List of Candidate Tickets */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Daftar Tiket yang Dipilih ({tickets.length})
                        </label>

                        <div className="space-y-2">
                            {tickets.map((t) => {
                                const isPrimary = t.id === primaryTicketId;
                                const statusCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.TODO;
                                const priorityCfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.MEDIUM;

                                return (
                                    <div
                                        key={t.id}
                                        onClick={() => !isSubmitting && setPrimaryTicketId(t.id)}
                                        className={cn(
                                            "p-3.5 rounded-2xl border transition-all cursor-pointer select-none space-y-2 relative",
                                            isPrimary
                                                ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-sm ring-2 ring-indigo-500/20"
                                                : "bg-white dark:bg-slate-800/60 border-slate-200/90 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {/* Radio indicator */}
                                                <div className={cn(
                                                    "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                                    isPrimary
                                                        ? "border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-400"
                                                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                                                )}>
                                                    {isPrimary && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />}
                                                </div>

                                                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    #{t.ticketNumber || t.id.slice(0, 8)}
                                                </span>

                                                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", statusCfg.color)}>
                                                    {statusCfg.label}
                                                </span>

                                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", priorityCfg.dot)} />
                                                    {priorityCfg.label}
                                                </span>
                                            </div>

                                            {/* Badge Primary or Child */}
                                            {isPrimary ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-2xs shrink-0">
                                                    <Crown className="w-3 h-3 text-amber-300" />
                                                    <span>Tiket Utama (Parent)</span>
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                                                    ↪ Akan Digabungkan (Child)
                                                </span>
                                            )}
                                        </div>

                                        {/* Title */}
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 pl-6 leading-snug line-clamp-2">
                                            {t.title}
                                        </p>

                                        {/* Requester & Metadata */}
                                        <div className="flex flex-wrap items-center gap-3 pl-6 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                                            <span className="inline-flex items-center gap-1">
                                                <UserIcon className="w-3 h-3 text-slate-400" />
                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                    {t.user?.fullName || 'User'}
                                                </span>
                                                {t.user?.department?.name && (
                                                    <span className="text-[10px] text-slate-400">({t.user.department.name})</span>
                                                )}
                                            </span>

                                            {t.createdAt && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 ml-auto">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    <span>Dibuat: {formatDateTimeID(t.createdAt)}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Reason Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Alasan Penggabungan <span className="text-slate-400 font-normal">(Opsional)</span>
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Contoh: Kendala jaringan yang sama di Lantai 2 / Masalah massal"
                            disabled={isSubmitting}
                            className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            Batal
                        </button>

                        <button
                            type="submit"
                            disabled={isSubmitting || !primaryTicketId}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Menggabungkan...</span>
                                </>
                            ) : (
                                <>
                                    <GitMerge className="w-3.5 h-3.5" />
                                    <span>Gabungkan {tickets.length} Tiket</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
