import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PriorityWeight } from './entities/priority-weight.entity';
import { AgentDailyWorkload } from './entities/agent-daily-workload.entity';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UpdatePriorityWeightDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { SiteActor, resolveSiteScope } from '../../shared/core/utils/site-scope.util';
import {
    AssignmentPolicy,
    ModuleAssignmentPolicyService,
} from '../ticketing/services/module-assignment-policy.service';

@Injectable()
export class WorkloadService {
    // Default priority weights if not configured in DB
    private readonly DEFAULT_WEIGHTS: Record<string, number> = {
        LOW: 1,
        MEDIUM: 2,
        HIGH: 4,
        CRITICAL: 8,
        HARDWARE_INSTALLATION: 3,
    };

    constructor(
        private readonly auditService: AuditService,
        @InjectRepository(PriorityWeight)
        private readonly priorityWeightRepo: Repository<PriorityWeight>,
        @InjectRepository(AgentDailyWorkload)
        private readonly workloadRepo: Repository<AgentDailyWorkload>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly eventEmitter: EventEmitter2,
        private readonly assignmentPolicy: ModuleAssignmentPolicyService,
    ) { }

    // ==========================================
    // Priority Weight Management
    // ==========================================

    async getPriorityWeights(): Promise<PriorityWeight[]> {
        return this.priorityWeightRepo.find({ order: { points: 'ASC' } });
    }

    async getPriorityWeight(priority: string): Promise<number> {
        const weight = await this.priorityWeightRepo.findOne({ where: { priority } });
        return weight?.points ?? this.DEFAULT_WEIGHTS[priority] ?? 2;
    }

    async updatePriorityWeight(priority: string, dto: UpdatePriorityWeightDto): Promise<PriorityWeight> {
        let weight = await this.priorityWeightRepo.findOne({ where: { priority } });

        if (!weight) {
            weight = this.priorityWeightRepo.create({ priority });
        }

        weight.points = dto.points;
        weight.description = dto.description || weight.description;

        return this.priorityWeightRepo.save(weight);
    }

    // ==========================================
    // Agent Workload Tracking
    // ==========================================

    async getAgentWorkload(actor: SiteActor, agentId: string, siteId?: string, date?: Date): Promise<AgentDailyWorkload> {
        const scope = resolveSiteScope(actor);

        if (scope.mode === 'none') {
            throw new ForbiddenException('Access to this resource is forbidden');
        }

        // For site-locked actors, explicitly provided siteId must match actor's site (defense-in-depth)
        if (scope.mode === 'site' && siteId && siteId !== scope.siteId) {
            throw new ForbiddenException('Access to this resource is forbidden');
        }

        // Non-cross-site always uses actor's site; cross-site may use provided siteId (or undefined for detail path)
        const targetSiteId = scope.mode === 'site' ? scope.siteId : siteId;

        if (!targetSiteId) {
            throw new ForbiddenException('Access to this resource is forbidden');
        }

        const workDate = date || new Date();
        workDate.setHours(0, 0, 0, 0);

        let workload = await this.workloadRepo.findOne({
            where: { agentId, siteId: targetSiteId, workDate },
            relations: ['agent', 'site'],
        });

        if (!workload) {
            // Create new workload record for today — race-safe: two concurrent
            // readers may both miss the row; ON CONFLICT DO NOTHING keeps the
            // unique (agentId, siteId, workDate) from exploding, then re-read.
            await this.ensureWorkloadRow(agentId, targetSiteId, workDate);
            workload = await this.workloadRepo.findOne({
                where: { agentId, siteId: targetSiteId, workDate },
                relations: ['agent', 'site'],
            });
        }

        if (!workload) {
            // Only reachable if the row vanished between insert and re-read
            throw new NotFoundException(`Workload for agent ${agentId} not found`);
        }

        return workload;
    }

    /**
     * Atomically add a ticket's points to an agent's daily workload.
     *
     * Replaces the previous unlocked findOne → mutate → save sequence, which
     * lost concurrent increments: two auto-assignments to the same agent both
     * read the same row and the second save silently discarded the first
     * `totalPoints +=` (PROD-20). The row is created with ON CONFLICT DO
     * NOTHING and updated via SQL `col = col + n`, so neither a duplicate-key
     * error nor a lost update is possible under concurrency.
     *
     * @returns the freshly-read workload (used for the auto-assign event payload)
     */
    async incrementAgentWorkload(
        actor: SiteActor,
        agentId: string,
        siteId?: string,
        points?: number,
        date?: Date,
    ): Promise<AgentDailyWorkload> {
        const scope = resolveSiteScope(actor);

        if (scope.mode === 'none') {
            throw new ForbiddenException('Access to this resource is forbidden');
        }

        // For site-locked actors, explicitly provided siteId must match actor's site (defense-in-depth)
        if (scope.mode === 'site' && siteId && siteId !== scope.siteId) {
            throw new ForbiddenException('Access to this resource is forbidden');
        }

        // Non-cross-site always uses actor's site; cross-site may use provided siteId
        const targetSiteId = scope.mode === 'site' ? scope.siteId : siteId;

        if (!targetSiteId) {
            throw new ForbiddenException('Access to this resource is forbidden');
        }

        const workDate = date || new Date();
        workDate.setHours(0, 0, 0, 0);

        // 1. Ensure the row exists (no-op when it already does).
        await this.ensureWorkloadRow(agentId, targetSiteId, workDate);

        // 2. Atomic increments — never read-modify-write.
        await this.workloadRepo.increment(
            { agentId, siteId: targetSiteId, workDate },
            'totalPoints',
            points ?? 0,
        );
        await this.workloadRepo.increment(
            { agentId, siteId: targetSiteId, workDate },
            'activeTickets',
            1,
        );
        await this.workloadRepo.update(
            { agentId, siteId: targetSiteId, workDate },
            { lastAssignedAt: new Date() },
        );

        const workload = await this.workloadRepo.findOne({
            where: { agentId, siteId: targetSiteId, workDate },
            relations: ['agent', 'site'],
        });
        if (!workload) {
            throw new NotFoundException(`Workload for agent ${agentId} not found`);
        }
        return workload;
    }

    /**
     * INSERT ... ON CONFLICT DO NOTHING for the unique (agentId, siteId, workDate).
     * Concurrent create-then-save would deadlock/duplicate; this is the safe
     * primitive used by both the read path and incrementAgentWorkload.
     */
    private async ensureWorkloadRow(agentId: string, siteId: string, workDate: Date): Promise<void> {
        await this.workloadRepo
            .createQueryBuilder()
            .insert()
            .into(AgentDailyWorkload)
            .values([{
                agentId,
                siteId,
                workDate,
                totalPoints: 0,
                activeTickets: 0,
                resolvedTickets: 0,
            }])
            .orIgnore()
            .execute();
    }

    async getAllAgentWorkloads(actor: SiteActor, siteId?: string, date?: Date): Promise<any[]> {
        const scope = resolveSiteScope(actor);

        // For non-cross-site actors, force to their own site (ignore any provided siteId)
        let targetSiteId: string | undefined;
        if (scope.mode === 'site') {
            targetSiteId = scope.siteId;
        } else if (scope.mode === 'all') {
            targetSiteId = siteId; // cross-site may narrow or omit (omit = all sites)
        } else {
            // none scope → fail closed, return empty
            return [];
        }

        const workDate = date || new Date();
        workDate.setHours(0, 0, 0, 0);

        // Build user query filter
        const userWhere: any = {
            role: In([UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT]),
            isActive: true,
        };
        if (targetSiteId) {
            userWhere.siteId = targetSiteId;
        }

        const agents = await this.userRepo.find({
            where: userWhere,
            relations: ['site'],
        });

        if (agents.length === 0) {
            return [];
        }

        const agentIds = agents.map(a => a.id);

        // Workload query filter
        const workloadWhere: any = { agentId: In(agentIds), workDate };
        if (targetSiteId) {
            workloadWhere.siteId = targetSiteId;
        }

        const existingWorkloads = await this.workloadRepo.find({ where: workloadWhere });
        const workloadByAgent = new Map(existingWorkloads.map(w => [w.agentId, w]));

        const missingAgentIds = agentIds.filter(id => !workloadByAgent.has(id));
        if (missingAgentIds.length > 0) {
            const created = await this.workloadRepo.save(
                missingAgentIds.map(agentId => {
                    const agent = agents.find(a => a.id === agentId);
                    return this.workloadRepo.create({
                        agentId,
                        siteId: targetSiteId ?? agent?.siteId, // cross-site all: use agent's own site
                        workDate,
                        totalPoints: 0,
                        activeTickets: 0,
                        resolvedTickets: 0,
                    });
                }),
            );
            created.forEach(w => workloadByAgent.set(w.agentId, w));
        }

        // Active tickets filter — when cross-site with no target, we still scope per agent's site in the result
        // but to keep query simple and correct, if no targetSiteId we fetch across those agents' sites.
        const ticketWhere: any = {
            assignedToId: In(agentIds),
            status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_VENDOR]),
        };
        if (targetSiteId) {
            ticketWhere.siteId = targetSiteId;
        }

        const activeTickets = await this.ticketRepo.find({
            where: ticketWhere,
            select: ['id', 'ticketNumber', 'title', 'priority', 'status', 'category', 'assignedToId', 'siteId'],
        });
        const activeTicketsByAgent = new Map<string, typeof activeTickets>();
        for (const ticket of activeTickets) {
            const agentId = ticket.assignedToId as string;
            const list = activeTicketsByAgent.get(agentId) ?? [];
            list.push(ticket);
            activeTicketsByAgent.set(agentId, list);
        }

        return agents.map(agent => {
            const workload = workloadByAgent.get(agent.id)!;
            return {
                agentId: agent.id,
                agentName: agent.fullName,
                email: agent.email,
                role: agent.role,
                totalPoints: workload.totalPoints,
                appraisalPoints: agent.appraisalPoints,
                lastAssignedAt: workload.lastAssignedAt,
                siteId: agent.siteId,
                siteCode: agent.site?.code || '',
                siteName: agent.site?.name || '',
                activeTicketsCount: workload.activeTickets,
                activeTickets: activeTicketsByAgent.get(agent.id) ?? [],
            };
        });
    }

    async recalculateAgentWorkload(actor: SiteActor, agentId: string, siteId?: string, userId?: string): Promise<AgentDailyWorkload> {
        const scope = resolveSiteScope(actor);

        if (scope.mode === 'none') {
            throw new ForbiddenException('Access to this resource is forbidden');
        }

        // Defense-in-depth: for site-locked actors, if a siteId is explicitly provided it must match actor's site
        if (scope.mode === 'site' && siteId && siteId !== scope.siteId) {
            throw new ForbiddenException('Access to this resource is forbidden');
        }

        // Force site to actor's site for non-cross-site; for cross-site, accept provided or fail if missing
        const targetSiteId = scope.mode === 'site' ? scope.siteId : (scope.mode === 'all' ? siteId : undefined);

        if (!targetSiteId) {
            throw new ForbiddenException('Access to this resource is forbidden');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all active tickets assigned to this agent for this site
        const activeTickets = await this.ticketRepo.find({
            where: {
                assignedToId: agentId,
                siteId: targetSiteId,
                status: MoreThanOrEqual(TicketStatus.TODO) as any,
            },
        });

        // Filter out resolved/cancelled
        const openTickets = activeTickets.filter(t =>
            t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CANCELLED
        );

        // Calculate total points — prefetch all weights once instead of one query per ticket.
        const weights = await this.priorityWeightRepo.find();
        const weightByPriority = new Map(weights.map(w => [w.priority, w.points]));
        let totalPoints = 0;
        for (const ticket of openTickets) {
            totalPoints += weightByPriority.get(ticket.priority) ?? this.DEFAULT_WEIGHTS[ticket.priority] ?? 2;
        }

        // Count resolved today
        const resolvedToday = await this.ticketRepo.count({
            where: {
                assignedToId: agentId,
                siteId: targetSiteId,
                status: TicketStatus.RESOLVED,
                resolvedAt: MoreThanOrEqual(today),
            },
        });

        // Update or create workload record
        let workload = await this.workloadRepo.findOne({
            where: { agentId, siteId: targetSiteId, workDate: today },
        });

        if (!workload) {
            workload = this.workloadRepo.create({
                agentId,
                siteId: targetSiteId,
                workDate: today,
            });
        }

        workload.totalPoints = totalPoints;
        workload.activeTickets = openTickets.length;
        workload.resolvedTickets = resolvedToday;

        const saved = await this.workloadRepo.save(workload);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.WORKLOAD_RECALCULATE,
                entityType: 'AgentDailyWorkload',
                entityId: saved.id,
                description: `Recalculated workload for agent ${agentId} at site ${targetSiteId}`,
                newValue: { totalPoints, activeTickets: openTickets.length },
            });
        }

        return saved;
    }

    // ==========================================
    // Auto-Assignment Algorithm
    // ==========================================

    /**
     * Resolve the candidate pool for auto-assignment. Kept separate so the
     * explicit-list rule is stated once and is readable on its own.
     */
    private async findCandidateAgents(siteId: string, policy?: AssignmentPolicy): Promise<User[]> {
        if (policy && policy.userIds.length > 0) {
            return this.userRepo.find({
                where: { id: In(policy.userIds), isActive: true },
            });
        }

        const roles = policy?.roles?.length
            ? policy.roles
            : [UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT];

        return this.userRepo.find({
            where: { role: In(roles), siteId, isActive: true },
        });
    }

    /**
     * Find the best agent to assign a ticket to based on workload.
     * Algorithm: lowest current workload points, tie-broken by oldest assignment.
     *
     * The candidate pool comes from `policy` when given:
     *   - explicit `userIds` -> exactly those users, across sites (an admin who
     *     curated the list decided the membership; site is not a second filter);
     *   - otherwise `roles` filtered to `siteId`, which is the legacy behaviour.
     * Without a policy the caller gets the historical ops-support pool.
     */
    async findBestAgentForAssignment(
        siteId: string,
        excludeAgentIds: string[] = [],
        policy?: AssignmentPolicy,
    ): Promise<User | null> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const agents = await this.findCandidateAgents(siteId, policy);

        if (agents.length === 0) {
            return null;
        }

        // Filter out excluded agents
        const availableAgents = agents.filter(a => !excludeAgentIds.includes(a.id));

        if (availableAgents.length === 0) {
            return null;
        }

        // One query for existing workload rows, then create only what's missing,
        // instead of a findOne-or-create round trip per agent.
        const availableAgentIds = availableAgents.map(a => a.id);
        const existingWorkloads = await this.workloadRepo.find({
            where: { agentId: In(availableAgentIds), siteId, workDate: today },
        });
        const workloadByAgent = new Map(existingWorkloads.map(w => [w.agentId, w]));

        const missingAgentIds = availableAgentIds.filter(id => !workloadByAgent.has(id));
        if (missingAgentIds.length > 0) {
            const created = await this.workloadRepo.save(
                missingAgentIds.map(agentId => this.workloadRepo.create({
                    agentId,
                    siteId,
                    workDate: today,
                    totalPoints: 0,
                    activeTickets: 0,
                    resolvedTickets: 0,
                })),
            );
            created.forEach(w => workloadByAgent.set(w.agentId, w));
        }

        const agentWorkloads: { agent: User; points: number; lastAssignedAt: Date | null }[] = availableAgents.map(agent => {
            const workload = workloadByAgent.get(agent.id)!;
            return {
                agent,
                points: workload.totalPoints,
                lastAssignedAt: workload.lastAssignedAt || null,
            };
        });

        // Sort by points (ascending). Tie-breaker: lastAssignedAt (older/null first)
        agentWorkloads.sort((a, b) => {
            if (a.points !== b.points) {
                return a.points - b.points;
            }

            // Tie-breaker: lastAssignedAt
            // If one has never been assigned (null), prioritize them (they go first)
            if (a.lastAssignedAt === null && b.lastAssignedAt !== null) return -1;
            if (a.lastAssignedAt !== null && b.lastAssignedAt === null) return 1;
            if (a.lastAssignedAt === null && b.lastAssignedAt === null) return 0;

            // Both have dates, sort older date first
            return a.lastAssignedAt!.getTime() - b.lastAssignedAt!.getTime();
        });

        return agentWorkloads[0]?.agent || null;
    }

    /**
     * Auto-assign a ticket to the best available agent
     * actor is optional for backward compat with internal callers; when omitted we synthesize an admin actor from ticket.siteId
     */
    async autoAssignTicket(ticketId: string, userId?: string, actor?: SiteActor): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['assignedTo'],
        });

        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        if (!ticket.siteId) {
            throw new BadRequestException('Ticket has no site assigned');
        }

        // Single guard for every auto-assign path (create, forward, SLA breach,
        // manual API). Modules with auto-assign off — Oracle, Web Dev, Mobile
        // Dev — must never be routed into the ops-support workload pool.
        const policy = await this.assignmentPolicy.resolvePolicy(
            this.assignmentPolicy.toAssignable(ticket),
        );

        if (!policy.autoAssignEnabled) {
            throw new BadRequestException(
                `Auto-assign is disabled for ${policy.module?.name ?? 'this ticket module'}`,
            );
        }

        const bestAgent = await this.findBestAgentForAssignment(ticket.siteId, [], policy);

        if (!bestAgent) {
            // The admin curated a list and nobody on it is available. Leaving
            // the ticket unassigned is visible and actionable; silently falling
            // back to the role pool would assign the very people who were
            // deliberately excluded.
            throw new BadRequestException('No available agents for this ticket module');
        }

        // Assign ticket
        ticket.assignedToId = bestAgent.id;
        ticket.assignedTo = bestAgent;

        const savedTicket = await this.ticketRepo.save(ticket);

        // Update agent's workload using a trusted internal actor derived from the ticket's site.
        // Atomic increment — a concurrent auto-assignment to the same agent must not
        // lose this increment (PROD-20).
        const priorityPoints = await this.getPriorityWeight(ticket.priority);
        const internalActor: SiteActor = actor ?? { role: UserRole.ADMIN, siteId: ticket.siteId ?? null };
        const workload = await this.incrementAgentWorkload(
            internalActor,
            bestAgent.id,
            ticket.siteId,
            priorityPoints,
        );

        // Emit event
        this.eventEmitter.emit('ticket.auto-assigned', {
            ticket: savedTicket,
            agent: bestAgent,
            workloadPoints: workload.totalPoints,
        });

        return savedTicket;
    }

    /**
     * Update workload when ticket status changes
     */
    async onTicketStatusChange(
        ticketId: string,
        oldStatus: TicketStatus,
        newStatus: TicketStatus
    ): Promise<void> {
        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
        });

        if (!ticket || !ticket.assignedToId || !ticket.siteId) {
            return;
        }

        const priorityPoints = await this.getPriorityWeight(ticket.priority);
        // Internal trusted path: use ticket's site as source of truth
        const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: ticket.siteId };
        const workload = await this.getAgentWorkload(internalActor, ticket.assignedToId, ticket.siteId);

        // If resolved or cancelled, reduce workload
        if (
            (newStatus === TicketStatus.RESOLVED || newStatus === TicketStatus.CANCELLED) &&
            oldStatus !== TicketStatus.RESOLVED && oldStatus !== TicketStatus.CANCELLED
        ) {
            workload.totalPoints = Math.max(0, workload.totalPoints - priorityPoints);
            workload.activeTickets = Math.max(0, workload.activeTickets - 1);

            if (newStatus === TicketStatus.RESOLVED) {
                workload.resolvedTickets += 1;
            }

            await this.workloadRepo.save(workload);
        }
    }

    // ==========================================
    // Reporting
    // ==========================================

    async getWorkloadSummary(siteId?: string): Promise<{
        agents: { name: string; siteCode: string; activeTickets: number; totalPoints: number; resolvedToday: number }[];
        totalActiveTickets: number;
        averagePoints: number;
    }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const qb = this.workloadRepo.createQueryBuilder('w')
            .leftJoinAndSelect('w.agent', 'agent')
            .leftJoinAndSelect('w.site', 'site')
            .where('w.workDate = :today', { today });

        if (siteId) {
            qb.andWhere('w.siteId = :siteId', { siteId });
        }

        const workloads = await qb.getMany();

        const agents = workloads.map(w => ({
            name: w.agent?.fullName || 'Unknown',
            siteCode: w.site?.code || 'N/A',
            activeTickets: w.activeTickets,
            totalPoints: w.totalPoints,
            resolvedToday: w.resolvedTickets,
        }));

        const totalActiveTickets = agents.reduce((sum, a) => sum + a.activeTickets, 0);
        const averagePoints = agents.length > 0
            ? Math.round(agents.reduce((sum, a) => sum + a.totalPoints, 0) / agents.length)
            : 0;

        return {
            agents,
            totalActiveTickets,
            averagePoints,
        };
    }

    // ==========================================
    // Scheduled Jobs
    // ==========================================

    private readonly logger = new Logger(WorkloadService.name);

    /**
     * Daily workload reset - runs at midnight every day
     * Archives previous day's data and recalculates current workloads
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async dailyWorkloadReset(): Promise<void> {
        this.logger.log('🔄 Starting daily workload reset...');

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get all active agents
            const agents = await this.userRepo.find({
                where: {
                    role: In([UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT]), // Updated to include both roles
                    isActive: true,
                },
            });

            this.logger.log(`Found ${agents.length} active agents`);

            // Create fresh workload records for today
            for (const agent of agents) {
                // First recalculate based on actual open tickets (trusted internal actor)
                const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: agent.siteId ?? null };
                await this.recalculateAgentWorkload(internalActor, agent.id, agent.siteId ?? undefined);
            }

            // Cleanup old workload records (older than 90 days)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            const deleted = await this.workloadRepo.delete({
                workDate: LessThan(cutoffDate),
            });

            this.logger.log(`🧹 Cleaned up ${deleted.affected || 0} old workload records`);
            this.logger.log('✅ Daily workload reset completed');
        } catch (error) {
            this.logger.error('❌ Daily workload reset failed:', error);
        }
    }
}
