// apps/backend/src/modules/reports/dynamic-scheduled-reports.execution.spec.ts
import { SchedulerRegistry } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { DynamicScheduledReportsService } from './generators/dynamic-scheduled-reports.service';
import { MailDispatchService } from '../../shared/mail/mail-dispatch.service';
import {
  ScheduledReportConfig,
  ReportType,
  ScheduleType,
  TargetAgentCategory,
} from './entities/scheduled-report-config.entity';
import { ScheduledReportExecution, ExecutionStatus } from './entities/scheduled-report-execution.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { AgentPerformanceReport } from './generators/agent-performance.report';
import { TicketVolumeReport } from './generators/ticket-volume.report';
import { ReportsService } from './reports.service';

const SITE_SPJ = 'site-spj';

function makeConfig(overrides: Partial<ScheduledReportConfig> = {}): ScheduledReportConfig {
  return {
    id: 'cfg-1',
    name: 'Daily Volume SPJ',
    reportType: ReportType.TICKET_VOLUME,
    schedule: ScheduleType.DAILY,
    sendTime: '08:00',
    siteId: SITE_SPJ,
    recipientUserIds: ['u1', 'u2'],
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

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    email: `${id}@example.com`,
    fullName: `User ${id}`,
    role: UserRole.AGENT,
    siteId: SITE_SPJ,
    isActive: true,
    ...overrides,
  } as User;
}

describe('DynamicScheduledReportsService execution', () => {
  let service: DynamicScheduledReportsService;

  let configRepo: jest.Mocked<Repository<ScheduledReportConfig>>;
  let executionRepo: jest.Mocked<Repository<ScheduledReportExecution>>;
  let schedulerRegistry: jest.Mocked<SchedulerRegistry>;
  let ticketVolumeReport: jest.Mocked<TicketVolumeReport>;
  let agentPerformanceReport: jest.Mocked<AgentPerformanceReport>;
  let reportsService: jest.Mocked<ReportsService>;
  let mailDispatch: jest.Mocked<MailDispatchService>;
  let userRepo: jest.Mocked<Repository<User>>;

  beforeEach(() => {
    configRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x: any) => x),
      create: jest.fn((x: any) => x),
    } as any;

    executionRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
      find: jest.fn(),
    } as any;

    schedulerRegistry = {
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
      getCronJob: jest.fn(),
      getCronJobs: jest.fn().mockReturnValue(new Map()),
    } as any;

    ticketVolumeReport = {
      generate: jest.fn().mockResolvedValue({
        data: {
          daily: [],
          summary: { totalCreated: 0, totalResolved: 0, totalPending: 0, avgPerDay: 0, peakDay: '', peakCount: 0 },
        },
      }),
    } as any;

    agentPerformanceReport = {
      generate: jest.fn().mockResolvedValue({ data: [] }),
    } as any;

    reportsService = {} as any;

    mailDispatch = {
      send: jest.fn().mockResolvedValue(undefined),
    } as any;

    userRepo = {
      findByIds: jest.fn(),
      find: jest.fn(),
    } as any;

    service = new DynamicScheduledReportsService(
      configRepo as any,
      executionRepo as any,
      schedulerRegistry as any,
      ticketVolumeReport as any,
      agentPerformanceReport as any,
      reportsService as any,
      mailDispatch as any,
      userRepo as any,
    );
  });

  it('calls generators with siteId and sends to valid same-site agent recipients', async () => {
    const cfg = makeConfig({
      reportType: ReportType.TICKET_VOLUME,
      recipientUserIds: ['u1', 'u2'],
    });

    configRepo.findOne.mockResolvedValue(cfg);

    const u1 = makeUser('u1', { role: UserRole.AGENT, siteId: SITE_SPJ, email: 'u1@ex.com' });
    const u2 = makeUser('u2', { role: UserRole.AGENT, siteId: SITE_SPJ, email: 'u2@ex.com' });
    userRepo.findByIds.mockResolvedValue([u1, u2]);

    await service.runReport('cfg-1');

    // Generator called with site filter
    expect(ticketVolumeReport.generate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ siteId: SITE_SPJ }),
    );

    // Mail sent to both
    expect(mailDispatch.send).toHaveBeenCalledTimes(2);
    expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'u1@ex.com' }));
    expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'u2@ex.com' }));

    // Execution logged as SUCCESS
    expect(executionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ExecutionStatus.SUCCESS,
        recipientsCount: 2,
        emailsSent: 2,
      }),
    );
  });

  it('filters out cross-site recipients (only same site allowed)', async () => {
    const cfg = makeConfig({ recipientUserIds: ['u1', 'u3'] });
    configRepo.findOne.mockResolvedValue(cfg);

    const u1 = makeUser('u1', { role: UserRole.AGENT, siteId: SITE_SPJ, email: 'u1@ex.com' });
    const u3 = makeUser('u3', { role: UserRole.AGENT, siteId: 'site-smg', email: 'u3@ex.com' }); // different site
    userRepo.findByIds.mockResolvedValue([u1, u3]);

    await service.runReport('cfg-1');

    // Only u1 should receive
    expect(mailDispatch.send).toHaveBeenCalledTimes(1);
    expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'u1@ex.com' }));

    // recipientsCount reflects the raw list size; emailsSent reflects actual sends
    expect(executionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientsCount: 2,
        emailsSent: 1,
      }),
    );
  });

  it('separates REGULAR vs ORACLE for AGENT_PERFORMANCE configs', async () => {
    const cfg = makeConfig({
      reportType: ReportType.AGENT_PERFORMANCE,
      targetAgentCategory: TargetAgentCategory.REGULAR,
      recipientUserIds: ['u-reg', 'u-oracle'],
    });
    configRepo.findOne.mockResolvedValue(cfg);

    const reg = makeUser('u-reg', { role: UserRole.AGENT, siteId: SITE_SPJ, email: 'reg@ex.com' });
    const oracle = makeUser('u-oracle', { role: UserRole.AGENT_ORACLE, siteId: SITE_SPJ, email: 'oracle@ex.com' });
    userRepo.findByIds.mockResolvedValue([reg, oracle]);

    await service.runReport('cfg-1');

    // Generator called with REGULAR category
    expect(agentPerformanceReport.generate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ siteId: SITE_SPJ, agentCategory: 'REGULAR' }),
    );

    // Only regular should receive
    expect(mailDispatch.send).toHaveBeenCalledTimes(1);
    expect(mailDispatch.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'reg@ex.com' }));
  });

  it('always logs an execution even on failure', async () => {
    const cfg = makeConfig();
    configRepo.findOne.mockResolvedValue(cfg);

    // Force generator failure
    (ticketVolumeReport.generate as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    userRepo.findByIds.mockResolvedValue([]);

    await service.runReport('cfg-1');

    expect(executionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ExecutionStatus.FAILED,
        errorMessage: 'boom',
      }),
    );
  });

  it('unregisters job and skips when config is inactive', async () => {
    const cfg = makeConfig({ isActive: false });
    configRepo.findOne.mockResolvedValue(cfg);

    const unregisterSpy = jest.spyOn(service as any, 'unregisterJob');

    await service.runReport('cfg-1');

    expect(unregisterSpy).toHaveBeenCalledWith('cfg-1');
    expect(ticketVolumeReport.generate).not.toHaveBeenCalled();
    expect(executionRepo.save).not.toHaveBeenCalled();
  });
});
