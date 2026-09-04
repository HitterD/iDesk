// apps/backend/src/modules/reports/scheduled-reports.site-isolation.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { ScheduledReportsCrudService } from './services/scheduled-reports-crud.service';
import { UserRole } from '../users/enums/user-role.enum';
import { SiteActor } from '../../shared/core/utils/site-scope.util';
import {
  ScheduledReportConfig,
  ReportType,
  ScheduleType,
  TargetAgentCategory,
} from './entities/scheduled-report-config.entity';

const SITE_SPJ = 'site-spj';
const SITE_SMG = 'site-smg';

const SITE_LOCKED_ROLES = [UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ADMIN, UserRole.USER];
const CROSS_SITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

function makeActor(role: UserRole, siteId: string | null): SiteActor {
  return { role, siteId };
}

function makeConfig(overrides: Partial<ScheduledReportConfig> = {}): ScheduledReportConfig {
  return {
    id: 'cfg-1',
    name: 'Test Schedule',
    reportType: ReportType.TICKET_VOLUME,
    schedule: ScheduleType.DAILY,
    sendTime: '08:00',
    siteId: SITE_SPJ,
    recipientUserIds: ['u1'],
    targetAgentCategory: null,
    isActive: true,
    createdById: 'admin-1',
    lastRunAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as ScheduledReportConfig;
}

describe('ScheduledReports site isolation', () => {
  let service: ScheduledReportsCrudService;
  let configRepo: any;
  let executionRepo: any;
  let userRepo: any;
  let dynamicScheduler: any;

  beforeEach(() => {
    configRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x: any) => x),
      create: jest.fn((x: any) => x),
      softRemove: jest.fn(async () => undefined),
    };

    executionRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    userRepo = {
      createQueryBuilder: jest.fn(),
    };

    dynamicScheduler = {
      registerConfig: jest.fn(),
      unregisterJob: jest.fn(),
      triggerNow: jest.fn(),
    };

    service = new ScheduledReportsCrudService(
      configRepo as any,
      executionRepo as any,
      userRepo as any,
      dynamicScheduler as any,
    );
  });

  describe('list', () => {
    function setupQb(result: any[]) {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(result),
      };
      configRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it.each(SITE_LOCKED_ROLES)('pins %s to their own site', async (role) => {
      const qb = setupQb([]);
      await service.list(makeActor(role, SITE_SPJ));

      expect(qb.andWhere).toHaveBeenCalledWith('cfg.siteId = :siteId', { siteId: SITE_SPJ });
    });

    it.each(SITE_LOCKED_ROLES)('matches nothing for %s when actor has no site (fail-closed)', async (role) => {
      const qb = setupQb([]);
      await service.list(makeActor(role, null));

      expect(qb.andWhere).toHaveBeenCalledWith('1 = 0');
    });

    it.each(CROSS_SITE_ROLES)('allows %s to see all when no site requested', async (role) => {
      const qb = setupQb([]);
      await service.list(makeActor(role, null));

      // No forced site pin for cross-site with no explicit site
      const calls = (qb.andWhere as jest.Mock).mock.calls.map((c: any[]) => c[0]);
      expect(calls).not.toContain('cfg.siteId = :siteId');
      expect(calls).not.toContain('1 = 0');
    });

    it.each(CROSS_SITE_ROLES)('cross-site can narrow to a specific site', async (role) => {
      const qb = setupQb([]);
      await service.list(makeActor(role, null), SITE_SMG);

      expect(qb.andWhere).toHaveBeenCalledWith('cfg.siteId = :requested', { requested: SITE_SMG });
    });
  });

  describe('listRecipientCandidates', () => {
    function setupUserQb() {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it.each(SITE_LOCKED_ROLES)('pins %s to their own site and ignores the requested site', async (role) => {
      const qb = setupUserQb();
      await service.listRecipientCandidates(makeActor(role, SITE_SPJ), SITE_SMG);

      expect(qb.andWhere).toHaveBeenCalledWith('user.siteId = :siteId', { siteId: SITE_SPJ });
      const siteCalls = (qb.andWhere as jest.Mock).mock.calls.filter((c: any[]) => c[0] === 'user.siteId = :siteId');
      expect(siteCalls).toHaveLength(1);
    });

    it.each(SITE_LOCKED_ROLES)('rejects %s without a site (fail-closed)', async (role) => {
      setupUserQb();
      await expect(
        service.listRecipientCandidates(makeActor(role, null), SITE_SMG),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it.each(CROSS_SITE_ROLES)('%s must name a site explicitly', async (role) => {
      setupUserQb();
      await expect(
        service.listRecipientCandidates(makeActor(role, null)),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it.each(CROSS_SITE_ROLES)('%s can list recipients for any named site', async (role) => {
      const qb = setupUserQb();
      await service.listRecipientCandidates(makeActor(role, null), SITE_SMG);

      expect(qb.andWhere).toHaveBeenCalledWith('user.siteId = :siteId', { siteId: SITE_SMG });
    });

    it('never offers non-agent roles', async () => {
      const qb = setupUserQb();
      await service.listRecipientCandidates(makeActor(UserRole.ADMIN, null), SITE_SPJ);

      const roleCall = (qb.andWhere as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'user.role IN (:...roles)');
      expect(roleCall).toBeDefined();
      expect(roleCall[1].roles).not.toContain(UserRole.USER);
      expect(roleCall[1].roles).not.toContain(UserRole.ADMIN);
      expect(roleCall[1].roles).toContain(UserRole.AGENT_ORACLE);
    });

    it('only offers active users', async () => {
      const qb = setupUserQb();
      await service.listRecipientCandidates(makeActor(UserRole.ADMIN, null), SITE_SPJ);

      expect(qb.where).toHaveBeenCalledWith('user.isActive = :isActive', { isActive: true });
    });
  });

  describe('findOne / mutations enforce site access', () => {
    it('site-locked cannot read other site config', async () => {
      configRepo.findOne.mockResolvedValue(makeConfig({ siteId: SITE_SMG }));

      await expect(service.findOne(makeActor(UserRole.AGENT, SITE_SPJ), 'cfg-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('same-site actor can read own site config', async () => {
      const cfg = makeConfig({ siteId: SITE_SPJ });
      configRepo.findOne.mockResolvedValue(cfg);

      const result = await service.findOne(makeActor(UserRole.AGENT, SITE_SPJ), 'cfg-1');
      expect(result.siteId).toBe(SITE_SPJ);
    });

    it('cross-site can read any site', async () => {
      const cfg = makeConfig({ siteId: SITE_SMG });
      configRepo.findOne.mockResolvedValue(cfg);

      const result = await service.findOne(makeActor(UserRole.ADMIN, null), 'cfg-1');
      expect(result.siteId).toBe(SITE_SMG);
    });

    it('update is blocked for site-locked on foreign site', async () => {
      configRepo.findOne.mockResolvedValue(makeConfig({ siteId: SITE_SMG }));

      await expect(
        service.update(makeActor(UserRole.AGENT, SITE_SPJ), 'cfg-1', { name: 'x' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('toggle and remove are blocked across sites', async () => {
      configRepo.findOne.mockResolvedValue(makeConfig({ siteId: SITE_SMG }));

      await expect(service.toggle(makeActor(UserRole.AGENT, SITE_SPJ), 'cfg-1', false)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove(makeActor(UserRole.AGENT, SITE_SPJ), 'cfg-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('triggerNow is blocked across sites', async () => {
      configRepo.findOne.mockResolvedValue(makeConfig({ siteId: SITE_SMG }));

      await expect(service.triggerNow(makeActor(UserRole.AGENT, SITE_SPJ), 'cfg-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('create enforces site context', () => {
    it('non-cross-site is forced to their own site', async () => {
      const dto = {
        name: 'Daily SPJ',
        reportType: ReportType.TICKET_VOLUME,
        schedule: ScheduleType.DAILY,
        sendTime: '08:00',
        siteId: SITE_SMG, // should be ignored
        recipientUserIds: ['u1'],
        targetAgentCategory: null as any,
      };

      await service.create(makeActor(UserRole.AGENT, SITE_SPJ), dto as any, 'u1');

      expect(configRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: SITE_SPJ }),
      );
    });

    it('cross-site can create on explicit site', async () => {
      const dto = {
        name: 'Daily SMG',
        reportType: ReportType.TICKET_VOLUME,
        schedule: ScheduleType.DAILY,
        sendTime: '08:00',
        siteId: SITE_SMG,
        recipientUserIds: ['u2'],
        targetAgentCategory: null as any,
      };

      await service.create(makeActor(UserRole.ADMIN, null), dto as any, 'admin-1');

      expect(configRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: SITE_SMG }),
      );
    });

    it('create without effective site throws', async () => {
      const dto = {
        name: 'No Site',
        reportType: ReportType.TICKET_VOLUME,
        schedule: ScheduleType.DAILY,
        sendTime: '08:00',
        recipientUserIds: ['u3'],
        targetAgentCategory: null as any,
      } as any;

      await expect(service.create(makeActor(UserRole.AGENT, null), dto, 'u1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('cross-site smoke: list for site A is invisible to site B agent', () => {
    it('agent at SPJ does not see SMG scheduled reports', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      configRepo.createQueryBuilder.mockReturnValue(qb);

      await service.list(makeActor(UserRole.AGENT, SITE_SPJ));

      expect(qb.andWhere).toHaveBeenCalledWith('cfg.siteId = :siteId', { siteId: SITE_SPJ });
      expect(qb.andWhere).not.toHaveBeenCalledWith('cfg.siteId = :siteId', { siteId: SITE_SMG });
    });
  });
});
