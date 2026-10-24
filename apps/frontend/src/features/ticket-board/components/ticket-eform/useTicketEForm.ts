import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ticketEFormApi, type ProposeEFormPayload } from './api';

export const ticketEFormKey = (ticketId: string) => ['ticket', ticketId, 'eform-requests'] as const;

export function useTicketEFormRequests(ticketId: string | undefined, enabled = true) {
    return useQuery({
        queryKey: ticketEFormKey(ticketId ?? ''),
        queryFn: () => ticketEFormApi.list(ticketId!),
        enabled: Boolean(ticketId) && enabled,
        staleTime: 15_000,
    });
}

/** Any change re-reads the ticket too: its status and chat move with the request. */
function useRefresh(ticketId: string) {
    const queryClient = useQueryClient();
    return () => Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketEFormKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticketId], exact: true }),
    ]);
}

export function useProposeEForm(ticketId: string) {
    const refresh = useRefresh(ticketId);
    return useMutation({
        mutationFn: (payload: ProposeEFormPayload) => ticketEFormApi.propose(ticketId, payload),
        onSuccess: async () => { await refresh(); toast.success('Usulan akses dikirim ke pemohon untuk ditandatangani'); },
        onError: (error: Error) => toast.error(error.message || 'Gagal mengirim usulan akses'),
    });
}

export function useCancelEFormProposal(ticketId: string, byRequester: boolean) {
    const refresh = useRefresh(ticketId);
    return useMutation({
        mutationFn: ticketEFormApi.cancel,
        onSuccess: async () => {
            await refresh();
            toast.success(byRequester ? 'Usulan ditolak. Tim IT akan menindaklanjuti di chat.' : 'Usulan ditarik.');
        },
        onError: (error: Error) => toast.error(error.message || 'Gagal membatalkan usulan'),
    });
}

const HOLDING = new Set(['PENDING_MANAGER', 'PENDING_GM', 'PENDING_ICT']);

/** The e-form request a WAITING_VENDOR ticket is waiting on, so it can say so instead of "waiting for a vendor". */
export function useEFormHold(ticket: { id: string; status: string }) {
    const waiting = ticket.status === 'WAITING_VENDOR';
    const { data } = useTicketEFormRequests(ticket.id, waiting);
    if (!waiting) return null;
    return data?.filter((request) => HOLDING.has(request.status)).at(-1) ?? null;
}
