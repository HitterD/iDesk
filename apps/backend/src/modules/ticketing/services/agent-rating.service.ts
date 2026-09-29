import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketAssignment } from '../entities/ticket-assignment.entity';
import { AgentRating } from '../entities/agent-rating.entity';
import { AGENT_RATING_MAX, AGENT_RATING_MIN, AgentRatingItemDto } from '../dto/ticket-resolution.dto';

/** Requesters may rate agents for this long after the ticket is closed. */
export const RATING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_RATINGS_LIMIT = 20;

export const AGENT_RATING_MESSAGES = {
    NOT_OWNER: 'Hanya pemohon tiket yang dapat memberi rating.',
    NOT_OPEN: 'Rating hanya bisa diberikan dalam 7 hari setelah tiket ditutup.',
    UNKNOWN_AGENT: 'Agent tersebut tidak menangani tiket ini.',
    ALREADY_RATED: 'Agent tersebut sudah Anda beri rating untuk tiket ini.',
} as const;

export interface TicketAgentRatingsView {
    canRate: boolean;
    ratingDeadline: string | null;
    agents: Array<{ agentId: string; fullName: string; rating: number | null; comment: string | null }>;
}

export interface MyAgentRatingSummary {
    average: number | null;
    count: number;
    distribution: Record<string, number>;
    recent: Array<{ rating: number; comment: string | null; createdAt: Date }>;
}

/**
 * Per-agent ratings from the requester of a closed ticket. Agents only see their own
 * aggregate and anonymous comments; admins and managers see who rated whom.
 */
@Injectable()
export class AgentRatingService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketAssignment)
        private readonly assignmentRepo: Repository<TicketAssignment>,
        @InjectRepository(AgentRating)
        private readonly ratingRepo: Repository<AgentRating>,
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }

    async getTicketRatings(ticketId: string, userId: string): Promise<TicketAgentRatingsView> {
        const ticket = await this.loadOwnedTicket(ticketId, userId);
        const [assignments, ratings] = await Promise.all([
            this.assignmentRepo.find({ where: { ticketId }, relations: ['agent'], order: { firstAssignedAt: 'ASC' } }),
            this.ratingRepo.find({ where: { ticketId } }),
        ]);
        const byAgent = new Map(ratings.map((r) => [r.agentId, r]));
        const deadline = this.ratingDeadline(ticket);
        const agents = assignments.map((a) => ({
            agentId: a.agentId,
            fullName: a.agent?.fullName ?? '-',
            rating: byAgent.get(a.agentId)?.rating ?? null,
            comment: byAgent.get(a.agentId)?.comment ?? null,
        }));
        const hasUnrated = agents.some((a) => a.rating === null);
        return {
            canRate: hasUnrated && deadline !== null && Date.now() <= deadline.getTime(),
            ratingDeadline: deadline?.toISOString() ?? null,
            agents,
        };
    }

    async submitRatings(ticketId: string, userId: string, items: AgentRatingItemDto[]): Promise<TicketAgentRatingsView> {
        const ticket = await this.loadOwnedTicket(ticketId, userId);
        const deadline = this.ratingDeadline(ticket);
        if (!deadline || Date.now() > deadline.getTime()) {
            throw new BadRequestException(AGENT_RATING_MESSAGES.NOT_OPEN);
        }

        const agentIds = items.map((i) => i.agentId);
        if (new Set(agentIds).size !== agentIds.length) {
            throw new BadRequestException(AGENT_RATING_MESSAGES.ALREADY_RATED);
        }
        const handled = await this.assignmentRepo.count({ where: { ticketId, agentId: In(agentIds) } });
        if (handled !== agentIds.length) {
            throw new BadRequestException(AGENT_RATING_MESSAGES.UNKNOWN_AGENT);
        }
        const existing = await this.ratingRepo.count({ where: { ticketId, agentId: In(agentIds) } });
        if (existing > 0) {
            throw new BadRequestException(AGENT_RATING_MESSAGES.ALREADY_RATED);
        }

        const rows = items.map((i) => this.ratingRepo.create({
            ticketId,
            agentId: i.agentId,
            raterId: userId,
            rating: i.rating,
            comment: i.comment?.trim() || null,
        }));
        await this.ratingRepo.save(rows);
        return this.getTicketRatings(ticketId, userId);
    }

    async getMySummary(agentId: string): Promise<MyAgentRatingSummary> {
        const [grouped, recent] = await Promise.all([
            this.ratingRepo.createQueryBuilder('r')
                .select('r.rating', 'rating')
                .addSelect('COUNT(*)', 'count')
                .where('r.agentId = :agentId', { agentId })
                .groupBy('r.rating')
                .getRawMany<{ rating: number; count: string }>(),
            // Anonymous: never select the rater.
            this.ratingRepo.find({
                where: { agentId },
                select: ['rating', 'comment', 'createdAt'],
                order: { createdAt: 'DESC' },
                take: RECENT_RATINGS_LIMIT,
            }),
        ]);

        const distribution: Record<string, number> = {};
        for (let star = AGENT_RATING_MIN; star <= AGENT_RATING_MAX; star++) distribution[star] = 0;
        let count = 0;
        let total = 0;
        for (const row of grouped) {
            const n = Number(row.count);
            distribution[Number(row.rating)] = n;
            count += n;
            total += Number(row.rating) * n;
        }
        return {
            average: count > 0 ? Math.round((total / count) * 100) / 100 : null,
            count,
            distribution,
            recent: recent.map((r) => ({ rating: r.rating, comment: r.comment, createdAt: r.createdAt })),
        };
    }

    async getAllRatings(): Promise<{
        agents: Array<{ agentId: string; fullName: string; average: number; count: number }>;
        recent: Array<{ agentId: string; agentName: string; raterName: string; ticketId: string; ticketNumber: string | null; rating: number; comment: string | null; createdAt: Date }>;
    }> {
        const [agents, recent] = await Promise.all([
            this.dataSource.query(
                `SELECT r."agentId", u."fullName", ROUND(AVG(r.rating)::numeric, 2)::float AS average, COUNT(*)::int AS count
                 FROM agent_ratings r JOIN users u ON u.id = r."agentId"
                 GROUP BY r."agentId", u."fullName" ORDER BY average DESC, count DESC`,
            ),
            this.ratingRepo.find({
                relations: ['agent', 'rater', 'ticket'],
                order: { createdAt: 'DESC' },
                take: RECENT_RATINGS_LIMIT,
            }),
        ]);
        return {
            agents,
            recent: recent.map((r) => ({
                agentId: r.agentId,
                agentName: r.agent?.fullName ?? '-',
                raterName: r.rater?.fullName ?? '-',
                ticketId: r.ticketId,
                ticketNumber: r.ticket?.ticketNumber ?? null,
                rating: r.rating,
                comment: r.comment,
                createdAt: r.createdAt,
            })),
        };
    }

    private async loadOwnedTicket(ticketId: string, userId: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
        if (!ticket) throw new NotFoundException('Ticket not found');
        if (ticket.userId !== userId) throw new ForbiddenException(AGENT_RATING_MESSAGES.NOT_OWNER);
        return ticket;
    }

    private ratingDeadline(ticket: Ticket): Date | null {
        if (ticket.status !== TicketStatus.CLOSED || !ticket.closedAt) return null;
        return new Date(new Date(ticket.closedAt).getTime() + RATING_WINDOW_MS);
    }
}
