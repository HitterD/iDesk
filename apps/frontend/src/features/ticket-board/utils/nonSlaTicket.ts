export interface NonSlaCheckInput {
    isNonSla?: boolean | null;
    requestKind?: 'HARDWARE' | 'EFORM' | string | null;
    ticketType?: string | null;
}

export interface NonSlaStageInput extends NonSlaCheckInput {
    status?: string | null;
    flowPhase?: string | null;
    flowPhaseLabel?: string | null;
    flowPhaseSince?: string | null;
    installScheduledAt?: string | null;
    scheduledDate?: string | null;
    createdAt?: string | null;
}

export interface NonSlaStageDisplay {
    top: string;
    bottom: string;
    chipText: string;
    tooltip: string;
    isLong: boolean;
    isScheduled: boolean;
    isDone: boolean;
    isCancelled: boolean;
}

const MS_PER_DAY = 86_400_000;
const LONG_WAIT_DAYS = 7;

const SHORT_WIB_DATE = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
});

const DETAIL_STAGE_SHORT: Record<string, string> = {
    schedule: 'Pemasangan',
    install: 'Pemasangan',
};

/** Shared frontend predicate matching backend `isNonSlaTicket`. */
export function isNonSlaTicket(ticket?: NonSlaCheckInput | null): boolean {
    if (!ticket) return false;
    return Boolean(
        ticket.isNonSla ||
        ticket.requestKind ||
        ticket.ticketType === 'HARDWARE_REQUEST' ||
        ticket.ticketType === 'EFORM_REQUEST',
    );
}

/** Short WIB weekday/date label like "Kam, 3 Des". */
export function formatShortWibDate(iso: string): string | null {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return SHORT_WIB_DATE.format(date);
}

export function elapsedDaysSince(sinceIso?: string | null, now: Date = new Date()): number | null {
    if (!sinceIso) return null;
    const ms = new Date(sinceIso).getTime();
    if (!Number.isFinite(ms)) return null;
    return Math.max(0, Math.floor((now.getTime() - ms) / MS_PER_DAY));
}

/** Neutral stage and wait-age summary for Hardware & E-Form tickets (never uses SLA urgency). */
export function describeNonSlaStage(input: NonSlaStageInput, now: Date = new Date()): NonSlaStageDisplay {
    const status = input.status ?? '';
    if (status === 'RESOLVED' || status === 'CLOSED') {
        return {
            top: 'Selesai',
            bottom: '',
            chipText: 'Selesai',
            tooltip: 'Permintaan selesai · Hardware & E-Form tidak memakai SLA',
            isLong: false,
            isScheduled: false,
            isDone: true,
            isCancelled: false,
        };
    }

    if (status === 'CANCELLED') {
        return {
            top: 'Dibatalkan',
            bottom: '',
            chipText: 'Dibatalkan',
            tooltip: 'Permintaan dibatalkan · Hardware & E-Form tidak memakai SLA',
            isLong: false,
            isScheduled: false,
            isDone: false,
            isCancelled: true,
        };
    }

    const scheduleIso = input.installScheduledAt || input.scheduledDate;
    const scheduleFormatted = scheduleIso ? formatShortWibDate(scheduleIso) : null;
    if (scheduleFormatted) {
        return {
            top: 'Jadwal instalasi',
            bottom: scheduleFormatted,
            chipText: `Jadwal instalasi · ${scheduleFormatted}`,
            tooltip: `Jadwal instalasi: ${scheduleFormatted} · Hardware & E-Form tidak memakai SLA`,
            isLong: false,
            isScheduled: true,
            isDone: false,
            isCancelled: false,
        };
    }

    const fallbackStage = input.ticketType === 'EFORM_REQUEST' ? 'Proses E-Form' : 'Proses permintaan';
    const stageLabel = input.flowPhaseLabel || fallbackStage;
    const anchor = input.flowPhaseSince || input.createdAt;
    const days = elapsedDaysSince(anchor, now);
    const isLong = days !== null && days > LONG_WAIT_DAYS;
    const ageText = days === null
        ? 'Tanpa SLA'
        : days === 0
            ? 'Hari ini'
            : `${days} hari`;
    const bottom = isLong ? `${ageText} · lama` : ageText;
    const detailStage = (input.flowPhase && DETAIL_STAGE_SHORT[input.flowPhase]) || stageLabel;
    const chipText = days === null ? detailStage : `${detailStage} · ${ageText}`;
    const tooltip = days === null
        ? `${stageLabel} · Hardware & E-Form tidak memakai SLA`
        : `${stageLabel} (${ageText}) · Hardware & E-Form tidak memakai SLA`;

    return {
        top: stageLabel,
        bottom,
        chipText,
        tooltip,
        isLong,
        isScheduled: false,
        isDone: false,
        isCancelled: false,
    };
}
