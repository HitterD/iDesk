import { ForbiddenException } from '@nestjs/common';
import { WorkloadService } from './workload.service';
import { UserRole } from '../users/enums/user-role.enum';
import { SiteActor } from '../../shared/core/utils/site-scope.util';

const SITE_SPJ = 'site-spj';
const SITE_SMG = 'site-smg';

const SITE_LOCKED_ROLES = [
  UserRole.AGENT,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
  UserRole.AGENT_ADMIN,
  UserRole.USER,
];

const CROSS_SITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

function makeAgent(id: string, siteId: string) {
  return {
    id,
    fullName: `Agent ${id}`,
    email: `${id}@x.com`,
    role: UserRole.AGENT,
    siteId,
    site: { code: siteId === SITE_SPJ ? 'SPJ' : 'SMG', name: siteId },
    isActive: true,
    appraisalPoints: 0,
  };
}

describe('WorkloadService site isolation', () => {
  let service: WorkloadService;
  let priorityWeightRepo: any;
  let workloadRepo: any;
  let ticketRepo: any;
  let userRepo: any;

  beforeEach(() => {
    priorityWeightRepo = { find: jest.fn().mockResolvedValue([]) };
    workloadRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (rows: any) => (Array.isArray(rows) ? rows.map((r: any, i: number) => ({ ...r, id: `w${i}` })) : { ...rows, id: 'w1' })),
      create: jest.fn((data: any) => data),
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    ticketRepo = { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
    userRepo = { find: jest.fn() };

    service = new WorkloadService(
      { logAsync: jest.fn() } as any,
      priorityWeightRepo,
      workloadRepo,
      ticketRepo,
      userRepo,
      { emit: jest.fn() } as any,
    );
  });

  describe('getAllAgentWorkloads', () => {
    it.each(SITE_LOCKED_ROLES)('pins %s to their own site (ignores provided siteId)', async (role) => {
      userRepo.find.mockResolvedValue([makeAgent('a1', SITE_SPJ)]);

      await service.getAllAgentWorkloads({ role, siteId: SITE_SPJ } as SiteActor, SITE_SMG);

      // The service should have queried users with siteId = SITE_SPJ, not SMG
      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId: SITE_SPJ }),
        }),
      );
    });

    it.each(SITE_LOCKED_ROLES)('matches nothing for %s with no site (fail-closed via empty agents)', async (role) => {
      // When actor has no site and is not cross-site, getAll should return []
      // The implementation returns [] early if no agents (after userRepo returns [])
      userRepo.find.mockResolvedValue([]);

      const result = await service.getAllAgentWorkloads({ role, siteId: null } as SiteActor, undefined);

      expect(result).toEqual([]);
    });

    it.each(CROSS_SITE_ROLES)('leaves %s unrestricted (can pass explicit site or omit)', async (role) => {
      userRepo.find.mockResolvedValue([makeAgent('a1', SITE_SMG)]);

      // Cross-site passes explicit site
      await service.getAllAgentWorkloads({ role, siteId: null } as SiteActor, SITE_SMG);

      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId: SITE_SMG }),
        }),
      );
    });

    it.each(CROSS_SITE_ROLES)('cross-site with no siteId param returns agents across sites (no site filter)', async (role) => {
      userRepo.find.mockResolvedValue([makeAgent('a1', SITE_SPJ), makeAgent('a2', SITE_SMG)]);

      await service.getAllAgentWorkloads({ role, siteId: null } as SiteActor, undefined);

      // No siteId in where clause for users
      const callArg = userRepo.find.mock.calls[0][0];
      expect(callArg.where.siteId).toBeUndefined();
    });
  });

  describe('getAgentWorkload', () => {
    it('site-locked cannot read workload for other site (403)', async () => {
      await expect(
        service.getAgentWorkload({ role: UserRole.AGENT, siteId: SITE_SPJ } as SiteActor, 'agent-1', SITE_SMG),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cross-site can read workload for any site', async () => {
      // When cross-site and site provided, it should not throw and should query that site
      workloadRepo.findOne.mockResolvedValue({
        id: 'w1',
        agentId: 'agent-1',
        siteId: SITE_SMG,
        totalPoints: 0,
        activeTickets: 0,
        resolvedTickets: 0,
      });

      const result = await service.getAgentWorkload({ role: UserRole.ADMIN, siteId: null } as SiteActor, 'agent-1', SITE_SMG);
      expect(result.siteId).toBe(SITE_SMG);
    });

    it('same-site agent can read own site workload', async () => {
      workloadRepo.findOne.mockResolvedValue({
        id: 'w1',
        agentId: 'agent-1',
        siteId: SITE_SPJ,
        totalPoints: 5,
        activeTickets: 1,
        resolvedTickets: 0,
      });

      const result = await service.getAgentWorkload({ role: UserRole.AGENT, siteId: SITE_SPJ } as SiteActor, 'agent-1', SITE_SPJ);
      expect(result.totalPoints).toBe(5);
    });
  });

  describe('recalculateAgentWorkload', () => {
    it('site-locked cannot recalculate other site (403)', async () => {
      await expect(
        service.recalculateAgentWorkload({ role: UserRole.AGENT, siteId: SITE_SPJ } as SiteActor, 'agent-1', SITE_SMG),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ADMIN can recalculate any site', async () => {
      ticketRepo.find.mockResolvedValue([]);
      ticketRepo.count.mockResolvedValue(0);
      workloadRepo.findOne.mockResolvedValue(null);
      workloadRepo.save.mockResolvedValue({ id: 'w1', agentId: 'agent-1', siteId: SITE_SMG });

      const result = await service.recalculateAgentWorkload({ role: UserRole.ADMIN, siteId: null } as SiteActor, 'agent-1', SITE_SMG);
      expect(result.siteId).toBe(SITE_SMG);
    });
  });

  describe('cross-site smoke: workload list for site A is invisible to site B agent', () => {
    it('agent at SPJ does not see SMG agents in getAll', async () => {
      // Simulate: service should only query users for actor's site
      userRepo.find.mockResolvedValue([]);

      await service.getAllAgentWorkloads({ role: UserRole.AGENT, siteId: SITE_SPJ } as SiteActor, SITE_SMG);

      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId: SITE_SPJ }),
        }),
      );
    });
  });
});
