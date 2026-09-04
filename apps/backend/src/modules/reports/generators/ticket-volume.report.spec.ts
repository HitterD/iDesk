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
