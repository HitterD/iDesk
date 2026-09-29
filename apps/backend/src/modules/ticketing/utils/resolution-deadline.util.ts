import type { BusinessHoursService } from '../../sla-config/business-hours.service';

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
