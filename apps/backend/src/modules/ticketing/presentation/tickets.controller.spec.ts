import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TicketsController } from './tickets.controller';

describe('TicketsController', () => {
    let controller: any;
    let mockTicketCreateService: any;
    let mockTicketUpdateService: any;
    let mockTicketMessagingService: any;
    let mockTicketQueryService: any;
    let mockTicketMergeService: any;
    let mockTicketParticipantService: any;
    let mockTicketStatsService: any;
    let mockTicketSlaExtendService: any;
    let mockTicketForwardService: any;
    let mockTicketReminderService: any;
    let mockKbService: any;
    let mockTicketResolutionService: any;
    let mockAgentRatingService: any;
    let mockUserRepo: any;

    beforeEach(() => {
        mockUserRepo = {
            findOne: jest.fn(),
        };
        mockTicketMessagingService = {
            replyToTicket: jest.fn().mockResolvedValue({ id: 'msg-1', content: 'hello' }),
        };
        mockTicketParticipantService = {};
        mockTicketSlaExtendService = { extendSla: jest.fn().mockResolvedValue({}) };
        mockTicketForwardService = { forwardTicket: jest.fn().mockResolvedValue({}) };
        mockTicketReminderService = { createReminder: jest.fn(), getReminders: jest.fn(), deleteReminder: jest.fn() };
        mockKbService = { suggestForTicket: jest.fn().mockResolvedValue([]) };
        mockTicketResolutionService = {
            confirmResolution: jest.fn().mockResolvedValue({ status: 'CLOSED' }),
            disputeResolution: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS' }),
            selfResolve: jest.fn().mockResolvedValue({ status: 'CLOSED' }),
        };
        mockAgentRatingService = { getTicketRatings: jest.fn(), submitRatings: jest.fn() };
        mockTicketStatsService = {
            getHardwareInstallationStats: jest.fn().mockResolvedValue({
                total: 10,
                pending: 3,
                inProgress: 5,
                completed: 2
            })
        };

        controller = new TicketsController(
            mockTicketCreateService,
            mockTicketUpdateService,
            mockTicketMessagingService,
            mockTicketQueryService,
            mockTicketMergeService,
            mockTicketParticipantService,
            mockTicketStatsService,
            mockTicketSlaExtendService,
            mockTicketForwardService,
            mockTicketReminderService,
            mockKbService,
            mockTicketResolutionService,
            mockAgentRatingService,
            mockUserRepo,
            { reschedule: jest.fn() } as any,
        );
    });

    it('should return hardware stats', async () => {
        const req = { user: { userId: 'user1', role: 'ADMIN' } };
        const stats = await controller.getHardwareStats(req);

        expect(mockTicketStatsService.getHardwareInstallationStats).toHaveBeenCalledWith('user1');
        expect(stats).toEqual({
            total: 10,
            pending: 3,
            inProgress: 5,
            completed: 2
        });
    });

    describe('replyToTicketS2S', () => {
        const secret = 'secret-uji-khusus-test';
        const ticketId = '856ecda4-08b4-40cb-8666-5f668225aabf';
        let originalSecret: string | undefined;

        beforeEach(() => {
            originalSecret = process.env.SJA_INTERNAL_SECRET;
            process.env.SJA_INTERNAL_SECRET = secret;
        });

        afterEach(() => {
            if (originalSecret === undefined) {
                delete process.env.SJA_INTERNAL_SECRET;
            } else {
                process.env.SJA_INTERNAL_SECRET = originalSecret;
            }
        });

        it('should reject when s2s secret is invalid', async () => {
            await expect(
                controller.replyToTicketS2S(ticketId, 'wrong-secret', { employeeId: '20451', content: 'test' }, {}),
            ).rejects.toThrow('Unauthorized S2S request');
        });

        // Fail-closed: tanpa SJA_INTERNAL_SECRET di environment, endpoint harus
        // menolak semua request. Sebelumnya ada fallback secret hardcoded di kode,
        // sehingga siapa pun yang membaca repo bisa membalas atas nama user lain.
        it('should refuse every request when SJA_INTERNAL_SECRET is not configured', async () => {
            delete process.env.SJA_INTERNAL_SECRET;

            await expect(
                controller.replyToTicketS2S(ticketId, 'sja-internal-s2s-token-2026', { employeeId: '20451', content: 'test' }, {}),
            ).rejects.toThrow('S2S reply endpoint is not configured');

            expect(mockTicketMessagingService.replyToTicket).not.toHaveBeenCalled();
        });

        it('should reject when the s2s token header is missing entirely', async () => {
            await expect(
                controller.replyToTicketS2S(ticketId, undefined, { employeeId: '20451', content: 'test' }, {}),
            ).rejects.toThrow('Unauthorized S2S request');

            expect(mockTicketMessagingService.replyToTicket).not.toHaveBeenCalled();
        });

        it('should find user by employeeId and reply to ticket', async () => {
            mockUserRepo.findOne.mockResolvedValue({ id: 'user-uuid-1', employeeId: '20451', isActive: true });

            const result = await controller.replyToTicketS2S(
                ticketId,
                secret,
                { employeeId: '20451', content: 'yaaa?' },
                {},
            );

            expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { employeeId: '20451' } });
            expect(mockTicketMessagingService.replyToTicket).toHaveBeenCalledWith(
                ticketId,
                'user-uuid-1',
                'yaaa?',
                [],
                [],
                false,
            );
            expect(result).toEqual({
                success: true,
                message: { id: 'msg-1', content: 'hello' },
            });
        });
    });

    describe('replyToTicket attachments', () => {
        const ticketId = '856ecda4-08b4-40cb-8666-5f668225aabf';
        const req = { user: { userId: 'agent-1' } };
        let dir: string;

        const upload = (name: string, bytes: number[], mimetype: string): Express.Multer.File => {
            const path = join(dir, 'tickets', ticketId, `${name}.bin`);
            mkdirSync(join(dir, 'tickets', ticketId), { recursive: true });
            writeFileSync(path, Buffer.from(bytes));
            return { originalname: name, path, size: bytes.length, mimetype, filename: `${name}.bin` } as Express.Multer.File;
        };

        beforeEach(() => {
            dir = mkdtempSync(join(tmpdir(), 'reply-'));
        });
        afterEach(() => rmSync(dir, { recursive: true, force: true }));

        it('stores original name, size and type next to the paths', async () => {
            const file = upload('Laporan Q3.xlsx', [0x50, 0x4b, 0x03, 0x04], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            await controller.replyToTicket(ticketId, req, 'cek', '[]', 'false', [file]);

            const [, , , paths, , , info] = mockTicketMessagingService.replyToTicket.mock.calls[0];
            expect(paths).toHaveLength(1);
            expect(info).toEqual([{ path: paths[0], name: 'Laporan Q3.xlsx', size: 4, mime: file.mimetype }]);
        });

        it('passes a reply link to the service and ignores one that is not a UUID', async () => {
            const original = '0b6e3c1a-2f4d-4c8e-9a71-5d2b8f9e0c13';
            await controller.replyToTicket(ticketId, req, 'cek', '[]', 'false', [], original);
            expect(mockTicketMessagingService.replyToTicket.mock.calls[0][9]).toEqual({ replyToId: original });

            await controller.replyToTicket(ticketId, req, 'cek', '[]', 'false', [], 'bukan-uuid');
            expect(mockTicketMessagingService.replyToTicket.mock.calls[1][9]).toEqual({ replyToId: undefined });
        });

        it('rejects a file whose bytes do not match its extension and deletes every upload', async () => {
            const good = upload('ok.pdf', [0x25, 0x50, 0x44, 0x46], 'application/pdf');
            const bad = upload('virus.pdf', [0x4d, 0x5a, 0x90, 0x00], 'application/pdf');

            await expect(controller.replyToTicket(ticketId, req, 'x', '[]', 'false', [good, bad]))
                .rejects.toThrow('virus.pdf');
            expect(mockTicketMessagingService.replyToTicket).not.toHaveBeenCalled();
            await new Promise((r) => setTimeout(r, 20));
            expect(existsSync(good.path)).toBe(false);
            expect(existsSync(bad.path)).toBe(false);
        });

        it('deletes the uploads when the reply itself fails', async () => {
            const file = upload('a.txt', [0x68, 0x69], 'text/plain');
            mockTicketMessagingService.replyToTicket.mockRejectedValueOnce(new Error('Tiket sudah ditutup'));

            await expect(controller.replyToTicket(ticketId, req, 'x', '[]', 'false', [file])).rejects.toThrow('ditutup');
            await new Promise((r) => setTimeout(r, 20));
            expect(existsSync(file.path)).toBe(false);
        });
    });

    describe('markRead', () => {
        it('marks the ticket read for the caller after checking they may see it', async () => {
            mockTicketQueryService = { assertCanView: jest.fn().mockResolvedValue(undefined) };
            mockTicketMessagingService.markAsRead = jest.fn().mockResolvedValue(undefined);
            controller.ticketQueryService = mockTicketQueryService;

            await controller.markRead('t-1', { user: { userId: 'agent-1', role: 'AGENT', siteId: 'site-1' } });

            expect(mockTicketQueryService.assertCanView).toHaveBeenCalledWith('t-1', { id: 'agent-1', role: 'AGENT', siteId: 'site-1' });
            expect(mockTicketMessagingService.markAsRead).toHaveBeenCalledWith('t-1', 'agent-1', 'AGENT', 'site-1');
        });

        it('does not mark a ticket the caller may not see', async () => {
            mockTicketQueryService = { assertCanView: jest.fn().mockRejectedValue(new Error('Forbidden')) };
            mockTicketMessagingService.markAsRead = jest.fn();
            controller.ticketQueryService = mockTicketQueryService;

            await expect(controller.markRead('t-1', { user: { userId: 'u-9', role: 'USER', siteId: null } })).rejects.toThrow('Forbidden');
            expect(mockTicketMessagingService.markAsRead).not.toHaveBeenCalled();
        });
    });

    describe('findOne', () => {
        it('does not mark a ticket read when the caller may not see it', async () => {
            mockTicketQueryService = { findOne: jest.fn().mockRejectedValue(new Error('Forbidden')) };
            mockTicketMessagingService.markAsRead = jest.fn();
            controller.ticketQueryService = mockTicketQueryService;

            await expect(controller.findOne('t-1', { user: { userId: 'u-9', role: 'USER', siteId: null } })).rejects.toThrow('Forbidden');
            expect(mockTicketMessagingService.markAsRead).not.toHaveBeenCalled();
        });

        it('marks the ticket read once the caller has been allowed to see it', async () => {
            mockTicketQueryService = { findOne: jest.fn().mockResolvedValue({ id: 't-1' }) };
            mockTicketMessagingService.markAsRead = jest.fn().mockResolvedValue(undefined);
            controller.ticketQueryService = mockTicketQueryService;

            await expect(controller.findOne('t-1', { user: { userId: 'agent-1', role: 'AGENT', siteId: 'site-1' } })).resolves.toEqual({ id: 't-1' });
            expect(mockTicketMessagingService.markAsRead).toHaveBeenCalledWith('t-1', 'agent-1', 'AGENT', 'site-1');
        });
    });

    describe('resolution confirmation', () => {
        const req = { user: { userId: 'owner-1', role: 'USER' } };

        it('passes the caller as the requester for confirm, dispute and self-resolve', async () => {
            await controller.confirmResolution('t-1', req);
            await controller.disputeResolution('t-1', { reason: 'Masih error' }, req);
            await controller.selfResolve('t-1', req);

            expect(mockTicketResolutionService.confirmResolution).toHaveBeenCalledWith('t-1', 'owner-1');
            expect(mockTicketResolutionService.disputeResolution).toHaveBeenCalledWith('t-1', 'owner-1', 'Masih error');
            expect(mockTicketResolutionService.selfResolve).toHaveBeenCalledWith('t-1', 'owner-1');
        });

        it('submits agent ratings as the caller', async () => {
            const ratings = [{ agentId: 'a-1', rating: 5 }];
            await controller.submitAgentRatings('t-1', { ratings }, req);
            expect(mockAgentRatingService.submitRatings).toHaveBeenCalledWith('t-1', 'owner-1', ratings);
        });
    });
});
