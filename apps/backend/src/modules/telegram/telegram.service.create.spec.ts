import { TelegramService } from './telegram.service';
import { TicketPriority, TicketSource, TicketStatus } from '../ticketing/entities/ticket.entity';

function makeQb(getOneResult: any) {
    const qb: any = {};
    qb.where = jest.fn(() => qb);
    qb.orderBy = jest.fn(() => qb);
    qb.setLock = jest.fn(() => qb);
    qb.getOne = jest.fn().mockResolvedValue(getOneResult);
    return qb;
}

describe('TelegramService createTicket — uses the shared locked ticket-number generator (PROD-19)', () => {
    let service: TelegramService;
    let sessionRepo: any;
    let userRepo: any;
    let ticketRepo: any;
    let messageRepo: any;
    let cacheService: any;
    let bot: any;

    beforeEach(() => {
        sessionRepo = {};
        userRepo = {
            findOne: jest.fn().mockResolvedValue({ id: 'u1', department: { name: 'Information Technology' } }),
        };
        const manager: any = {
            createQueryBuilder: jest.fn(() => makeQb(null)),
            save: jest.fn(async (t: any) => ({ ...t, id: 'ticket-1' })),
            transaction: jest.fn(async (cb: any) => cb(manager)),
        };
        ticketRepo = {
            manager,
            save: jest.fn(async (t: any) => ({ ...t, id: 'ticket-1' })),
            create: jest.fn((d: any) => d),
            count: jest.fn().mockResolvedValue(10),
        };
        messageRepo = {
            create: jest.fn((d: any) => d),
            save: jest.fn(async (m: any) => ({ ...m, id: 'msg-1' })),
        };
        cacheService = { getAsync: jest.fn(), setAsync: jest.fn() };
        bot = {};

        service = new TelegramService(
            sessionRepo as any,
            userRepo as any,
            ticketRepo as any,
            messageRepo as any,
            {} as any,
            cacheService as any,
        );
    });

    it('generates the number inside a transactional pessimistic_write query, not via COUNT()+1', async () => {
        const ticket = await service.createTicket(
            { userId: 'u1', telegramId: 'tg1', chatId: 'c1' } as any,
            'My issue',
            'details',
            'GENERAL',
            'MEDIUM',
        );

        // The manager (transactional) builder took the lock:
        expect(ticketRepo.manager.createQueryBuilder).toHaveBeenCalled();
        const qb = (ticketRepo.manager.createQueryBuilder as jest.Mock).mock.results[0].value;
        expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
        // And the save went through the transaction manager, not the raw repo:
        expect(ticketRepo.manager.save).toHaveBeenCalled();
        expect(ticketRepo.save).not.toHaveBeenCalled();
        // The number was generated with a division from department (INF = Information):
        expect(ticket.ticketNumber).toMatch(/^\d{6}-INF-\d{4}$/);
    });
});
