import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TvBoardService } from './tv-board.service';
import { Site } from '../sites/entities/site.entity';
import { Ticket, TicketStatus, TicketPriority, TicketType } from '../ticketing/entities/ticket.entity';

describe('TvBoardService', () => {
    let service: TvBoardService;
    let siteRepo: { findOne: jest.Mock };
    let ticketRepo: { find: jest.Mock; count: jest.Mock };

    beforeEach(async () => {
        siteRepo = { findOne: jest.fn() };
        ticketRepo = { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };

        const module = await Test.createTestingModule({
            providers: [
                TvBoardService,
                { provide: getRepositoryToken(Site), useValue: siteRepo },
                { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
            ],
        }).compile();
        service = module.get(TvBoardService);
    });

    describe('resolveSiteIdByToken', () => {
        it('returns siteId for a valid token', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', tvToken: 'valid-token' });
            const siteId = await service.resolveSiteIdByToken('valid-token');
            expect(siteId).toBe('site-1');
        });

        it('throws NotFoundException for unknown token', async () => {
            siteRepo.findOne.mockResolvedValue(null);
            await expect(service.resolveSiteIdByToken('bad-token')).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException for empty token', async () => {
            await expect(service.resolveSiteIdByToken('')).rejects.toThrow(NotFoundException);
            expect(siteRepo.findOne).not.toHaveBeenCalled();
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('getBoardData', () => {
        it('groups tickets into open/inProgress columns and counts waiting vendor', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });
            ticketRepo.find.mockResolvedValue([
                {
                    id: 't1',
                    status: TicketStatus.TODO,
                    description: 'Printer rusak',
                    user: { fullName: 'Budi', department: { code: 'FIN', name: 'Finance' } },
                    assignedTo: null,
                    priority: TicketPriority.MEDIUM,
                    slaTarget: null,
                    isOverdue: false,
                    ticketType: TicketType.ORACLE_REQUEST,
                },
                {
                    id: 't2',
                    status: TicketStatus.IN_PROGRESS,
                    description: 'Permintaan K2 lama',
                    user: { fullName: 'Ani', department: { code: null, name: 'Human Resource' } },
                    assignedTo: { fullName: 'Agen Oracle' },
                    priority: TicketPriority.HIGH,
                    slaTarget: new Date('2026-07-25'),
                    isOverdue: true,
                    category: 'ORACLE_REQUEST',
                },
            ]);
            ticketRepo.count.mockResolvedValue(3);

            const data = await service.getBoardData('site-1');

            expect(data.siteCode).toBe('SPJ');
            expect(data.open).toHaveLength(1);
            expect(data.open[0]).toMatchObject({ id: 't1', requesterName: 'Budi', isOracleRequest: true });
            expect(data.inProgress).toHaveLength(1);
            expect(data.inProgress[0]).toMatchObject({ id: 't2', assignedToName: 'Agen Oracle', isOverdue: true, isOracleRequest: true });
            expect(data.waitingVendorCount).toBe(3);
        });

        it('never queries or returns resolved tickets', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });

            const data = await service.getBoardData('site-1');

            expect(data).not.toHaveProperty('resolved');
            const query = ticketRepo.find.mock.calls[0][0];
            const statuses = query.where.map((filter: { status: TicketStatus }) => filter.status);
            expect(statuses).toEqual([TicketStatus.TODO, TicketStatus.IN_PROGRESS]);
        });

        it('maps requester department using code, falling back to name, then null', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });
            ticketRepo.find.mockResolvedValue([
                {
                    id: 'a',
                    status: TicketStatus.TODO,
                    description: 'Pakai code',
                    user: { fullName: 'Budi', department: { code: 'IT', name: 'Information Technology' } },
                    assignedTo: null,
                    priority: TicketPriority.LOW,
                    slaTarget: null,
                    isOverdue: false,
                },
                {
                    id: 'b',
                    status: TicketStatus.TODO,
                    description: 'Code kosong, pakai name',
                    user: { fullName: 'Ani', department: { code: '', name: 'Human Resource' } },
                    assignedTo: null,
                    priority: TicketPriority.LOW,
                    slaTarget: null,
                    isOverdue: false,
                },
                {
                    id: 'c',
                    status: TicketStatus.TODO,
                    description: 'Tanpa department',
                    user: { fullName: 'Cici' },
                    assignedTo: null,
                    priority: TicketPriority.LOW,
                    slaTarget: null,
                    isOverdue: false,
                },
            ]);

            const data = await service.getBoardData('site-1');

            expect(data.open.map((card) => card.requesterDepartment)).toEqual(['IT', 'Human Resource', null]);
        });

        it('loads the department relation so requesterDepartment can be resolved', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });

            await service.getBoardData('site-1');

            expect(ticketRepo.find.mock.calls[0][0].relations).toContain('user.department');
        });

        it('throws NotFoundException when site does not exist', async () => {
            siteRepo.findOne.mockResolvedValue(null);
            await expect(service.getBoardData('missing')).rejects.toThrow(NotFoundException);
        });
    });
});
