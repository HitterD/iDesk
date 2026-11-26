import type { BusinessHoursService } from '../../sla-config/business-hours.service';
import type { Ticket } from '../entities/ticket.entity';
import { TicketStatus } from '../entities/ticket.entity';
import type { SlaClockService } from '../services/sla-clock.service';
import { isNonSlaTicketType } from './non-sla-ticket.util';

/** One working day (08:00-17:00) for the requester to confirm or dispute a resolution. */
export const RESOLUTION_CONFIRMATION_BUSINESS_MINUTES = 540;
const FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

export const TICKET_CLOSED_MESSAGE = 'Tiket sudah ditutup dan tidak dapat diubah. Silakan buat tiket baru.';

/** Deadline for the requester's confirmation, counted in business hours when available. */
export async function computeResolutionDeadline(
    businessHours: BusinessHoursService | null | undefined,
    from: Date,
): Promise<Date> {
    if (!businessHours) {
        return new Date(from.getTime() + FALLBACK_WINDOW_MS);
    }
    return businessHours.calculateSlaTarget(from, RESOLUTION_CONFIRMATION_BUSINESS_MINUTES);
}

/** Human-readable deadline for notifications, in the office time zone. */
export function formatResolutionDeadline(deadline: Date | string): string {
    return new Date(deadline).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        dateStyle: 'medium',
        timeStyle: 'short',
    }) + ' WIB';
}

/**
 * A RESOLVED ticket goes back to the agent because the requester disputes it (or reports an issue): no longer done,
 * no confirmation window, and the clock that kept running keeps its original target. The caller saves the ticket.
 */
export function reopenAsDispute(
    ticket: Ticket,
    slaClock?: Pick<SlaClockService, 'resumeOnOriginalTarget'> | null,
    now: Date = new Date(),
): void {
    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.disputedAt = now;
    ticket.resolutionDeadlineAt = null;
    // The next resolve sets a fresh timestamp.
    ticket.resolvedAt = null;
    if (slaClock && !isNonSlaTicketType(ticket)) {
        slaClock.resumeOnOriginalTarget(ticket, now);
    }
}
