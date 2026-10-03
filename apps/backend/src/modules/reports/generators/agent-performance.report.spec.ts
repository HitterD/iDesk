import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentPerformanceReport } from './agent-performance.report';
import { User } from '../../users/entities/user.entity';
import { HandlingTeam, Ticket } from '../../ticketing/entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { ALL_DEV_TEAM } from '../utils/report-team-scope.util';
import { Repository } from 'typeorm';

describe('AgentPerformanceReport (with site + team filter)', () => {
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

  const teamRolesFilter = () =>
    mockQB._calls.find((c: any) => c.method === 'andWhere' && String(c.args[0]).includes(':...teamRoles'))?.args[1]?.teamRoles;

  it('limits agents to IT Support roles when team=OPS_SUPPORT', async () => {
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { team: HandlingTeam.OPS_SUPPORT }
    );

    expect(teamRolesFilter()).toEqual(
      expect.arrayContaining([UserRole.AGENT, UserRole.AGENT_ADMIN, UserRole.AGENT_OPERATIONAL_SUPPORT]),
    );
    expect(teamRolesFilter()).not.toContain(UserRole.AGENT_ORACLE);
  });

  it('limits agents to AGENT_ORACLE when team=ORACLE_DEV', async () => {
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { team: HandlingTeam.ORACLE_DEV }
    );

    expect(teamRolesFilter()).toEqual([UserRole.AGENT_ORACLE]);
  });

  it('includes every dev role when team=ALL_DEV', async () => {
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { team: ALL_DEV_TEAM }
    );

    expect(teamRolesFilter()).toEqual(
      expect.arrayContaining([UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV]),
    );
    expect(teamRolesFilter()).not.toContain(UserRole.AGENT);
  });

  it('applies no role filter without a team', async () => {
    await service.generate({ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') });
    expect(teamRolesFilter()).toBeUndefined();
  });

  it('should return correct report shape even when filters are applied', async () => {
    const result = await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { siteId: 'site-krw', team: HandlingTeam.OPS_SUPPORT }
    );

    expect(result.reportType).toBe('AGENT_PERFORMANCE');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result).toHaveProperty('generatedAt');
  });
});
