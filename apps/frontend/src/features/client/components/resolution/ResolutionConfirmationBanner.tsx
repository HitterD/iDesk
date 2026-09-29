import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { DISPUTE_REASON_MAX, getApiErrorMessage, invalidateTicketQueries } from './resolutionApi';

interface ResolutionConfirmationBannerProps {
    ticketId: string;
    deadlineAt?: string | null;
    /** Called after the requester confirmed the resolution (ticket is now CLOSED). */
    onConfirmed?: () => void;
}

/**
 * Shown to the requester while a ticket is RESOLVED: asks them to confirm the
 * fix or report that the problem persists before the auto-close deadline.
 */
export const ResolutionConfirmationBanner: React.FC<ResolutionConfirmationBannerProps> = ({
    ticketId,
    deadlineAt,
    onConfirmed,
}) => {
    const queryClient = useQueryClient();
    const [isDisputeOpen, setIsDisputeOpen] = useState(false);
    const [reason, setReason] = useState('');

    const confirmMutation = useMutation({
        mutationFn: async () =>
            (await api.post(`/tickets/${ticketId}/confirm-resolution`, {}, { skipToast: true })).data,
        onSuccess: async () => {
            toast.success('Terima kasih! Tiket telah ditutup.');
            await invalidateTicketQueries(queryClient, ticketId);
            onConfirmed?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal mengonfirmasi penyelesaian tiket')),
    });

    const disputeMutation = useMutation({
        mutationFn: async (disputeReason: string) =>
            (await api.post(`/tickets/${ticketId}/dispute`, { reason: disputeReason }, { skipToast: true })).data,
        onSuccess: async () => {
            toast.success('Tiket dibuka kembali. Tim IT akan menindaklanjuti.');
            setIsDisputeOpen(false);
            setReason('');
            await invalidateTicketQueries(queryClient, ticketId);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal membuka kembali tiket')),
    });

    const trimmedReason = reason.trim();
    const isBusy = confirmMutation.isPending || disputeMutation.isPending;

    return (
        <div
            role="region"
            aria-label="Konfirmasi penyelesaian tiket"
            className="mx-3 sm:mx-6 mt-3 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0"
        >
            <div className="flex items-start gap-3 flex-1 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                        Tim IT menandai tiket ini sudah selesai. Apakah masalah Anda sudah teratasi?
                    </p>
                    {deadlineAt && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>
                                Tiket akan ditutup otomatis pada {formatDateTimeID(deadlineAt)} jika tidak ada tanggapan.
                            </span>
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={() => setIsDisputeOpen(true)}
                    disabled={isBusy}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer disabled:opacity-50"
                >
                    Masih bermasalah
                </button>
                <button
                    type="button"
                    onClick={() => confirmMutation.mutate()}
                    disabled={isBusy}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                    {confirmMutation.isPending ? 'Memproses...' : 'Ya, sudah selesai'}
                </button>
            </div>

            <ConfirmationDialog
                isOpen={isDisputeOpen}
                onCancel={() => { setIsDisputeOpen(false); setReason(''); }}
                onConfirm={() => disputeMutation.mutate(trimmedReason)}
                isLoading={disputeMutation.isPending}
                confirmDisabled={!trimmedReason}
                title="Masih bermasalah?"
                description="Jelaskan kendala yang masih Anda alami. Tiket akan dibuka kembali untuk tim IT."
                confirmText="Buka Kembali Tiket"
                cancelText="Batal"
                variant="warning"
            >
                <label htmlFor="dispute-reason" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Alasan <span className="text-rose-500">*</span>
                </label>
                <textarea
                    id="dispute-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={DISPUTE_REASON_MAX}
                    rows={3}
                    required
                    disabled={disputeMutation.isPending}
                    placeholder="Contoh: printer masih tidak bisa mencetak setelah restart..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
                />
                <p className="text-[10px] text-slate-400 text-right mt-1">{reason.length}/{DISPUTE_REASON_MAX}</p>
            </ConfirmationDialog>
        </div>
    );
};

export default ResolutionConfirmationBanner;
