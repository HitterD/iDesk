/** Mirrors EFormTicketPhase (backend ticketing/utils/ticket-activity.util.ts). */
export type EFormTicketPhase = 'PROPOSED' | 'DECLINED' | 'WITHDRAWN' | 'SUBMITTED' | 'MANAGER_APPROVED' | 'GM_APPROVED' | 'GRANTED' | 'REJECTED';

export type EFormStatus = 'DRAFT' | 'PENDING_MANAGER' | 'PENDING_GM' | 'PENDING_ICT' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
export type EFormType = 'VPN' | 'WEBSITE' | 'NETWORK' | 'FLASHDISK' | 'EMAIL' | 'SYNOLOGY_NAS';

/** What a ticket knows about one e-form request proposed from it (backend TicketEFormSummary). */
export interface TicketEFormRequest {
    id: string;
    code: string;
    /** Running document number once submitted, e.g. F/ICT/04/0012. */
    documentNumber?: string | null;
    formType: EFormType;
    status: EFormStatus;
    note: string;
    requesterId: string;
    proposedBy: { id: string; name: string } | null;
    approverName: string | null;
    rejectionReason: string | null;
    createdAt: string;
    submittedAt: string | null;
    resolvedAt: string | null;
}

/** Synology access skips the manager (and so the GM): it goes from the requester straight to ICT. */
const skipsManager = (type: EFormType) => type === 'SYNOLOGY_NAS';

interface FlowStep { label: string; statuses: EFormStatus[] }

/** Steps the ticket shows for this access type. */
export function flowSteps(type: EFormType): FlowStep[] {
    return [
        { label: 'Tanda tangan pemohon', statuses: ['DRAFT'] },
        ...(skipsManager(type) ? [] : [
            { label: 'Persetujuan atasan', statuses: ['PENDING_MANAGER'] as EFormStatus[] },
            { label: 'Tanda tangan GM', statuses: ['PENDING_GM'] as EFormStatus[] },
        ]),
        { label: 'Proses ICT', statuses: ['PENDING_ICT'] },
        { label: 'Akses aktif', statuses: ['CONFIRMED'] },
    ];
}

export const isStopped = (status: EFormStatus) => status === 'REJECTED' || status === 'CANCELLED';

/** Index of the current step (the last one once access is active); -1 for a stopped request. */
export function currentStep(type: EFormType, status: EFormStatus): number {
    if (isStopped(status)) return -1;
    return flowSteps(type).findIndex((step) => step.statuses.includes(status));
}

/** One-line state for the requester and the agent alike. */
export function statusSentence(request: Pick<TicketEFormRequest, 'status' | 'approverName'>): string {
    switch (request.status) {
        case 'DRAFT': return 'Menunggu pemohon melengkapi & tanda tangan';
        case 'PENDING_MANAGER': return request.approverName ? `Menunggu persetujuan ${request.approverName}` : 'Menunggu persetujuan atasan';
        case 'PENDING_GM': return 'Menunggu tanda tangan GM';
        case 'PENDING_ICT': return 'Sedang disiapkan tim ICT';
        case 'CONFIRMED': return 'Akses sudah aktif';
        case 'REJECTED': return 'Ditolak';
        case 'CANCELLED': return 'Tidak dilanjutkan';
        default: return request.status;
    }
}

/** ICT's next step, shown to the agent in the ticket; the work happens on the e-form page. */
export const staffTodo = (request: Pick<TicketEFormRequest, 'status'>): string | null =>
    request.status === 'PENDING_GM' ? 'Unggah TTD GM' : request.status === 'PENDING_ICT' ? 'Proses akses' : null;

/** VPN needs as the e-form page offers them (VPN_NEED_OPTIONS ids in EformAccessCreatePage). */
export const VPN_NEEDS = ['Remote PC Kantor', 'Akses Jaringan Kantor'] as const;
