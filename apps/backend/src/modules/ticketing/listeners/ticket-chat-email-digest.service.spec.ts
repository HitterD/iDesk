import { TicketChatEmailDigestService } from './ticket-chat-email-digest.service';

describe('TicketChatEmailDigestService', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    let due: any[];
    let qb: any;
    let notificationRepo: any;
    let userRepo: any;
    let mail: any;
    let dataSource: any;
    let service: TicketChatEmailDigestService;

    beforeEach(() => {
        due = [{ id: 'n1', userId: 'u1', ticketId: 't1', title: '[#T-1] 3 pesan baru', message: 'Budi: "cek"' }];
        qb = {
            where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(), getMany: jest.fn(async () => due),
        };
        notificationRepo = { createQueryBuilder: jest.fn(() => qb), update: jest.fn() };
        userRepo = { findByIds: jest.fn().mockResolvedValue([{ id: 'u1', email: 'u1@x.co', role: 'USER', isActive: true }]) };
        mail = { send: jest.fn().mockResolvedValue({ success: true }) };
        dataSource = { query: jest.fn().mockResolvedValue([{ job: 'x' }]) };
        service = new TicketChatEmailDigestService(notificationRepo, userRepo, mail, dataSource);
    });

    it('emails one summary per unread ticket, marks it, and links to the reader portal', async () => {
        const sent = await service.run(now);

        expect(sent).toBe(1);
        expect(notificationRepo.update).toHaveBeenCalledWith({ id: 'n1' }, { emailedAt: now });
        expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'u1@x.co',
            subject: '[#T-1] 3 pesan baru',
            context: expect.objectContaining({ link: expect.stringContaining('/client/tickets/t1') }),
        }));
    });

    it('only looks at chat notifications unread for 15 minutes and not emailed within the hour', async () => {
        await service.run(now);
        const conditions = qb.andWhere.mock.calls.map((c: any[]) => c[0]).join(' | ');
        expect(conditions).toContain('n.isRead = false');
        expect(conditions).toContain('n.createdAt <= :readBy');
        expect(conditions).toContain('n.emailedAt <= :again');
        const params = Object.assign({}, ...qb.andWhere.mock.calls.map((c: any[]) => c[1] ?? {}));
        expect(now.getTime() - params.readBy.getTime()).toBe(15 * 60_000);
        expect(now.getTime() - params.again.getTime()).toBe(60 * 60_000);
    });

    it('does nothing when another instance already ran this slot', async () => {
        dataSource.query.mockResolvedValueOnce([]);
        expect(await service.run(now)).toBe(0);
        expect(mail.send).not.toHaveBeenCalled();
    });
});
