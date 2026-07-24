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

    describe('getBoardData', () => {
        it('groups tickets into open/inProgress/resolved columns and counts waiting vendor', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });
            ticketRepo.find.mockResolvedValue([
                {
                    id: 't1',
                    status: TicketStatus.TODO,
                    description: 'Printer rusak',
                    user: { fullName: 'Budi' },
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
                    user: { fullName: 'Ani' },
                    assignedTo: { fullName: 'Agen Oracle' },
                    priority: TicketPriority.HIGH,
                    slaTarget: new Date('2026-07-25'),
                    isOverdue: true,
                    category: 'ORACLE_REQUEST',
                },
                {
                    id: 't3',
                    status: TicketStatus.RESOLVED,
                    description: 'Laptop lambat',
                    user: { fullName: 'Cici' },
                    assignedTo: { fullName: 'Agen A' },
                    priority: TicketPriority.LOW,
                    slaTarget: null,
                    isOverdue: false,
                    ticketType: TicketType.SERVICE,
                    category: 'GENERAL',
                },
            ]);
            ticketRepo.count.mockResolvedValue(3);

            const data = await service.getBoardData('site-1');

            expect(data.siteCode).toBe('SPJ');
            expect(data.open).toHaveLength(1);
            expect(data.open[0]).toMatchObject({ id: 't1', requesterName: 'Budi', isOracleRequest: true });
            expect(data.inProgress).toHaveLength(1);
            expect(data.inProgress[0]).toMatchObject({ id: 't2', assignedToName: 'Agen Oracle', isOverdue: true, isOracleRequest: true });
            expect(data.resolved).toHaveLength(1);
            expect(data.resolved[0]).toMatchObject({ id: 't3', isOracleRequest: false });
            expect(data.waitingVendorCount).toBe(3);
        });

        it('throws NotFoundException when site does not exist', async () => {
            siteRepo.findOne.mockResolvedValue(null);
            await expect(service.getBoardData('missing')).rejects.toThrow(NotFoundException);
        });
    });
});
