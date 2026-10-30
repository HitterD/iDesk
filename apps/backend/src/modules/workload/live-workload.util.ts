import { In } from 'typeorm';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';
import { BusinessSchedule } from '../sla-config/business-hours.calc';
import { countsTowardsWorkload } from './install-day.util';

/** Statuses that carry workload points. Waiting vendor keeps its PIC but carries none. */
export const WORKLOAD_ACTIVE_STATUSES = [TicketStatus.TODO, TicketStatus.IN_PROGRESS];

/** Fallback points per priority when no weight is configured. */
export const DEFAULT_PRIORITY_WEIGHTS: Record<string, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 4,
    CRITICAL: 8,
    HARDWARE_INSTALLATION: 3,
};
const UNKNOWN_PRIORITY_WEIGHT = 2;

export interface LiveWorkload {
    /** Points from workable tickets (TODO / IN_PROGRESS). */
    points: number;
    /** Workable tickets, the ones that carry points. */
    workloadTickets: number;
    /** Tickets still owned by the PIC while they wait on a vendor. */
    waitingVendor: number;
}

export type LiveWorkloadTicket = Pick<Ticket, 'priority' | 'status' | 'assignedToId' | 'isHardwareInstallation' | 'scheduledDate'>;

/** Tickets a PIC still owns: workable ones plus those waiting on a vendor. */
export function activeTicketWhere(agentIds: string[], siteId?: string): Record<string, unknown> {
    const where: Record<string, unknown> = {
        assignedToId: In(agentIds),
        status: In([...WORKLOAD_ACTIVE_STATUSES, TicketStatus.WAITING_VENDOR]),
    };
    if (siteId) where.siteId = siteId;
    return where;
}

/**
 * Live workload per agent, computed from the tickets themselves rather than a
 * stored daily row, so a ticket moving to or from WAITING_VENDOR is reflected
 * at once. Installation tickets weigh nothing until their install day opens.
 */
export function computeLiveWorkloads(
    agentIds: string[],
    tickets: readonly LiveWorkloadTicket[],
    weightByPriority: ReadonlyMap<string, number>,
    schedule: BusinessSchedule,
    now: Date = new Date(),
): Map<string, LiveWorkload> {
    const result = new Map(agentIds.map(id => [id, { points: 0, workloadTickets: 0, waitingVendor: 0 }]));
    for (const ticket of tickets) {
        const load = result.get(ticket.assignedToId as string);
        if (!load) continue;
        if (ticket.status === TicketStatus.WAITING_VENDOR) {
            load.waitingVendor += 1;
            continue;
        }
        if (!WORKLOAD_ACTIVE_STATUSES.includes(ticket.status)) continue;
        load.workloadTickets += 1;
        if (countsTowardsWorkload(ticket, schedule, now)) {
            load.points += weightByPriority.get(ticket.priority) ?? DEFAULT_PRIORITY_WEIGHTS[ticket.priority] ?? UNKNOWN_PRIORITY_WEIGHT;
        }
    }
    return result;
}
