import { ForbiddenException } from '@nestjs/common';
import { FoundClaimService } from './found-claim.service';
import { UserRole } from '../users/enums/user-role.enum';
import { FoundItemClaim, FoundClaimStatus } from './entities/found-item-claim.entity';
import { LostItemReport, LostItemStatus } from './entities/lost-item-report.entity';
import { LostItemStatusLog } from './entities/lost-item-status-log.entity';

const SITE_SPJ = 'site-spj';
const SITE_SMG = 'site-smg';

const SITE_LOCKED_ROLES = [
  UserRole.AGENT,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
  UserRole.AGENT_ADMIN,
  UserRole.USER,
];

const CROSS_SITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

function makeClaim(overrides: Partial<FoundItemClaim> = {}): FoundItemClaim {
  return {
    id: 'fc-1',
    finderId: 'u1',
    lostItemReportId: null,
    siteId: SITE_SMG,
    locationFound: 'Lobby',
    foundAt: new Date('2026-01-01'),
    description: 'Laptop',
    photoUrls: [],
    status: FoundClaimStatus.PENDING,
    matchedById: null,
    matchedAt: null,
    managerNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FoundItemClaim;
}

describe('FoundClaimService site isolation', () => {
  let service: FoundClaimService;
  let claimRepo: any;
  let reportRepo: any;
  let statusLogRepo: any;

  beforeEach(() => {
    claimRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x: any) => x),
      update: jest.fn(),
      create: jest.fn((x: any) => x),
    };
    reportRepo = { findOne: jest.fn() };
    statusLogRepo = { create: jest.fn((x) => x), save: jest.fn() };

    service = new FoundClaimService(
      claimRepo as any,
      reportRepo as any,
      statusLogRepo as any,
      { emit: jest.fn() } as any,
      {
        transaction: async (fn: any) =>
          fn({
            getRepository: (e: any) => {
              if (e === FoundItemClaim) return claimRepo;
              if (e === LostItemReport) return reportRepo;
              if (e === LostItemStatusLog) return statusLogRepo;
              return claimRepo;
            },
          }),
      } as any,
    );
  });

  function setupQb(terminalResult: any) {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(terminalResult),
    };
    claimRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  describe('findAll', () => {
    it.each(SITE_LOCKED_ROLES)('pins %s to their own site via siteId column', async (role) => {
      const qb = setupQb([]);
      await service.findAll({ role, siteId: SITE_SPJ });

      expect(qb.andWhere).toHaveBeenCalledWith('c.siteId = :userSiteId', { userSiteId: SITE_SPJ });
    });

    it.each(SITE_LOCKED_ROLES)('matches nothing for %s with no site (fail-closed)', async (role) => {
      const qb = setupQb([]);
      await service.findAll({ role, siteId: null });

      expect(qb.andWhere).toHaveBeenCalledWith('1 = 0');
    });

    it.each(CROSS_SITE_ROLES)('leaves %s unrestricted', async (role) => {
      const qb = setupQb([]);
      await service.findAll({ role, siteId: null });

      expect(qb.andWhere).not.toHaveBeenCalledWith('1 = 0');
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('userSiteId'),
        expect.anything(),
      );
    });
  });

  describe('findOne', () => {
    it('site-locked cannot read claim from other site (403)', async () => {
      claimRepo.findOne.mockResolvedValue(makeClaim());
      await expect(
        service.findOne('fc-1', { role: UserRole.AGENT, siteId: SITE_SPJ }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cross-site can read other site', async () => {
      claimRepo.findOne.mockResolvedValue(makeClaim());
      const result = await service.findOne('fc-1', { role: UserRole.ADMIN, siteId: null });
      expect(result.id).toBe('fc-1');
    });

    it('same-site agent can read own site claim', async () => {
      claimRepo.findOne.mockResolvedValue(makeClaim());
      const result = await service.findOne('fc-1', { role: UserRole.AGENT, siteId: SITE_SMG });
      expect(result.id).toBe('fc-1');
    });
  });

  describe('create sets siteId from actor (ignores any dto site)', () => {
    it('stores actor.siteId on the created claim', async () => {
      const actor = { role: UserRole.USER, siteId: SITE_SPJ };
      const dto = {
        locationFound: 'Lobby',
        foundAt: '2026-01-01',
        description: 'USB drive',
      } as any;

      await service.create('u1', dto, actor);

      // claimRepo.create should have been called with siteId from actor
      expect(claimRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: SITE_SPJ }),
      );
    });

    it('site-locked user with null site creates claim with null siteId (will be invisible to all site-locked)', async () => {
      const actor = { role: UserRole.USER, siteId: null };
      const dto = {
        locationFound: 'Hallway',
        foundAt: '2026-01-02',
        description: 'Keys',
      } as any;

      await service.create('u2', dto, actor);

      expect(claimRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: null }),
      );
    });
  });

  describe('match enforces site', () => {
    it('site-locked cannot match claim from other site', async () => {
      claimRepo.findOne.mockResolvedValue(makeClaim()); // SMG
      await expect(
        service.match('fc-1', { lostItemReportId: 'r1' } as any, 'mgr1', { role: UserRole.AGENT, siteId: SITE_SPJ }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cross-site can match claim from any site', async () => {
      claimRepo.findOne.mockResolvedValue(makeClaim());
      claimRepo.update.mockResolvedValue({ affected: 1 });
      // Reload after update
      claimRepo.findOne.mockResolvedValueOnce(makeClaim()); // first for check
      claimRepo.findOne.mockResolvedValueOnce(makeClaim()); // reload

      const result = await service.match('fc-1', { lostItemReportId: 'r1' } as any, 'mgr1', { role: UserRole.MANAGER, siteId: null });
      expect(result.id).toBe('fc-1');
    });
  });

  describe('reject enforces site', () => {
    it('site-locked cannot reject claim from other site', async () => {
      claimRepo.findOne.mockResolvedValue(makeClaim());
      await expect(
        service.reject('fc-1', { notes: 'no' } as any, 'mgr1', { role: UserRole.AGENT, siteId: SITE_SPJ }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('confirmReturn enforces site', () => {
    it('site-locked cannot confirm return on other site claim', async () => {
      // findOne inside confirmReturn will call repo.findOne
      claimRepo.findOne.mockResolvedValue(makeClaim()); // SMG
      await expect(
        service.confirmReturn('fc-1', 'mgr1', { role: UserRole.AGENT, siteId: SITE_SPJ }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('same site manager can confirm return', async () => {
      const claim = makeClaim({ status: FoundClaimStatus.MATCHED });
      claimRepo.findOne.mockResolvedValue(claim);
      claimRepo.save.mockResolvedValue(claim);

      const result = await service.confirmReturn('fc-1', 'mgr1', { role: UserRole.MANAGER, siteId: SITE_SMG });
      expect(result.id).toBe('fc-1');
    });
  });

  describe('cross-site smoke: create at site A is invisible to site B agent via list', () => {
    it('agent at SPJ does not see SMG claim', async () => {
      // Simulate list behavior: qb will be filtered
      const qb = setupQb([]);
      await service.findAll({ role: UserRole.AGENT, siteId: SITE_SPJ });

      // The query should pin to SPJ, so a claim with siteId SMG would not be returned
      expect(qb.andWhere).toHaveBeenCalledWith('c.siteId = :userSiteId', { userSiteId: SITE_SPJ });
    });
  });
});
