import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentPerformanceReport } from './agent-performance.report';
import { User } from '../../users/entities/user.entity';
import { HandlingTeam, Ticket } from '../../ticketing/entities/ticket.entity';
import { DEV_HANDLING_TEAMS } from '../utils/report-team-scope.util';
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
      leftJoin: jest.fn((...args: any[]) => { calls.push({ method: 'leftJoin', args }); return qb; }),
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
    mockQB._calls.find((c: any) => c.method === 'andWhere' && String(c.args[0]).includes('handlingTeam'))?.args[1];

  it('uses handlingTeam on every query, never the current assignee role', async () => {
    await service.generate({ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') }, { team: HandlingTeam.OPS_SUPPORT });
    expect(teamRolesFilter()).toEqual({ reportTeam: HandlingTeam.OPS_SUPPORT });
    expect(mockQB._calls.filter((c: any) => c.method === 'andWhere' && String(c.args[0]).includes('handlingTeam'))).toHaveLength(2);
    expect(mockQB._calls.some((c: any) => String(c.args[0]).includes('user.role'))).toBe(false);
  });

  it('limits agents to IT Support roles when team=OPS_SUPPORT', async () => {
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { team: HandlingTeam.OPS_SUPPORT }
    );

    expect(teamRolesFilter()).toEqual({ reportTeam: HandlingTeam.OPS_SUPPORT });
  });

  it('limits agents to AGENT_ORACLE when team=ORACLE_DEV', async () => {
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { team: HandlingTeam.ORACLE_DEV }
    );

    expect(teamRolesFilter()).toEqual({ reportTeam: HandlingTeam.ORACLE_DEV });
  });

  it('includes every dev role when team=ALL_DEV', async () => {
    await service.generate(
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      { team: ALL_DEV_TEAM }
    );

    expect(teamRolesFilter()).toEqual({ reportTeams: DEV_HANDLING_TEAMS });
  });

  it('applies no role filter without a team', async () => {
    await service.generate({ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') });
    expect(teamRolesFilter()).toBeUndefined();
  });

  it('maps persisted aggregate samples without rounding or inventing missing legacy measurements', async () => {
    mockQB.getRawMany.mockResolvedValueOnce([
      { agentId: 'new-pic', agentName: 'B', totalAssigned: '10', totalCancelled: '2', totalResolved: '8',
        slaEvaluated: '8', slaCompliant: '8', slaBreached: '0', responseSamples: '1', responseTotalMinutes: '0.5', resolutionSamples: '0' },
      { agentId: 'legacy', agentName: 'A', totalAssigned: '2', totalCancelled: '2', totalResolved: '0' },
    ]).mockResolvedValueOnce([{ agentId: 'new-pic', priority: 'HIGH', count: '10' }]);
    const result = await service.generate({ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') });
    expect(result.data[0]).toMatchObject({ agentId: 'new-pic', totalAssigned: 10, totalEligible: 8, resolutionRate: 100,
      slaComplianceRate: 100, avgResponseTimeMinutes: 0.5, avgResolutionTimeMinutes: null, agentSiteId: null,
      ticketsByPriority: { HIGH: 10 } });
    expect(result.data[1]).toMatchObject({ resolutionRate: null, slaComplianceRate: null, avgResponseTimeMinutes: null });
    const expressions = mockQB._calls.filter((c: any) => c.method === 'addSelect').map((c: any) => c.args[0]).join(' ');
    expect(expressions).toContain('ticket.firstResponseAt');
    expect(expressions).not.toContain('ticket_messages');
    expect(expressions).not.toContain('senderId');
    expect(result.generatedAt).toBe(mockQB._calls.find((c: any) => c.args[1]?.asOf)?.args[1].asOf);
  });

  it('propagates aggregation failures instead of fabricating zero response', async () => {
    mockQB.getRawMany.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.generate({ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') })).rejects.toThrow('database unavailable');
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
