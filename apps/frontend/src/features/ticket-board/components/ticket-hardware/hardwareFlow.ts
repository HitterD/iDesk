import type { RequestStatus as KnownRequestStatus } from '@/features/hardware-request/types';

/** The backend also has CLOSED (after COMPLETED), which the Hardware Request pages never show. */
export type RequestStatus = KnownRequestStatus | 'CLOSED';

/** Mirrors the backend's HardwareRequestType: the flows ICT can pick when proposing from a ticket. */
export type HardwareRequestType = 'BUDGET_ANNUAL' | 'NON_BUDGET' | 'HARDWARE_INSTALLATION';

/** Mirrors HardwareTicketPhase (backend utils/ticket-activity.util.ts). */
export type HardwareTicketPhase =
    | 'PROPOSED' | 'SUBMITTED' | 'DECLINED' | 'WITHDRAWN' | 'APPROVED' | 'REJECTED' | 'PROCUREMENT_DONE'
    | 'SCHEDULE_PROPOSED' | 'SCHEDULED' | 'INSTALLED' | 'ISSUE_REPORTED' | 'COMPLETED' | 'CANCELLED';

/** Latest installation schedule. PROPOSED: one time to confirm; PROPOSED_AWAITING_USER: `slots` to pick from. */
export interface TicketHardwareSchedule {
    id: string;
    start: string | null;
    end: string | null;
    status: string;
    proposedById: string | null;
    slots: Array<{ start: string; end: string }>;
}

export interface TicketHardwareRequest {
    id: string;
    requestNumber: string;
    status: RequestStatus;
    requestType: HardwareRequestType;
    justification: string;
    rejectReason: string | null;
    requesterId: string;
    proposedBy: { id: string; name: string } | null;
    items: Array<{ name: string; category: string | null; quantity: number }>;
    schedule: TicketHardwareSchedule | null;
    createdAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
    procuredAt: string | null;
    installMarkedDoneAt: string | null;
    completedAt: string | null;
}

export const FLOW_OPTIONS: Array<{ value: HardwareRequestType; label: string; hint: string }> = [
    { value: 'HARDWARE_INSTALLATION', label: 'Pasang dari stok', hint: 'Barang sudah ada. Langsung dijadwalkan pemasangan.' },
    { value: 'BUDGET_ANNUAL', label: 'Budget tahunan', hint: 'Pengadaan dari anggaran divisi, lewat review ICT.' },
    { value: 'NON_BUDGET', label: 'Non-budget', hint: 'Di luar anggaran, perlu persetujuan ICT.' },
];

export const FLOW_LABEL: Record<HardwareRequestType, string> = Object.fromEntries(
    FLOW_OPTIONS.map((option) => [option.value, option.label]),
) as Record<HardwareRequestType, string>;

interface FlowStep { label: string; statuses: RequestStatus[] }

const CONFIRM_STEP: FlowStep = { label: 'Konfirmasi pemohon', statuses: ['DRAFT'] };
const FINISH_STEPS: FlowStep[] = [
    { label: 'Cek hasil', statuses: ['AWAITING_USER_CONFIRMATION'] },
    { label: 'Selesai', statuses: ['COMPLETED', 'CLOSED'] },
];

/** Steps the ticket shows; several request statuses fold into one step so the bar stays short. */
export const FLOW_STEPS: Record<HardwareRequestType, FlowStep[]> = {
    HARDWARE_INSTALLATION: [
        CONFIRM_STEP,
        { label: 'Jadwal & pemasangan', statuses: ['SUBMITTED', 'INSTALLATION'] },
        ...FINISH_STEPS,
    ],
    BUDGET_ANNUAL: [
        CONFIRM_STEP,
        { label: 'Review ICT', statuses: ['SUBMITTED', 'UNDER_REVIEW'] },
        { label: 'Pengadaan', statuses: ['APPROVED', 'PROCUREMENT', 'AWAITING_DELIVERY'] },
        { label: 'Pemasangan', statuses: ['INSTALLATION'] },
        ...FINISH_STEPS,
    ],
    NON_BUDGET: [],
};
FLOW_STEPS.NON_BUDGET = FLOW_STEPS.BUDGET_ANNUAL;

export const isStopped = (status: RequestStatus) => status === 'REJECTED' || status === 'CANCELLED';

/** Index of the step the request is on (the last step once it is done); -1 for a stopped request. */
export function currentStep(type: HardwareRequestType, status: RequestStatus): number {
    if (isStopped(status)) return -1;
    return FLOW_STEPS[type].findIndex((step) => step.statuses.includes(status));
}

type ScheduleView = Pick<TicketHardwareSchedule, 'start' | 'status'> & Partial<Pick<TicketHardwareSchedule, 'proposedById' | 'slots'>>;
type RequestView = { status: RequestStatus; requesterId?: string; schedule: ScheduleView | null };

/** What the requester has to answer about the installation schedule, if anything. */
export function scheduleAsk(request: RequestView): 'pick' | 'confirm' | null {
    if (request.status !== 'INSTALLATION' || !request.schedule) return null;
    if (request.schedule.status === 'PROPOSED_AWAITING_USER') return 'pick';
    // A single proposed time is answered by the other side: the requester confirms what ICT proposed.
    if (request.schedule.status === 'PROPOSED' && request.schedule.proposedById !== request.requesterId) return 'confirm';
    return null;
}

/** One-line state for the requester and the agent alike. */
export function statusSentence(request: Pick<TicketHardwareRequest, 'status' | 'requestType'> & RequestView): string {
    switch (request.status) {
        case 'DRAFT': return 'Menunggu konfirmasi pemohon';
        case 'SUBMITTED': return request.requestType === 'HARDWARE_INSTALLATION' ? 'Menunggu jadwal pemasangan' : 'Menunggu review ICT';
        case 'UNDER_REVIEW': return 'Sedang direview ICT';
        case 'APPROVED': return 'Disetujui, menunggu pengadaan';
        case 'PROCUREMENT': return 'Dalam pengadaan';
        case 'AWAITING_DELIVERY': return 'Menunggu barang datang';
        case 'INSTALLATION': {
            const ask = scheduleAsk(request);
            if (ask === 'pick') return 'Pilih jadwal pemasangan';
            if (ask === 'confirm') return 'Konfirmasi jadwal pemasangan';
            if (request.schedule?.status === 'RESCHEDULE_REQUESTED') return 'Pemohon minta jadwal lain';
            return request.schedule?.start && ['CONFIRMED', 'IN_PROGRESS'].includes(request.schedule.status)
                ? 'Pemasangan terjadwal' : 'Menunggu jadwal pemasangan';
        }
        case 'AWAITING_USER_CONFIRMATION': return 'Pemasangan selesai, mohon dicek';
        case 'COMPLETED': case 'CLOSED': return 'Selesai';
        case 'REJECTED': return 'Ditolak ICT';
        case 'CANCELLED': return 'Dibatalkan';
        default: return request.status;
    }
}

/** Something the requester has to do (answered right in the ticket card). */
export function requesterTodo(request: RequestView): string | null {
    const ask = scheduleAsk(request);
    if (ask === 'pick') return 'Pilih jadwal';
    if (ask === 'confirm') return 'Konfirmasi jadwal';
    if (request.status === 'AWAITING_USER_CONFIRMATION') return 'Konfirmasi pemasangan';
    return null;
}

/** The next step ICT takes on the Hardware Request page, so the agent in the ticket knows where it stands. */
export function staffTodo(request: Pick<TicketHardwareRequest, 'requestType'> & RequestView): string | null {
    switch (request.status) {
        case 'SUBMITTED': return request.requestType === 'HARDWARE_INSTALLATION' ? 'Jadwalkan pemasangan' : 'Review usulan';
        case 'UNDER_REVIEW': return 'Putuskan review';
        case 'APPROVED': case 'PROCUREMENT': return 'Proses pengadaan';
        case 'AWAITING_DELIVERY': return 'Catat barang datang';
        case 'INSTALLATION':
            if (!request.schedule || request.schedule.status === 'RESCHEDULE_REQUESTED') return 'Atur jadwal pemasangan';
            if (request.schedule.status === 'CONFIRMED' || request.schedule.status === 'IN_PROGRESS') return 'Selesaikan pemasangan';
            return null;
        default: return null;
    }
}
