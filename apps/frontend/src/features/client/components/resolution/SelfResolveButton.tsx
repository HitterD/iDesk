import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage, invalidateTicketQueries } from './resolutionApi';

interface SelfResolveButtonProps {
    ticketId: string;
    /** Display number for the confirmation copy. */
    ticketNumber?: string;
    className?: string;
    /** Called after the ticket was closed by the requester. */
    onResolved?: () => void;
}

/** Mockup ticket.html?as=user: the single primary action "Masalah sudah selesai". */
export const SelfResolveButton: React.FC<SelfResolveButtonProps> = ({ ticketId, ticketNumber, className, onResolved }) => {
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
            <Button variant="primary" onClick={() => setIsOpen(true)} className={className} title="Tutup tiket karena masalah sudah selesai">
                <CheckCircle2 aria-hidden="true" />
                <span>Masalah sudah selesai</span>
            </Button>
            <ConfirmationDialog
                appearance="ticket"
                isOpen={isOpen}
                onCancel={() => setIsOpen(false)}
                onConfirm={() => selfResolveMutation.mutate()}
                isLoading={selfResolveMutation.isPending}
                title="Masalah sudah selesai?"
                description={`Tiket${ticketNumber ? ` #${ticketNumber}` : ''} akan ditutup dan tidak dapat dibalas lagi. Anda bisa membuat tiket baru jika kendala muncul lagi.`}
                confirmText="Ya, tutup tiket"
                cancelText="Belum"
                variant="success"
            />
        </>
    );
};

export default SelfResolveButton;
