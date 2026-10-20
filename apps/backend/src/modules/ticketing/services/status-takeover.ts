import { BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { Ticket, TicketStatus, TICKET_INACTIVE_STATUSES } from '../entities/ticket.entity';
import type { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { TICKET_AGENT_ROLES } from '../ticket-roles.constants';
import { TicketAssignedEvent } from '../events/ticket-assigned.event';
import type { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import type { WorkloadService } from '../../workload/workload.service';
import type { SiteActor } from '../../../shared/core/utils/site-scope.util';
import { canAccessTicketObject } from '../utils/oracle-ticket-access.util';

/**
 * Starting work on a ticket (→ IN_PROGRESS) is a claim of ownership. When
 * someone other than the PIC does it, they must explicitly take the ticket
 * over (with a reason) or — ADMIN/MANAGER only — keep the current PIC.
 */
export const REASSIGN_CONFIRMATION_REQUIRED = 'REASSIGN_CONFIRMATION_REQUIRED';

const REASSIGN_CONFIRMATION_MESSAGE = 'Tiket ini sedang ditangani agent lain. Konfirmasi pengambilalihan beserta alasannya.';
const TAKEOVER_REASON_REQUIRED_MESSAGE = 'Alasan pengambilalihan wajib diisi.';
const KEEP_ASSIGNEE_FORBIDDEN_MESSAGE = 'Hanya ADMIN atau MANAGER yang dapat memulai tiket tanpa mengambil alih PIC.';
const AUDIT_VIA = 'status-takeover';

/** Roles that may change status while leaving the ticket with its current PIC. */
const KEEP_ASSIGNEE_ROLES: string[] = [UserRole.ADMIN, UserRole.MANAGER];
/** Managers supervise; starting an unassigned ticket does not make them its PIC. */
const AUTO_ASSIGN_ROLES: string[] = TICKET_AGENT_ROLES.filter(role => role !== UserRole.MANAGER);

export interface TakeoverOptions { takeover?: boolean; keepAssignee?: boolean; reason?: string }

export type TakeoverDecision =
    | { kind: 'none' }                                  // not IN_PROGRESS, or actor is PIC
    | { kind: 'autoAssign' }                            // ticket unassigned → assign actor
    | { kind: 'takeover'; previousAssigneeId: string; reason: string }
    | { kind: 'keep' };                                 // ADMIN/MANAGER chose to keep PIC

type TakeoverTicket = Pick<Ticket, 'assignedToId'> & { assignedTo?: { id: string; fullName: string } | null };
export type AssigneeSummary = { id: string; fullName: string };

const NONE: TakeoverDecision = { kind: 'none' };

export function decideStatusTakeover(
    ticket: TakeoverTicket,
    newStatus: TicketStatus, oldStatus: TicketStatus,
    actor: { id: string; role: string }, opts: TakeoverOptions,
): TakeoverDecision {
    if (newStatus !== TicketStatus.IN_PROGRESS || oldStatus === TicketStatus.IN_PROGRESS) return NONE;
    if (!ticket.assignedToId) {
        return AUTO_ASSIGN_ROLES.includes(actor.role) ? { kind: 'autoAssign' } : NONE;
    }
    if (ticket.assignedToId === actor.id) return NONE;

    if (opts.keepAssignee) {
        if (!KEEP_ASSIGNEE_ROLES.includes(actor.role)) throw new ForbiddenException(KEEP_ASSIGNEE_FORBIDDEN_MESSAGE);
        return { kind: 'keep' };
    }
    if (opts.takeover) {
        const reason = opts.reason?.trim();
        if (!reason) throw new BadRequestException(TAKEOVER_REASON_REQUIRED_MESSAGE);
        return { kind: 'takeover', previousAssigneeId: ticket.assignedToId, reason };
    }
    throw new ConflictException({
        code: REASSIGN_CONFIRMATION_REQUIRED,
        message: REASSIGN_CONFIRMATION_MESSAGE,
        currentAssignee: currentAssigneeOf(ticket),
    });
}

/**
 * A module's curated agent list binds status-driven ownership the same way it
 * binds manual assignment (assignTicket). Implemented by the caller with the
 * ModuleAssignmentPolicyService.
 */
export interface ModuleEligibility {
    isEligible(ticket: Ticket): Promise<boolean>;
    /** The 403 message assignTicket uses for an ineligible assignee. */
    denialMessage(ticket: Ticket): Promise<string>;
}

export function ineligibleAssigneeMessage(assigneeName: string, moduleName: string): string {
    return `${assigneeName} tidak terdaftar sebagai agent yang dapat ditugaskan di ${moduleName}`;
}

/**
 * decideStatusTakeover plus module eligibility: an ineligible actor starting an
 * unassigned ticket just changes its status; taking over (confirmed or not —
 * asking to confirm something they may not do is pointless) is a 403.
 */
export async function resolveStatusTakeover(
    ticket: Ticket, newStatus: TicketStatus, oldStatus: TicketStatus,
    actor: { id: string; role: string }, opts: TakeoverOptions, eligibility: ModuleEligibility,
): Promise<TakeoverDecision> {
    let decision: TakeoverDecision;
    try {
        decision = decideStatusTakeover(ticket, newStatus, oldStatus, actor, opts);
    } catch (error) {
        if (isConfirmationConflict(error) && !(await eligibility.isEligible(ticket))) {
            throw new ForbiddenException(await eligibility.denialMessage(ticket));
        }
        throw error;
    }
    if (!makesActorPic(decision) || await eligibility.isEligible(ticket)) return decision;
    if (decision.kind === 'autoAssign') return NONE;
    throw new ForbiddenException(await eligibility.denialMessage(ticket));
}

export interface BulkTakeoverPlan {
    decisions: Map<string, TakeoverDecision>;
    /** Tickets the actor would become PIC of but may not handle (team or module list); the bulk loop fails them. */
    denied: Set<string>;
}

type BulkConflict = { id: string; ticketNumber: string; currentAssignee: AssigneeSummary };

/**
 * Bulk IN_PROGRESS runs the same PIC rule per ticket before the transaction;
 * unconfirmed conflicts are reported together as one 409. An explicit bulk
 * assignee already states who owns the tickets, so no takeover applies.
 * Becoming PIC needs the same team/role access and module eligibility as
 * manual assignment (single updates enforce it via validateTicketAccess and
 * resolveStatusTakeover).
 */
export async function decideBulkTakeovers(
    tickets: Ticket[], update: { status?: TicketStatus; assigneeId?: string } & TakeoverOptions,
    actor: { id: string; role: string }, eligibility: ModuleEligibility,
): Promise<BulkTakeoverPlan> {
    const plan: BulkTakeoverPlan = { decisions: new Map(), denied: new Set() };
    if (update.status !== TicketStatus.IN_PROGRESS || update.assigneeId) return plan;

    const conflicts: BulkConflict[] = [];
    for (const ticket of tickets) {
        if (TICKET_INACTIVE_STATUSES.includes(ticket.status)) continue; // the bulk loop rejects these anyway
        const decision = decideOrConflict(ticket, update.status, actor, update);
        const wouldBecomePic = decision === CONFLICT || makesActorPic(decision);
        const canHandle = !wouldBecomePic
            || (canAccessTicketObject(actor, ticket) && await eligibility.isEligible(ticket));

        if (canHandle && decision === CONFLICT) conflicts.push({ id: ticket.id, ticketNumber: ticket.ticketNumber, currentAssignee: currentAssigneeOf(ticket) });
        else if (canHandle) plan.decisions.set(ticket.id, decision as TakeoverDecision);
        // Module-ineligible auto-assign still starts the ticket, just without a PIC (as single updates do).
        else if (decision !== CONFLICT && decision.kind === 'autoAssign' && canAccessTicketObject(actor, ticket)) plan.decisions.set(ticket.id, NONE);
        else plan.denied.add(ticket.id);
    }
    if (conflicts.length > 0) {
        throw new ConflictException({ code: REASSIGN_CONFIRMATION_REQUIRED, message: REASSIGN_CONFIRMATION_MESSAGE, tickets: conflicts });
    }
    return plan;
}

const CONFLICT = 'conflict' as const;

/** The per-ticket decision, with an unconfirmed takeover reported as CONFLICT instead of thrown. */
function decideOrConflict(
    ticket: Ticket, status: TicketStatus, actor: { id: string; role: string }, opts: TakeoverOptions,
): TakeoverDecision | typeof CONFLICT {
    try {
        return decideStatusTakeover(ticket, status, ticket.status, actor, opts);
    } catch (error) {
        if (!isConfirmationConflict(error)) throw error;
        return CONFLICT;
    }
}

function makesActorPic(decision: TakeoverDecision): boolean {
    return decision.kind === 'takeover' || decision.kind === 'autoAssign';
}

function currentAssigneeOf(ticket: TakeoverTicket): AssigneeSummary {
    return { id: ticket.assignedToId!, fullName: ticket.assignedTo?.fullName ?? '' };
}

function isConfirmationConflict(error: unknown): boolean {
    return error instanceof ConflictException
        && (error.getResponse() as { code?: string })?.code === REASSIGN_CONFIRMATION_REQUIRED;
}

/**
 * Shared wording with manual assignment: "Ticket reassigned to B (was A) by C. Alasan: ...".
 * Pass `actorName: null` for a `changes` entry: the system message appends "by <actor>"
 * after all changes, so the reason goes in parentheses instead.
 */
export function describeReassignment(
    assigneeName: string, previousName: string | null, actorName: string | null, reason?: string | null,
): string {
    const actionLabel = previousName ? 'reassigned to' : 'assigned to';
    const wasOld = previousName ? ` (was ${previousName})` : '';
    if (actorName === null) {
        return `Ticket ${actionLabel} ${assigneeName}${wasOld}${reason ? ` (Alasan: ${reason})` : ''}`;
    }
    const reasonText = reason ? `. Alasan: ${reason}` : '';
    return `Ticket ${actionLabel} ${assigneeName}${wasOld} by ${actorName}${reasonText}`;
}

export interface AppliedTakeover { previous: AssigneeSummary | null; reason: string | null }

/** Inside the status transaction: make the actor PIC and log it in `changes`. */
export function applyTakeoverDecision(
    ticket: Ticket, actor: User, decision: TakeoverDecision, changes: string[],
): AppliedTakeover | null {
    if (decision.kind !== 'takeover' && decision.kind !== 'autoAssign') return null;
    const previous = decision.kind === 'takeover' ? currentAssigneeOf(ticket) : null;
    const reason = decision.kind === 'takeover' ? decision.reason : null;
    // Set both: TypeORM resolves a loaded relation over a differing FK column.
    ticket.assignedTo = actor;
    ticket.assignedToId = actor.id;
    changes.push(describeReassignment(actor.fullName, previous?.fullName ?? null, null, reason));
    return { previous, reason };
}

export interface TakeoverEffectDeps {
    auditService: AuditService;
    workloadService: WorkloadService;
    eventEmitter: EventEmitter2;
    logger: Logger;
}

/**
 * Post-commit side-effects of a status-driven (re)assignment: audit, the
 * previous PIC's workload (the new PIC's is recalculated by the caller's
 * usual post-update path), and the ticket.assigned domain event. The new PIC
 * is always the actor, so the event carries assignerId === assigneeId and the
 * notification listener skips the "assigned to you" notices (the requester is
 * still told their ticket is being handled).
 */
export async function recordStatusTakeover(
    deps: TakeoverEffectDeps, ticket: Ticket, actor: User, previous: AssigneeSummary | null, reason: string | null,
): Promise<void> {
    const previousName = previous?.fullName ?? 'Unassigned';
    deps.auditService.logAsync({
        userId: actor.id,
        action: AuditAction.ASSIGN_TICKET,
        entityType: 'ticket',
        entityId: ticket.id,
        oldValue: { assignee: previousName },
        newValue: { assignee: actor.fullName, reason, via: AUDIT_VIA },
        description: `Ticket #${ticket.ticketNumber || ticket.id.slice(0, 8)} ${describeReassignment(actor.fullName, previous?.fullName ?? null, actor.fullName, reason)}`,
    });

    if (previous && ticket.siteId) {
        try {
            const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: ticket.siteId };
            await deps.workloadService.recalculateAgentWorkload(internalActor, previous.id, ticket.siteId);
        } catch (err) {
            deps.logger.error(`Failed to recalculate workload for previous PIC of ticket ${ticket.ticketNumber}: ${err.message}`);
        }
    }

    deps.eventEmitter.emit('ticket.assigned', new TicketAssignedEvent(
        ticket.id, ticket.ticketNumber || ticket.id.split('-')[0],
        actor.id, actor.fullName, actor.email, actor.fullName,
        ticket.title, ticket.status, ticket.user?.email, ticket.user?.fullName,
        actor.id,
    ));
}
