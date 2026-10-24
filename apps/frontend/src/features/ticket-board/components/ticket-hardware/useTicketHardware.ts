import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ticketHardwareApi, type ProposeHardwarePayload } from './api';

export const ticketHardwareKey = (ticketId: string) => ['ticket', ticketId, 'hardware-requests'] as const;

export function useTicketHardwareRequests(ticketId: string | undefined, enabled = true) {
    return useQuery({
        queryKey: ticketHardwareKey(ticketId ?? ''),
        queryFn: () => ticketHardwareApi.list(ticketId!),
        enabled: Boolean(ticketId) && enabled,
        staleTime: 15_000,
    });
}

/** Any change re-reads the ticket too: its status and chat move with the request. */
function useRefresh(ticketId: string) {
    const queryClient = useQueryClient();
    return () => Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketHardwareKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticketId], exact: true }),
    ]);
}

export function useProposeHardware(ticketId: string) {
    const refresh = useRefresh(ticketId);
    return useMutation({
        mutationFn: (payload: ProposeHardwarePayload) => ticketHardwareApi.propose(ticketId, payload),
        onSuccess: async (request) => {
            await refresh();
            toast.success(`${request.requestNumber} dikirim ke pemohon untuk dikonfirmasi`);
        },
    });
}

export function useAnswerProposal(ticketId: string) {
    const refresh = useRefresh(ticketId);
    const accept = useMutation({
        mutationFn: ticketHardwareApi.accept,
        onSuccess: async () => { await refresh(); toast.success('Hardware request diajukan. Progresnya tampil di tiket ini.'); },
        onError: (error: Error) => toast.error(error.message || 'Gagal mengajukan hardware request'),
    });
    const decline = useMutation({
        mutationFn: ticketHardwareApi.decline,
        onSuccess: async () => { await refresh(); toast.success('Usulan ditolak. Tim IT akan menindaklanjuti di chat.'); },
        onError: (error: Error) => toast.error(error.message || 'Gagal menolak usulan'),
    });
    return { accept, decline };
}
