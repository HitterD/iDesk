import { useCallback, useState } from 'react';
import { useAuth } from '@/stores/useAuth';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';
import type {
    ReassignConfirmDialogProps,
    ReassignTicketInfo,
    TakeoverTicketSummary,
} from '../components/ReassignConfirmDialog';

/** Same value as the backend's `REASSIGN_CONFIRMATION_REQUIRED` (status-takeover.ts). */
export const REASSIGN_CONFIRMATION_REQUIRED = 'REASSIGN_CONFIRMATION_REQUIRED';

const HTTP_CONFLICT = 409;
const IN_PROGRESS = 'IN_PROGRESS';
/** Only these roles may start a ticket without becoming its PIC (backend answers 403 otherwise). */
const KEEP_ASSIGNEE_ROLES: readonly string[] = ['ADMIN', 'MANAGER'];
const RETRY_FAILED_MESSAGE = 'Gagal mengubah status tiket';
const BULK_TICKET_ID = 'bulk';
const BULK_TICKET_TITLE = 'Mulai pengerjaan beberapa tiket';

/** Extra body fields for `PATCH /tickets/:id/status` and `PATCH /tickets/bulk/update`. */
export interface TakeoverOptions {
    takeover?: true;
    keepAssignee?: true;
    reason?: string;
}

/** Performs the status change with the given takeover flags; rejects with the axios error. */
export type SendStatus = (opts: TakeoverOptions) => Promise<unknown>;

export interface TakeoverTicket {
    id: string;
    ticketNumber?: string;
    title?: string;
    status: string;
    assignedTo?: { id: string; fullName: string } | null;
}

interface AssigneeRef {
    id: string;
    fullName: string;
}

interface ConflictBody {
    code?: string;
    currentAssignee?: AssigneeRef;
    tickets?: { id: string; ticketNumber: string; currentAssignee: AssigneeRef }[];
}

interface PendingTakeover {
    ticket: ReassignTicketInfo;
    ticketsSummary?: TakeoverTicketSummary[];
    send: SendStatus;
    resolve: (applied: boolean) => void;
}

type PendingDetails = Omit<PendingTakeover, 'send' | 'resolve'>;

export function needsTakeoverConfirm(
    ticket: { assignedTo?: { id: string } | null; status: string },
    newStatus: string,
    currentUserId: string,
): boolean {
    return newStatus === IN_PROGRESS
        && ticket.status !== IN_PROGRESS
        && Boolean(ticket.assignedTo)
        && ticket.assignedTo!.id !== currentUserId;
}

const conflictBody = (err: unknown): ConflictBody | undefined => {
    const response = (err as { response?: { status?: number; data?: ConflictBody } } | null | undefined)?.response;
    return response?.status === HTTP_CONFLICT ? response.data : undefined;
};

export function isTakeoverConflict(err: unknown): boolean {
    return conflictBody(err)?.code === REASSIGN_CONFIRMATION_REQUIRED;
}

/**
 * Errors the takeover dialog surfaces itself — the 409 that opens it and failures of its own
 * retry — so the caller's mutation should not toast them.
 */
export function isHandledByTakeoverDialog(err: unknown, opts?: TakeoverOptions): boolean {
    return isTakeoverConflict(err) || Boolean(opts?.takeover || opts?.keepAssignee);
}

const toTicketInfo = (ticket: TakeoverTicket): ReassignTicketInfo => ({
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    assignedTo: ticket.assignedTo ? { id: ticket.assignedTo.id, fullName: ticket.assignedTo.fullName } : null,
});

const toBulkDetails = (body: ConflictBody): PendingDetails => {
    const conflicts = body.tickets ?? [];
    return {
        ticket: { id: BULK_TICKET_ID, ticketNumber: `${conflicts.length} tiket`, title: BULK_TICKET_TITLE, assignedTo: null },
        ticketsSummary: conflicts.map((t) => ({ ticketNumber: t.ticketNumber, assigneeName: t.currentAssignee.fullName })),
    };
};

/**
 * Confirms a PIC takeover before an agent who isn't the PIC starts a ticket. `request` /
 * `requestBulk` resolve `true` once the change is applied and `false` if the user cancels;
 * errors other than the takeover 409 reject so the caller can report them.
 */
export function useStatusTakeover() {
    const user = useAuth((state) => state.user);
    const [pending, setPending] = useState<PendingTakeover | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const open = useCallback((details: PendingDetails, send: SendStatus) =>
        new Promise<boolean>((resolve) => setPending({ ...details, send, resolve })), []);

    const sendOrOpen = useCallback(async (send: SendStatus, toDetails: (body: ConflictBody) => PendingDetails) => {
        try {
            await send({});
            return true;
        } catch (err) {
            if (!isTakeoverConflict(err)) throw err;
            return open(toDetails(conflictBody(err)!), send);
        }
    }, [open]);

    const request = useCallback((ticket: TakeoverTicket, newStatus: string, send: SendStatus) => {
        const info = toTicketInfo(ticket);
        if (needsTakeoverConfirm(ticket, newStatus, user?.id ?? '')) return open({ ticket: info }, send);
        return sendOrOpen(send, (body) => ({ ticket: { ...info, assignedTo: body.currentAssignee ?? null } }));
    }, [open, sendOrOpen, user?.id]);

    const requestBulk = useCallback((send: SendStatus) => sendOrOpen(send, toBulkDetails), [sendOrOpen]);

    const retry = useCallback(async (opts: TakeoverOptions) => {
        if (!pending) return;
        setIsLoading(true);
        try {
            await pending.send(opts);
        } catch (err) {
            // Shown inside the dialog, which stays open so the user can adjust and retry.
            throw new Error(getApiErrorMessage(err, RETRY_FAILED_MESSAGE));
        } finally {
            setIsLoading(false);
        }
        pending.resolve(true);
        setPending(null);
    }, [pending]);

    const cancel = useCallback(() => {
        pending?.resolve(false);
        setPending(null);
    }, [pending]);

    const canKeepAssignee = KEEP_ASSIGNEE_ROLES.includes(user?.role ?? '');
    const dialogProps: ReassignConfirmDialogProps | null = pending ? {
        isOpen: true,
        onClose: cancel,
        ticket: pending.ticket,
        targetAgent: user ? { id: user.id, fullName: user.fullName, email: user.email, role: user.role } : null,
        onConfirm: (reason: string) => retry({ takeover: true, reason }),
        onKeepAssignee: canKeepAssignee ? () => retry({ keepAssignee: true }) : undefined,
        ticketsSummary: pending.ticketsSummary,
        isLoading,
    } : null;

    return { request, requestBulk, dialogProps };
}
