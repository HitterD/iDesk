import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketVolumeReport } from './ticket-volume.report';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { Repository } from 'typeorm';

describe('TicketVolumeReport (with site filter)', () => {
  let service: TicketVolumeReport;
  let ticketRepo: jest.Mocked<Repository<Ticket>>;

  beforeEach(async () => {
    const mockQB: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        TicketVolumeReport,
        {
          provide: getRepositoryToken(Ticket),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQB),
          },
        },
      ],
    }).compile();

    service = module.get(TicketVolumeReport);
    ticketRepo = module.get(getRepositoryToken(Ticket));
  });

  it('should apply siteId filter when provided', async () => {
    const qb = (ticketRepo.createQueryBuilder as jest.Mock)();
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { siteId: 'site-krw' }
    );

    // Expect andWhere to have been called with site filter
    const andWhereSpy = qb.andWhere as jest.Mock;
    const calledWithSite = andWhereSpy.mock.calls.some((args: any[]) =>
      typeof args[0] === 'string' && args[0].includes('siteId') &&
      args[1] && args[1].siteId === 'site-krw'
    );

    expect(calledWithSite).toBe(true);
  });

  it('retains historical cancellations but excludes them from pending and eligible', async () => {
    const qb = (ticketRepo.createQueryBuilder as jest.Mock)();
    qb.getMany.mockResolvedValue(['CANCELLED', 'RESOLVED', 'TODO'].map(status => ({ status, createdAt: new Date('2026-01-02') })));
    const result = await service.generate({ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-03') });
    expect(result.data.summary).toMatchObject({ totalCreated: 3, totalResolved: 1, totalPending: 1, totalCancelled: 1, totalEligible: 2, resolutionRate: 50 });
    expect(result.data.daily.reduce((sum, day) => sum + day.pending, 0)).toBe(1);
  });

  it('should return correct report shape', async () => {
    const result = await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { siteId: 'site-krw' }
    );

    expect(result.reportType).toBe('TICKET_VOLUME');
    expect(result.data).toHaveProperty('daily');
    expect(result.data).toHaveProperty('summary');
    expect(result).toHaveProperty('generatedAt');
  });
});

describe('TicketVolumeReport daily buckets (WIB)', () => {
  // 05:00 WIB on Oct 4 is 22:00 UTC on Oct 3; it must count on Oct 4.
  it('buckets tickets by their WIB calendar day', async () => {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 't1', createdAt: new Date('2026-10-03T22:00:00.000Z'), status: 'TODO', priority: 'HIGH', category: 'X', source: 'WEB' },
      ]),
    };
    const report = new TicketVolumeReport({ createQueryBuilder: () => qb } as any);

    const result = await report.generate({
      startDate: new Date('2026-10-03T17:00:00.000Z'), // 00:00 WIB Oct 4
      endDate: new Date('2026-10-04T16:59:59.999Z'),   // 23:59 WIB Oct 4
    });

    expect(result.data.daily).toEqual([{ date: '2026-10-04', created: 1, resolved: 0, pending: 1 }]);
  });
});
