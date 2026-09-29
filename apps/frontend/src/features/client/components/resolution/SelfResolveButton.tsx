import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, invalidateTicketQueries } from './resolutionApi';

interface SelfResolveButtonProps {
    ticketId: string;
    className?: string;
    /** Hide the text label (compact mobile header). */
    iconOnly?: boolean;
    /** Called after the ticket was closed by the requester. */
    onResolved?: () => void;
}

/** Lets the requester close their own open ticket ("Tandai Selesai"). */
export const SelfResolveButton: React.FC<SelfResolveButtonProps> = ({ ticketId, className, iconOnly, onResolved }) => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);

    const selfResolveMutation = useMutation({
        mutationFn: async () =>
            (await api.post(`/tickets/${ticketId}/self-resolve`, {}, { skipToast: true })).data,
        onSuccess: async () => {
            toast.success('Tiket ditandai selesai dan telah ditutup.');
            setIsOpen(false);
            await invalidateTicketQueries(queryClient, ticketId);
            onResolved?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menandai tiket selesai')),
    });

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                title="Tandai Selesai"
                aria-label="Tandai Selesai"
                className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold transition-colors cursor-pointer',
                    iconOnly ? 'p-1.5' : 'px-3 py-1.5',
                    className,
                )}
            >
                <CheckCircle2 className={iconOnly ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                {!iconOnly && <span>Tandai Selesai</span>}
            </button>
            <ConfirmationDialog
                isOpen={isOpen}
                onCancel={() => setIsOpen(false)}
                onConfirm={() => selfResolveMutation.mutate()}
                isLoading={selfResolveMutation.isPending}
                title="Tandai Selesai"
                description="Apakah masalah Anda benar-benar sudah selesai? Tiket akan ditutup dan tidak dapat dibalas lagi."
                confirmText="Ya, sudah selesai"
                cancelText="Batal"
                variant="success"
            />
        </>
    );
};

export default SelfResolveButton;
