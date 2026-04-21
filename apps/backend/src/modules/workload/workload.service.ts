import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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

    async getAgentWorkload(agentId: string, siteId: string, date?: Date): Promise<AgentDailyWorkload> {
        const workDate = date || new Date();
        workDate.setHours(0, 0, 0, 0);

        let workload = await this.workloadRepo.findOne({
            where: { agentId, siteId, workDate },
            relations: ['agent', 'site'],
        });

        if (!workload) {
            // Create new workload record for today
            workload = this.workloadRepo.create({
                agentId,
                siteId,
                workDate,
                totalPoints: 0,
                activeTickets: 0,
                resolvedTickets: 0,
            });
            workload = await this.workloadRepo.save(workload);
        }

        return workload;
    }

    async getAllAgentWorkloads(siteId: string, date?: Date): Promise<any[]> {
        const workDate = date || new Date();
        workDate.setHours(0, 0, 0, 0);

        const agents = await this.userRepo.find({
            where: {
                role: In([UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT]),
                siteId,
                isActive: true
            },
            relations: ['site'],
        });

        const workloads: any[] = [];
        for (const agent of agents) {
            const workload = await this.getAgentWorkload(agent.id, siteId, workDate);

            // Get active tickets for the agent
            const activeTickets = await this.ticketRepo.find({
                where: {
                    assignedToId: agent.id,
                    siteId,
                    status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_VENDOR]),
                },
                select: ['id', 'ticketNumber', 'title', 'priority', 'status', 'category'],
            });

            workloads.push({
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
                activeTickets: activeTickets,
            });
        }

        return workloads;
    }

    async recalculateAgentWorkload(agentId: string, siteId: string, userId?: string): Promise<AgentDailyWorkload> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all active tickets assigned to this agent for this site
        const activeTickets = await this.ticketRepo.find({
            where: {
                assignedToId: agentId,
                siteId,
                status: MoreThanOrEqual(TicketStatus.TODO) as any,
            },
        });

        // Filter out resolved/cancelled
        const openTickets = activeTickets.filter(t =>
            t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CANCELLED
        );

        // Calculate total points
        let totalPoints = 0;
        for (const ticket of openTickets) {
            const weight = await this.getPriorityWeight(ticket.priority);
            totalPoints += weight;
        }

        // Count resolved today
        const resolvedToday = await this.ticketRepo.count({
            where: {
                assignedToId: agentId,
                siteId,
                status: TicketStatus.RESOLVED,
                resolvedAt: MoreThanOrEqual(today),
            },
        });

        // Update or create workload record
        let workload = await this.workloadRepo.findOne({
            where: { agentId, siteId, workDate: today },
        });

        if (!workload) {
            workload = this.workloadRepo.create({
                agentId,
                siteId,
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
                description: `Recalculated workload for agent ${agentId} at site ${siteId}`,
                newValue: { totalPoints, activeTickets: openTickets.length },
            });
        }

        return saved;
    }

    // ==========================================
    // Auto-Assignment Algorithm
    // ==========================================

    /**
     * Find the best agent to assign a ticket to based on workload
     * Algorithm: Select agent with lowest current workload points for the given site
     */
    async findBestAgentForAssignment(siteId: string, excludeAgentIds: string[] = []): Promise<User | null> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all active agents for this site (only operational support)
        const agents = await this.userRepo.find({
            where: {
                role: In([UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT]),
                siteId,
                isActive: true,
            },
        });

        if (agents.length === 0) {
            return null;
        }

        // Filter out excluded agents
        const availableAgents = agents.filter(a => !excludeAgentIds.includes(a.id));

        if (availableAgents.length === 0) {
            return null;
        }

        // Get or create workload for each agent (already fetched)
        const agentWorkloads: { agent: User; points: number; lastAssignedAt: Date | null }[] = [];

        for (const agent of availableAgents) {
            const workload = await this.getAgentWorkload(agent.id, siteId, today);
            agentWorkloads.push({
                agent,
                points: workload.totalPoints,
                lastAssignedAt: workload.lastAssignedAt || null,
            });
        }

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
     */
    async autoAssignTicket(ticketId: string, userId?: string): Promise<Ticket> {
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

        // Find best agent
        const bestAgent = await this.findBestAgentForAssignment(ticket.siteId);

        if (!bestAgent) {
            throw new BadRequestException('No available agents for this site');
        }

        // Assign ticket
        ticket.assignedToId = bestAgent.id;
        ticket.assignedTo = bestAgent;

        const savedTicket = await this.ticketRepo.save(ticket);

        // Update agent's workload
        const priorityPoints = await this.getPriorityWeight(ticket.priority);
        const workload = await this.getAgentWorkload(bestAgent.id, ticket.siteId);
        workload.totalPoints += priorityPoints;
        workload.activeTickets += 1;
        workload.lastAssignedAt = new Date();
        await this.workloadRepo.save(workload);

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
        const workload = await this.getAgentWorkload(ticket.assignedToId, ticket.siteId);

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
                // First recalculate based on actual open tickets
                await this.recalculateAgentWorkload(agent.id, agent.siteId);
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
