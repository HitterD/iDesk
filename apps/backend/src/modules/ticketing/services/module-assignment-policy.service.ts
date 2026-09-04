import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketModule } from '../entities/ticket-module.entity';
import { HandlingTeam, Ticket, TicketType } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

/** Shape a ticket must satisfy to be resolved to a module. */
export interface AssignableTicket {
    handlingTeam?: HandlingTeam | null;
    ticketType?: TicketType | string | null;
    category?: string | null;
}

/**
 * Resolved assignment policy for one ticket.
 *
 * `userIds` non-empty  -> explicit per-person pool, it is the whole truth.
 * `userIds` empty      -> fall back to `roles` (legacy behaviour).
 */
export interface AssignmentPolicy {
    module: TicketModule | null;
    autoAssignEnabled: boolean;
    userIds: string[];
    roles: UserRole[];
}

const DEFAULT_OPS_ROLES: UserRole[] = [
    UserRole.ADMIN,
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ADMIN,
];

/**
 * The single place that answers "who may be assigned this ticket, and may it be
 * auto-assigned at all?".
 *
 * It exists because the guard used to be duplicated per call site: ticket
 * creation excluded only ORACLE_DEV, forward excluded correctly, and the SLA
 * monitor and the workload controller had no guard at all — so Oracle/Web/Mobile
 * tickets leaked into the IT-support workload pool through three of the four
 * doors. Every auto-assign path now asks this service instead of re-deriving it.
 */
@Injectable()
export class ModuleAssignmentPolicyService {
    private readonly logger = new Logger(ModuleAssignmentPolicyService.name);

    constructor(
        @InjectRepository(TicketModule)
        private readonly moduleRepo: Repository<TicketModule>,
    ) { }

    /**
     * Find the active module that owns this ticket. Matched by handlingTeam
     * first (the source of team ownership), then ticketType, then category.
     */
    async resolveModule(ticket: AssignableTicket): Promise<TicketModule | null> {
        const team = ticket.handlingTeam ?? HandlingTeam.OPS_SUPPORT;

        const byTeam = await this.moduleRepo
            .createQueryBuilder('m')
            .where('m.isActive = true')
            .andWhere(':team = ANY(m.handlingTeams)', { team })
            .orderBy('m.sortOrder', 'ASC')
            .getOne();
        if (byTeam) return byTeam;

        if (ticket.ticketType) {
            const byType = await this.moduleRepo
                .createQueryBuilder('m')
                .where('m.isActive = true')
                .andWhere(':ticketType = ANY(m.ticketTypes)', { ticketType: ticket.ticketType })
                .orderBy('m.sortOrder', 'ASC')
                .getOne();
            if (byType) return byType;
        }

        if (ticket.category) {
            const byCategory = await this.moduleRepo
                .createQueryBuilder('m')
                .where('m.isActive = true')
                .andWhere(':category = ANY(m.categories)', { category: ticket.category })
                .orderBy('m.sortOrder', 'ASC')
                .getOne();
            if (byCategory) return byCategory;
        }

        return null;
    }

    /**
     * Resolve the full policy. When no module matches, we fall back to the
     * pre-existing behaviour: auto-assign only for OPS_SUPPORT, ops roles only.
     */
    async resolvePolicy(ticket: AssignableTicket): Promise<AssignmentPolicy> {
        const module = await this.resolveModule(ticket);
        const team = ticket.handlingTeam ?? HandlingTeam.OPS_SUPPORT;

        if (!module) {
            return {
                module: null,
                autoAssignEnabled: team === HandlingTeam.OPS_SUPPORT,
                userIds: [],
                roles: DEFAULT_OPS_ROLES,
            };
        }

        return {
            module,
            autoAssignEnabled: module.autoAssignEnabled === true,
            userIds: module.assigneeUserIds ?? [],
            roles: module.assigneeRoles?.length ? module.assigneeRoles : DEFAULT_OPS_ROLES,
        };
    }

    /**
     * Whether this ticket may be auto-assigned by workload. Called by every
     * auto-assign path (create, forward, SLA breach, manual API).
     */
    async isAutoAssignAllowed(ticket: AssignableTicket): Promise<boolean> {
        const policy = await this.resolvePolicy(ticket);
        return policy.autoAssignEnabled;
    }

    /**
     * Enforcement for manual assignment: is this user allowed to receive this
     * ticket? Only meaningful when the module carries an explicit list — an
     * empty list keeps the existing role-based rules in charge.
     */
    async isUserEligible(ticket: AssignableTicket, userId: string): Promise<boolean> {
        const policy = await this.resolvePolicy(ticket);
        if (policy.userIds.length === 0) return true;
        return policy.userIds.includes(userId);
    }

    /**
     * Human-readable module name for error messages, without leaking ids.
     */
    async describeModule(ticket: AssignableTicket): Promise<string> {
        const module = await this.resolveModule(ticket);
        return module?.name ?? 'modul ini';
    }

    /** Modules that list this user in their explicit pool. */
    async findModulesContainingUser(userId: string): Promise<TicketModule[]> {
        return this.moduleRepo
            .createQueryBuilder('m')
            .where(':userId = ANY(m.assignee_user_ids)', { userId })
            .getMany();
    }

    /** Convenience for callers holding a full Ticket entity. */
    toAssignable(ticket: Pick<Ticket, 'handlingTeam' | 'ticketType' | 'category'>): AssignableTicket {
        return {
            handlingTeam: ticket.handlingTeam ?? null,
            ticketType: ticket.ticketType ?? null,
            category: ticket.category ?? null,
        };
    }
}
