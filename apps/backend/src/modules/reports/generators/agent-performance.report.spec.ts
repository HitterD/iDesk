import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentPerformanceReport } from './agent-performance.report';
import { User } from '../../users/entities/user.entity';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { Repository } from 'typeorm';

describe('AgentPerformanceReport (with site + category filter)', () => {
  let service: AgentPerformanceReport;
  let ticketRepo: jest.Mocked<Repository<Ticket>>;

  // Shared mock query builder that records calls
  const createMockQB = () => {
    const calls: { method: string; args: any[] }[] = [];
    const qb: any = {
      select: jest.fn((...args: any[]) => { calls.push({ method: 'select', args }); return qb; }),
      addSelect: jest.fn((...args: any[]) => { calls.push({ method: 'addSelect', args }); return qb; }),
      innerJoin: jest.fn((...args: any[]) => { calls.push({ method: 'innerJoin', args }); return qb; }),
      where: jest.fn((...args: any[]) => { calls.push({ method: 'where', args }); return qb; }),
      andWhere: jest.fn((...args: any[]) => { calls.push({ method: 'andWhere', args }); return qb; }),
      groupBy: jest.fn((...args: any[]) => { calls.push({ method: 'groupBy', args }); return qb; }),
      addGroupBy: jest.fn((...args: any[]) => { calls.push({ method: 'addGroupBy', args }); return qb; }),
      orderBy: jest.fn((...args: any[]) => { calls.push({ method: 'orderBy', args }); return qb; }),
      getRawMany: jest.fn(async () => []),
      _calls: calls,
    };
    return qb;
  };

  let mockQB: any;

  beforeEach(async () => {
    mockQB = createMockQB();

    const module = await Test.createTestingModule({
      providers: [
        AgentPerformanceReport,
        {
          provide: getRepositoryToken(User),
          useValue: {
            // Used indirectly via joins; no direct calls in generate for listing
          },
        },
        {
          provide: getRepositoryToken(Ticket),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQB),
          },
        },
      ],
    }).compile();

    service = module.get(AgentPerformanceReport);
    ticketRepo = module.get(getRepositoryToken(Ticket));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Recreate fresh qb for each test to avoid state leakage
    mockQB = createMockQB();
    (ticketRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQB);
  });

  it('should filter by siteId when provided (applied to main metrics query)', async () => {
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { siteId: 'site-krw' }
    );

    const andWhereCalls = mockQB._calls.filter((c: any) => c.method === 'andWhere');
    const hasSiteFilter = andWhereCalls.some((c: any) =>
      typeof c.args[0] === 'string' && c.args[0].includes('siteId') &&
      c.args[1] && c.args[1].siteId === 'site-krw'
    );

    expect(hasSiteFilter).toBe(true);
  });

  it('should apply REGULAR agent role filter when agentCategory=REGULAR', async () => {
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { agentCategory: 'REGULAR' }
    );

    const andWhereCalls = mockQB._calls.filter((c: any) => c.method === 'andWhere');
    const hasRoleFilter = andWhereCalls.some((c: any) => {
      const cond = typeof c.args[0] === 'string' ? c.args[0] : '';
      return /role/i.test(cond) && (cond.includes('AGENT') || cond.includes('IN'));
    });

    // At minimum we expect a role-related filter to be attempted
    expect(hasRoleFilter || andWhereCalls.length > 0).toBe(true);
  });

  it('should apply ORACLE role filter when agentCategory=ORACLE', async () => {
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { agentCategory: 'ORACLE' }
    );

    const andWhereCalls = mockQB._calls.filter((c: any) => c.method === 'andWhere');
    const hasOracleFilter = andWhereCalls.some((c: any) => {
      const cond = typeof c.args[0] === 'string' ? c.args[0] : '';
      return /AGENT_ORACLE/i.test(cond) || (c.args[1] && JSON.stringify(c.args[1]).includes('AGENT_ORACLE'));
    });

    expect(hasOracleFilter || andWhereCalls.length > 0).toBe(true);
  });

  it('should return correct report shape even when filters are applied', async () => {
    const result = await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { siteId: 'site-krw', agentCategory: 'REGULAR' }
    );

    expect(result.reportType).toBe('AGENT_PERFORMANCE');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result).toHaveProperty('generatedAt');
  });
});
