import { ForbiddenException } from '@nestjs/common';
import { AgentRatingService, AGENT_RATING_MESSAGES, RATING_WINDOW_MS } from './agent-rating.service';
import { TicketStatus } from '../entities/ticket.entity';

describe('AgentRatingService', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    let ticket: any;
    let ticketRepo: any;
    let assignmentRepo: any;
    let ratingRepo: any;
    let dataSource: any;
    let service: AgentRatingService;

    beforeEach(() => {
        ticket = { id: 't-1', userId: 'owner-1', status: TicketStatus.CLOSED, closedAt: new Date(Date.now() - DAY_MS) };
        ticketRepo = { findOne: jest.fn(() => Promise.resolve(ticket)) };
        assignmentRepo = {
            find: jest.fn().mockResolvedValue([
                { agentId: 'a-1', agent: { fullName: 'Agent Satu' } },
                { agentId: 'a-2', agent: { fullName: 'Agent Dua' } },
            ]),
            count: jest.fn(),
        };
        ratingRepo = {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn((data: any) => data),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
        };
        dataSource = { query: jest.fn() };
        service = new AgentRatingService(ticketRepo, assignmentRepo, ratingRepo, dataSource);
    });

    describe('getTicketRatings', () => {
        it('lists every agent who handled the ticket and allows rating inside the window', async () => {
            ratingRepo.find.mockResolvedValue([{ agentId: 'a-1', rating: 4, comment: 'Cepat' }]);

            const view = await service.getTicketRatings('t-1', 'owner-1');

            expect(view.canRate).toBe(true);
            expect(view.agents).toEqual([
                { agentId: 'a-1', fullName: 'Agent Satu', rating: 4, comment: 'Cepat' },
                { agentId: 'a-2', fullName: 'Agent Dua', rating: null, comment: null },
            ]);
        });

        it('closes rating once the 7-day window has passed', async () => {
            ticket.closedAt = new Date(Date.now() - RATING_WINDOW_MS - 1000);
            expect((await service.getTicketRatings('t-1', 'owner-1')).canRate).toBe(false);
        });

        it('does not allow rating before the ticket is closed', async () => {
            ticket = { ...ticket, status: TicketStatus.RESOLVED, closedAt: null };
            const view = await service.getTicketRatings('t-1', 'owner-1');
            expect(view.canRate).toBe(false);
            expect(view.ratingDeadline).toBeNull();
        });

        it('is only visible to the requester', async () => {
            await expect(service.getTicketRatings('t-1', 'agent-1')).rejects.toThrow(new ForbiddenException(AGENT_RATING_MESSAGES.NOT_OWNER));
        });
    });

    describe('submitRatings', () => {
        it('saves one rating per agent with the requester as rater', async () => {
            assignmentRepo.count.mockResolvedValue(2);

            await service.submitRatings('t-1', 'owner-1', [
                { agentId: 'a-1', rating: 5, comment: '  Mantap  ' },
                { agentId: 'a-2', rating: 3, comment: '   ' },
            ]);

            expect(ratingRepo.save).toHaveBeenCalledWith([
                { ticketId: 't-1', agentId: 'a-1', raterId: 'owner-1', rating: 5, comment: 'Mantap' },
                { ticketId: 't-1', agentId: 'a-2', raterId: 'owner-1', rating: 3, comment: null },
            ]);
        });

        it('rejects agents who never handled the ticket', async () => {
            assignmentRepo.count.mockResolvedValue(0);
            await expect(service.submitRatings('t-1', 'owner-1', [{ agentId: 'stranger', rating: 5 }]))
                .rejects.toThrow(AGENT_RATING_MESSAGES.UNKNOWN_AGENT);
        });

        it('rejects rating the same agent twice', async () => {
            assignmentRepo.count.mockResolvedValue(1);
            ratingRepo.count.mockResolvedValue(1);
            await expect(service.submitRatings('t-1', 'owner-1', [{ agentId: 'a-1', rating: 5 }]))
                .rejects.toThrow(AGENT_RATING_MESSAGES.ALREADY_RATED);
            expect(ratingRepo.save).not.toHaveBeenCalled();
        });

        it('rejects ratings after the window', async () => {
            ticket.closedAt = new Date(Date.now() - RATING_WINDOW_MS - 1000);
            await expect(service.submitRatings('t-1', 'owner-1', [{ agentId: 'a-1', rating: 5 }]))
                .rejects.toThrow(AGENT_RATING_MESSAGES.NOT_OPEN);
        });
    });

    describe('getMySummary', () => {
        it('aggregates the agent ratings without exposing who rated', async () => {
            ratingRepo.createQueryBuilder.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([{ rating: 5, count: '2' }, { rating: 2, count: '1' }]),
            });
            ratingRepo.find.mockResolvedValue([{ rating: 5, comment: 'Bagus', createdAt: new Date('2026-09-01') }]);

            const summary = await service.getMySummary('a-1');

            expect(summary.average).toBe(4);
            expect(summary.count).toBe(3);
            expect(summary.distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0, 5: 2 });
            expect(ratingRepo.find).toHaveBeenCalledWith(expect.objectContaining({ select: ['rating', 'comment', 'createdAt'] }));
            expect(summary.recent[0]).not.toHaveProperty('raterId');
        });
    });
});
