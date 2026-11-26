import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BusinessHoursService } from '../../sla-config/business-hours.service';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { SlaClockService } from './sla-clock.service';
import { TicketVendorVisitService, formatVendorVisit, normalizeVendorNote } from './ticket-vendor-visit.service';
import { computeResolutionDeadline } from '../utils/resolution-deadline.util';
import { clearTicketSlaColumns, isNonSlaTicket } from '../utils/non-sla-ticket.util';

export interface SlaTransitionDeps {
    slaClock: SlaClockService;
    businessHoursService?: BusinessHoursService | null;
    vendorVisit: TicketVendorVisitService;
}

export async function applyStatusTransition(
    ticket: Ticket,
    oldStatus: TicketStatus,
    newStatus: TicketStatus,
    changes: string[],
    user: User,
    manager: EntityManager,
    deps: SlaTransitionDeps,
    vendorRequest: { visitAt?: string; note?: string } = {},
): Promise<void> {
    changes.push(`Status changed from ${oldStatus} to ${newStatus}`);
    const nonSla = await isNonSlaTicket(manager, ticket);
    if (nonSla) clearTicketSlaColumns(ticket);

    if (!nonSla && newStatus === TicketStatus.IN_PROGRESS && oldStatus === TicketStatus.TODO) {
        const config = await deps.slaClock.startResolution(ticket);
        if (config) changes.push(`SLA Timer started. Target: ${ticket.slaTarget!.toISOString()}`);
    }

    if (newStatus === TicketStatus.WAITING_VENDOR) {
        if (!nonSla) await pauseForVendor(ticket, deps.slaClock);
        const visitAt = deps.vendorVisit.resolveVisit(vendorRequest.visitAt);
        await deps.vendorVisit.schedule(manager, ticket, visitAt, user.id);
        ticket.vendorNote = normalizeVendorNote(vendorRequest.note);
        if (ticket.vendorNote) changes.push(`Keterangan vendor: ${ticket.vendorNote}`);
        changes.push(`Janji vendor: ${formatVendorVisit(visitAt)}`);
    } else if (oldStatus === TicketStatus.WAITING_VENDOR) {
        if (!nonSla) endVendorPause(ticket);
        await deps.vendorVisit.clear(manager, ticket);
        ticket.vendorNote = null;
    }

    if (newStatus === TicketStatus.RESOLVED) {
        await openConfirmationWindow(ticket, deps, nonSla, changes);
    } else if (oldStatus === TicketStatus.RESOLVED) {
        // Agent took the ticket back before the requester answered.
        ticket.resolutionDeadlineAt = null;
    }

    if (!nonSla && newStatus !== TicketStatus.WAITING_VENDOR && newStatus !== TicketStatus.RESOLVED
        && await deps.slaClock.release(ticket)) {
        changes.push(`SLA dilanjutkan. Target: ${ticket.slaTarget?.toISOString() ?? '-'}`);
    }
    if (!nonSla && await adoptStuckClock(ticket, oldStatus, newStatus, deps.slaClock)) {
        changes.push(`SLA dimulai dari waktu tiket dibuat. Target: ${ticket.slaTarget?.toISOString() ?? '-'}`);
    }
}

export async function applyBulkStatusSla(
    ticket: Ticket,
    oldStatus: TicketStatus,
    newStatus: TicketStatus,
    manager: EntityManager,
    actorId: string,
    deps: SlaTransitionDeps,
): Promise<void> {
    const nonSla = await isNonSlaTicket(manager, ticket);
    if (nonSla) clearTicketSlaColumns(ticket);

    if (!nonSla && newStatus === TicketStatus.IN_PROGRESS && oldStatus === TicketStatus.TODO && !ticket.slaStartedAt) {
        await deps.slaClock.startResolution(ticket);
    }
    if (newStatus === TicketStatus.WAITING_VENDOR) {
        if (!nonSla) await pauseForVendor(ticket, deps.slaClock);
        await deps.vendorVisit.schedule(manager, ticket, deps.vendorVisit.resolveVisit(), actorId);
    } else if (oldStatus === TicketStatus.WAITING_VENDOR) {
        if (!nonSla) endVendorPause(ticket);
        await deps.vendorVisit.clear(manager, ticket);
        ticket.vendorNote = null;
    }
    if (newStatus === TicketStatus.RESOLVED) {
        await openConfirmationWindow(ticket, deps, nonSla);
    } else if (!nonSla && newStatus !== TicketStatus.WAITING_VENDOR) {
        await deps.slaClock.release(ticket);
    }
    if (!nonSla) await adoptStuckClock(ticket, oldStatus, newStatus, deps.slaClock);
}

export async function applyPriorityChange(
    ticket: Ticket,
    newPriority: string | any,
    changes: string[],
    manager: EntityManager,
    slaClock: SlaClockService,
): Promise<void> {
    if (newPriority === 'HARDWARE_INSTALLATION') {
        throw new BadRequestException('Cannot manually set priority to HARDWARE_INSTALLATION. This priority is system-assigned for hardware installation tickets.');
    }
    if (ticket.priority === 'HARDWARE_INSTALLATION') {
        throw new BadRequestException('Cannot change priority of hardware installation tickets. Priority HARDWARE_INSTALLATION is locked by the system.');
    }

    changes.push(`Priority changed from ${ticket.priority} to ${newPriority}`);
    if (await isNonSlaTicket(manager, ticket)) {
        clearTicketSlaColumns(ticket);
        return;
    }

    const config = await slaClock.changePriority(ticket, newPriority as string);
    if (config) {
        const target = ticket.slaRemainingMinutes != null
            ? `${ticket.slaRemainingMinutes} menit tersisa (dijeda)`
            : ticket.slaTarget?.toISOString();
        changes.push(`SLA Target updated to ${target} (${config.resolutionTimeMinutes} minutes for ${newPriority})`);
    }
}

async function openConfirmationWindow(
    ticket: Ticket,
    deps: Pick<SlaTransitionDeps, 'slaClock' | 'businessHoursService'>,
    nonSla: boolean,
    changes?: string[],
): Promise<void> {
    const now = new Date();
    ticket.resolvedAt = now;
    ticket.disputedAt = null;
    ticket.resolutionDeadlineAt = await computeResolutionDeadline(deps.businessHoursService ?? undefined, now);
    if (!nonSla) {
        // Time spent awaiting confirmation does not count; a dispute resumes from here.
        await deps.slaClock.hold(ticket, now);
    }
    changes?.push(`Menunggu konfirmasi pemohon hingga ${ticket.resolutionDeadlineAt.toISOString()}`);
}

async function pauseForVendor(ticket: Ticket, slaClock: SlaClockService): Promise<void> {
    const now = new Date();
    ticket.lastPausedAt = now;
    ticket.waitingVendorAt = now;
    // TODO -> WAITING_VENDOR skips IN_PROGRESS: start the clock now so the hold keeps a full budget.
    if (!ticket.slaStartedAt) await slaClock.startResolution(ticket, now);
    await slaClock.hold(ticket, now);
}

async function adoptStuckClock(ticket: Ticket, oldStatus: TicketStatus, newStatus: TicketStatus, slaClock: SlaClockService): Promise<boolean> {
    if (oldStatus !== TicketStatus.WAITING_VENDOR || newStatus !== TicketStatus.IN_PROGRESS) return false;
    return slaClock.adoptUnstarted(ticket);
}

function endVendorPause(ticket: Ticket): void {
    if (!ticket.lastPausedAt) return;
    const diffMinutes = Math.floor((Date.now() - new Date(ticket.lastPausedAt).getTime()) / 60000);
    ticket.totalPausedMinutes = (ticket.totalPausedMinutes || 0) + diffMinutes;
    ticket.totalWaitingVendorMinutes = (ticket.totalWaitingVendorMinutes || 0) + diffMinutes;
    ticket.lastPausedAt = null;
    ticket.waitingVendorAt = null;
}
