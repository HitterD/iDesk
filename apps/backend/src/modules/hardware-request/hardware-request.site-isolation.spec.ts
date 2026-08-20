// apps/backend/src/modules/hardware-request/hardware-request.site-isolation.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { HardwareRequestQueryService, ActingUser } from './services/hardware-request-query.service';
import { HardwareRole } from './domain/enums/hardware-role.enum';
import { UserRole } from '../users/enums/user-role.enum';

const SITE_SPJ = 'site-spj';
const SITE_SMG = 'site-smg';

// Site-locked roles (non-cross-site). These must be pinned to their own site.
const SITE_LOCKED_ROLES: Array<{ hardware: HardwareRole; user: UserRole }> = [
  { hardware: HardwareRole.USER, user: UserRole.USER },
  { hardware: HardwareRole.ICT_STAFF, user: UserRole.AGENT },
  { hardware: HardwareRole.ICT_STAFF, user: UserRole.AGENT_ADMIN },
  { hardware: HardwareRole.ICT_STAFF, user: UserRole.AGENT_OPERATIONAL_SUPPORT },
];

// Cross-site roles (ADMIN/MANAGER) — unrestricted unless they narrow.
const CROSS_SITE_ROLES: Array<{ hardware: HardwareRole; user: UserRole }> = [
  { hardware: HardwareRole.ICT_STAFF, user: UserRole.ADMIN },
  { hardware: HardwareRole.ICT_STAFF, user: UserRole.MANAGER },
];

function makeActor(hardware: HardwareRole, user: UserRole, siteId: string | null): ActingUser & { siteId?: string | null; userRole?: UserRole } {
  return { id: 'u', role: hardware, userRole: user, siteId };
}

describe('HardwareRequest site isolation', () => {
  let service: HardwareRequestQueryService;
  let repo: any;

  beforeEach(() => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    service = new HardwareRequestQueryService(repo as any);
  });

  describe('list', () => {
    it.each(SITE_LOCKED_ROLES)('pins %s (userRole) to their own site (ignores dto.siteId)', async ({ hardware, user }) => {
      await service.list(makeActor(hardware, user, SITE_SPJ), { siteId: SITE_SMG });

      // Must pin to actor's site, not the dto one
      expect(repo.andWhere).toHaveBeenCalledWith('r.siteId = :siteId', { siteId: SITE_SPJ });
      // Must not honor the foreign dto.siteId
      expect(repo.andWhere).not.toHaveBeenCalledWith('r.siteId = :siteId', { siteId: SITE_SMG });
    });

    it.each(SITE_LOCKED_ROLES)('matches nothing for %s with no site (fail-closed via 1=0)', async ({ hardware, user }) => {
      await service.list(makeActor(hardware, user, null), {});

      expect(repo.andWhere).toHaveBeenCalledWith('1 = 0');
    });

    it.each(CROSS_SITE_ROLES)('leaves %s unrestricted (can pass explicit site or omit)', async ({ hardware, user }) => {
      await service.list(makeActor(hardware, user, null), { siteId: SITE_SMG });

      expect(repo.andWhere).toHaveBeenCalledWith('r.siteId = :siteId', { siteId: SITE_SMG });
    });

    it.each(CROSS_SITE_ROLES)('cross-site with no siteId param returns across sites (no site filter)', async ({ hardware, user }) => {
      await service.list(makeActor(hardware, user, null), {});

      // No forced site filter for cross-site
      const calls = (repo.andWhere as jest.Mock).mock.calls.map((c: any[]) => c[0]);
      expect(calls).not.toContain('r.siteId = :siteId');
      expect(calls).not.toContain('1 = 0');
    });
  });

  describe('getById', () => {
    it('site-locked cannot read other site (403)', async () => {
      repo.findOne.mockResolvedValue({ id: 'r1', siteId: SITE_SMG });

      await expect(
        service.getById(makeActor(HardwareRole.USER, UserRole.USER, SITE_SPJ), 'r1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cross-site can read any site', async () => {
      repo.findOne.mockResolvedValue({ id: 'r1', siteId: SITE_SMG });

      const result = await service.getById(makeActor(HardwareRole.ICT_STAFF, UserRole.ADMIN, null), 'r1');
      expect(result.siteId).toBe(SITE_SMG);
    });

    it('same-site can read own site', async () => {
      repo.findOne.mockResolvedValue({ id: 'r1', siteId: SITE_SPJ });

      const result = await service.getById(makeActor(HardwareRole.ICT_STAFF, UserRole.AGENT, SITE_SPJ), 'r1');
      expect(result.siteId).toBe(SITE_SPJ);
    });
  });

  describe('cross-site smoke: list for site A is invisible to site B agent', () => {
    it('agent at SPJ does not see SMG requests', async () => {
      await service.list(makeActor(HardwareRole.ICT_STAFF, UserRole.AGENT, SITE_SPJ), { siteId: SITE_SMG });

      expect(repo.andWhere).toHaveBeenCalledWith('r.siteId = :siteId', { siteId: SITE_SPJ });
      expect(repo.andWhere).not.toHaveBeenCalledWith('r.siteId = :siteId', { siteId: SITE_SMG });
    });
  });
});
