import { ForbiddenException } from '@nestjs/common';
import { AgentRatingService, AGENT_RATING_MESSAGES, RATING_PRIOR_MEAN, RATING_PRIOR_WEIGHT, RATING_WINDOW_MS, weightedRatingScore } from './agent-rating.service';
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

    describe('getAllRatings', () => {
        beforeEach(() => { dataSource.query.mockResolvedValue([]); });
        const agentsSql = () => String(dataSource.query.mock.calls[0][0]);

        it('ranks by a count-weighted score so one 5-star rating does not beat thirty near-perfect ones', async () => {
            await service.getAllRatings();
            expect(agentsSql()).toMatch(/ORDER BY score DESC, COUNT\(\*\) DESC/);
        });

        it.each([
            // [average, count] pairs from the user's screenshot.
            ['30 ratings at 4.97 above a single 5.00', [4.97, 30], [5, 1]],
            ['14 ratings at 4.93 above a single 5.00', [4.93, 14], [5, 1]],
            ['33 ratings at 5.00 above 30 at 4.97', [5, 33], [4.97, 30]],
            ['30 ratings at 5.00 above 3 at 5.00', [5, 30], [5, 3]],
        ])('weighted score: %s', (_label, better, worse) => {
            expect(weightedRatingScore(better[0], better[1])).toBeGreaterThan(weightedRatingScore(worse[0], worse[1]));
        });

        it('keeps every site when no site is chosen', async () => {
            await service.getAllRatings();
            expect(dataSource.query.mock.calls[0][1]).toEqual([RATING_PRIOR_WEIGHT, RATING_PRIOR_MEAN]);
            expect(agentsSql()).not.toContain('site');
        });

        it('limits agents and recent ratings to agents whose home site is the chosen site', async () => {
            ratingRepo.find.mockResolvedValue([]);
            await service.getAllRatings('SPJ');
            expect(dataSource.query.mock.calls[0][1]).toEqual([RATING_PRIOR_WEIGHT, RATING_PRIOR_MEAN, 'SPJ']);
            expect(agentsSql()).toContain('s."code" = $3');
            expect(ratingRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { agent: { site: { code: 'SPJ' } } } }));
        });
    });

    describe('getAgentRatings', () => {
        it('lists one agent\'s ratings newest first with rater, comment and ticket', async () => {
            ratingRepo.find.mockResolvedValue([{
                agentId: 'a-1', agent: { fullName: 'Andrew' }, rater: { fullName: 'Mega' }, ticketId: 't-9',
                ticket: { ticketNumber: '281026-HC-0086' }, rating: 4, comment: 'Cepat', createdAt: new Date('2026-10-28'),
            }]);

            const rows = await service.getAgentRatings('a-1');

            expect(ratingRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: 'a-1' }, order: { createdAt: 'DESC' } }));
            expect(rows).toEqual([{ raterName: 'Mega', ticketId: 't-9', ticketNumber: '281026-HC-0086', rating: 4, comment: 'Cepat', createdAt: new Date('2026-10-28') }]);
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
