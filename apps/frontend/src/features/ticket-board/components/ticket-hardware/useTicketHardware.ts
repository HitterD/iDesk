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
    const withdraw = useMutation({
        mutationFn: ticketHardwareApi.decline,
        onSuccess: async () => { await refresh(); toast.success('Usulan ditarik. Anda bisa mengusulkan ulang dari menu +.'); },
        onError: (error: Error) => toast.error(error.message || 'Gagal menarik usulan'),
    });
    return { accept, decline, withdraw };
}

/** The requester's answers about the installation (schedule, result), straight from the ticket card. */
export function useRequesterSteps(ticketId: string) {
    const refresh = useRefresh(ticketId);
    const fail = (fallback: string) => (error: Error) => toast.error(error.message || fallback);
    const pickSlot = useMutation({
        mutationFn: ticketHardwareApi.pickSlot,
        onSuccess: async () => { await refresh(); toast.success('Jadwal pemasangan dipilih'); },
        onError: fail('Gagal memilih jadwal'),
    });
    const confirmSchedule = useMutation({
        mutationFn: ticketHardwareApi.confirmSchedule,
        onSuccess: async () => { await refresh(); toast.success('Jadwal pemasangan disetujui'); },
        onError: fail('Gagal menyetujui jadwal'),
    });
    const confirmInstallation = useMutation({
        mutationFn: ticketHardwareApi.confirmInstallation,
        onSuccess: async (_data, { ok }) => {
            await refresh();
            toast.success(ok ? 'Terima kasih, pemasangan dikonfirmasi' : 'Masalah dilaporkan ke tim IT');
        },
        onError: fail('Gagal mengirim konfirmasi'),
    });
    return { pickSlot, confirmSchedule, confirmInstallation };
}

const NOT_HOLDING = new Set(['DRAFT', 'REJECTED', 'CANCELLED', 'COMPLETED', 'CLOSED']);

/**
 * The hardware request a WAITING_VENDOR ticket is actually waiting on (it was submitted from this ticket and is
 * still running), so the ticket can say so instead of "waiting for a vendor". Null for a real vendor wait.
 */
export function useHardwareHold(ticket: { id: string; status: string }) {
    const waiting = ticket.status === 'WAITING_VENDOR';
    const { data } = useTicketHardwareRequests(ticket.id, waiting);
    if (!waiting) return null;
    return data?.filter((request) => !NOT_HOLDING.has(request.status)).at(-1) ?? null;
}
