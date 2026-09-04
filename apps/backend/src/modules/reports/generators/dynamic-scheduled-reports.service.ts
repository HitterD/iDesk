import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import * as ExcelJS from 'exceljs';

import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';

import {
  ScheduledReportConfig,
  ReportType,
  ScheduleType,
  TargetAgentCategory,
} from '../entities/scheduled-report-config.entity';
import {
  ScheduledReportExecution,
  ExecutionStatus,
} from '../entities/scheduled-report-execution.entity';

import { AgentPerformanceReport, DateRange } from './agent-performance.report';
import { TicketVolumeReport } from './ticket-volume.report';
import { ReportsService } from '../reports.service';
import {
  createStyledWorkbook,
  drawCorporateExcelHeader,
  drawExecutiveKpiCards,
  applyHeaderStyle,
  applyRowStyle,
  setupFreezePanes,
  applyAutoFilter,
  autoFitColumns,
  applyFullBorders,
  EXCEL_STYLES,
} from '../utils/excel-styles.util';

export const AGENT_ROLES_REGULAR: UserRole[] = [
  UserRole.AGENT,
  UserRole.AGENT_ADMIN,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
];

export const AGENT_ROLES_ORACLE: UserRole[] = [UserRole.AGENT_ORACLE];

export const ALL_AGENT_ROLES: UserRole[] = [...AGENT_ROLES_REGULAR, ...AGENT_ROLES_ORACLE];

/**
 * DynamicScheduledReportsService
 *
 * Manages per-config cron jobs for scheduled reports.
 * - Registers jobs on startup (active configs)
 * - Registers/unregisters on create/update/toggle/remove
 * - Executes: generate (with site + category filters) → validate recipients → email per agent → log execution
 */
@Injectable()
export class DynamicScheduledReportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamicScheduledReportsService.name);
  private readonly jobNamePrefix = 'scheduled-report-';

  constructor(
    @InjectRepository(ScheduledReportConfig)
    private readonly configRepo: Repository<ScheduledReportConfig>,

    @InjectRepository(ScheduledReportExecution)
    private readonly executionRepo: Repository<ScheduledReportExecution>,

    private readonly schedulerRegistry: SchedulerRegistry,

    private readonly ticketVolumeReport: TicketVolumeReport,
    private readonly agentPerformanceReport: AgentPerformanceReport,
    private readonly reportsService: ReportsService,

    private readonly mailDispatch: MailDispatchService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing dynamic scheduled reports...');
    const activeConfigs = await this.configRepo.find({
      where: { isActive: true, deletedAt: IsNull() },
    });

    for (const cfg of activeConfigs) {
      try {
        this.registerConfig(cfg);
      } catch (err) {
        this.logger.error(`Failed to register config ${cfg.id} on startup: ${err}`);
      }
    }
    this.logger.log(`Registered ${activeConfigs.length} active scheduled report configs`);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down dynamic scheduled reports...');
    const jobs = this.schedulerRegistry.getCronJobs();
    for (const [name] of jobs) {
      if (name.startsWith(this.jobNamePrefix)) {
        try {
          const job = this.schedulerRegistry.getCronJob(name);
          job.stop();
          this.schedulerRegistry.deleteCronJob(name);
        } catch (e) {
          // ignore
        }
      }
    }
  }

  /**
   * Build cron expression from schedule + sendTime (HH:mm)
   */
  private getCronExpression(schedule: ScheduleType, sendTime: string): string {
    const [hourStr, minuteStr] = sendTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (schedule === ScheduleType.DAILY) {
      return `${minute} ${hour} * * *`;
    }
    if (schedule === ScheduleType.WEEKLY) {
      // Monday
      return `${minute} ${hour} * * 1`;
    }
    if (schedule === ScheduleType.MONTHLY) {
      // 1st of month
      return `${minute} ${hour} 1 * *`;
    }
    throw new Error(`Unsupported schedule: ${schedule}`);
  }

  /**
   * Compute the date range that the report should cover for a given schedule.
   * This mirrors the intent of the old hardcoded schedules but is now per-config.
   */
  private computeDateRange(schedule: ScheduleType): DateRange {
    const now = new Date();

    if (schedule === ScheduleType.DAILY) {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }

    if (schedule === ScheduleType.WEEKLY) {
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      return { startDate: start, endDate: end };
    }

    if (schedule === ScheduleType.MONTHLY) {
      // Previous calendar month
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }

    throw new Error(`Unsupported schedule: ${schedule}`);
  }

  /**
   * Register (or replace) a cron job for a config.
   * Called after create or update (when active).
   */
  registerConfig(config: ScheduledReportConfig) {
    const name = `${this.jobNamePrefix}${config.id}`;

    // Remove existing if present (e.g., schedule changed)
    this.unregisterJob(config.id);

    const cronTime = this.getCronExpression(config.schedule, config.sendTime);

    const job = new CronJob(
      cronTime,
      async () => {
        this.logger.log(`Running scheduled report job for config ${config.id} (${config.name})`);
        try {
          await this.runReport(config.id);
        } catch (err) {
          this.logger.error(`Scheduled report ${config.id} failed: ${err}`);
        }
      },
      null, // onComplete
      true, // start
      'Asia/Jakarta', // timezone
    );

    this.schedulerRegistry.addCronJob(name, job as any);
    this.logger.log(`Registered cron job "${name}" with expression "${cronTime}"`);
  }

  /**
   * Unregister a job by config id.
   */
  unregisterJob(configId: string) {
    const name = `${this.jobNamePrefix}${configId}`;
    try {
      if (this.schedulerRegistry.doesExist('cron', name)) {
        const job = this.schedulerRegistry.getCronJob(name);
        job.stop();
        this.schedulerRegistry.deleteCronJob(name);
        this.logger.log(`Unregistered cron job "${name}"`);
      }
    } catch (e) {
      // ignore if not found
    }
  }

  /**
   * Manually trigger a report now (used by controller trigger endpoint).
   */
  async triggerNow(configId: string): Promise<void> {
    await this.runReport(configId);
  }

  /**
   * Core execution logic.
   * Always logs an execution record.
   */
  async runReport(configId: string): Promise<void> {
    const config = await this.configRepo.findOne({ where: { id: configId } });
    if (!config) {
      this.logger.warn(`Config ${configId} not found, skipping run`);
      return;
    }

    if (!config.isActive) {
      this.unregisterJob(configId);
      return;
    }

    const executedAt = new Date();
    let execution: ScheduledReportExecution | null = null;

    try {
      // Compute range
      const dateRange = this.computeDateRange(config.schedule);

      // Generate report buffer + metadata
      const { buffer, filename, subject, body } = await this.generateReportArtifacts(config, dateRange);

      // Load and validate recipients
      const recipientsRaw = config.recipientUserIds?.length
        ? await this.userRepo.findByIds(config.recipientUserIds)
        : [];

      const validRecipients = this.filterValidRecipients(recipientsRaw, config);

      const recipientsCount = recipientsRaw.length;
      let emailsSent = 0;
      const skipped: Array<{ userId: string; reason: string }> = [];

      if (validRecipients.length === 0) {
        this.logger.warn(`No valid recipients for config ${config.id}`);
      } else {
        for (const user of validRecipients) {
          if (!user.email) {
            skipped.push({ userId: user.id, reason: 'no_email' });
            continue;
          }
          try {
            await this.mailDispatch.send({
              to: user.email,
              subject,
              text: body,
              attachments: [
                {
                  filename,
                  content: buffer,
                },
              ],
            });
            emailsSent++;
          } catch (mailErr) {
            skipped.push({ userId: user.id, reason: `send_failed: ${mailErr}` });
          }
        }
      }

      // Determine status
      let status: ExecutionStatus = ExecutionStatus.SUCCESS;
      if (emailsSent === 0 && recipientsCount > 0) {
        status = ExecutionStatus.PARTIAL;
      } else if (emailsSent > 0 && emailsSent < recipientsCount) {
        status = ExecutionStatus.PARTIAL;
      }

      // Save execution
      execution = this.executionRepo.create({
        configId: config.id,
        executedAt,
        status,
        recipientsCount,
        emailsSent,
        errorMessage: skipped.length ? JSON.stringify({ skipped }) : null,
        metadata: {
          dateRange: {
            startDate: dateRange.startDate.toISOString(),
            endDate: dateRange.endDate.toISOString(),
          },
          reportType: config.reportType,
          targetAgentCategory: config.targetAgentCategory,
        },
      });
      await this.executionRepo.save(execution);

      // Update lastRunAt
      config.lastRunAt = executedAt;
      await this.configRepo.save(config);

      this.logger.log(
        `Scheduled report ${config.id} completed: ${emailsSent}/${recipientsCount} emails sent (status=${status})`,
      );
    } catch (err) {
      // Log failure execution
      execution = this.executionRepo.create({
        configId: config.id,
        executedAt,
        status: ExecutionStatus.FAILED,
        recipientsCount: config.recipientUserIds?.length ?? 0,
        emailsSent: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
        metadata: null,
      });
      await this.executionRepo.save(execution);

      this.logger.error(`Scheduled report ${config.id} failed: ${err}`);
      // Do not throw — we want the job to continue on next run
    }
  }

  /**
   * Filter users to only those who should receive this report.
   */
  private filterValidRecipients(users: User[], config: ScheduledReportConfig): User[] {
    return users.filter((u) => {
      if (!u.isActive) return false;
      if (u.siteId !== config.siteId) return false;

      const isAgentRole = (ALL_AGENT_ROLES as string[]).includes(u.role as string);
      if (!isAgentRole) return false;

      if (config.reportType === ReportType.AGENT_PERFORMANCE && config.targetAgentCategory) {
        if (config.targetAgentCategory === TargetAgentCategory.REGULAR) {
          return (AGENT_ROLES_REGULAR as string[]).includes(u.role as string);
        }
        if (config.targetAgentCategory === TargetAgentCategory.ORACLE) {
          return u.role === UserRole.AGENT_ORACLE;
        }
        // ALL → any agent role
      }

      return true;
    });
  }

  /**
   * Generate the Excel buffer and email metadata for a config + date range.
   */
  private async generateReportArtifacts(
    config: ScheduledReportConfig,
    dateRange: DateRange,
  ): Promise<{ buffer: Buffer; filename: string; subject: string; body: string }> {
    const periodLabel = `${dateRange.startDate.toLocaleDateString('id-ID')} - ${dateRange.endDate.toLocaleDateString('id-ID')}`;

    if (config.reportType === ReportType.TICKET_VOLUME) {
      const volume = await this.ticketVolumeReport.generate(dateRange, { siteId: config.siteId });
      const buffer = await this.buildVolumeExcel(volume.data, dateRange);
      const filename = `ticket-volume-${config.siteId}-${Date.now()}.xlsx`;
      return {
        buffer,
        filename,
        subject: `Laporan Volume Tiket - ${periodLabel}`,
        body: `Terlampir laporan volume tiket untuk periode ${periodLabel} (site: ${config.siteId}).`,
      };
    }

    if (config.reportType === ReportType.AGENT_PERFORMANCE) {
      const category = (config.targetAgentCategory as any) || 'ALL';
      const perf = await this.agentPerformanceReport.generate(dateRange, {
        siteId: config.siteId,
        agentCategory: category === 'ALL' ? undefined : category,
      });
      const buffer = await this.buildPerformanceExcel(perf.data, dateRange);
      const filename = `agent-performance-${config.siteId}-${Date.now()}.xlsx`;
      return {
        buffer,
        filename,
        subject: `Laporan Performa Agent - ${periodLabel}`,
        body: `Terlampir laporan performa agent untuk periode ${periodLabel} (site: ${config.siteId}).`,
      };
    }

    // MONTHLY_SUMMARY → combined volume + performance (for the computed range)
    const [volume, perf] = await Promise.all([
      this.ticketVolumeReport.generate(dateRange, { siteId: config.siteId }),
      this.agentPerformanceReport.generate(dateRange, {
        siteId: config.siteId,
        agentCategory: config.targetAgentCategory === TargetAgentCategory.REGULAR
          ? 'REGULAR'
          : config.targetAgentCategory === TargetAgentCategory.ORACLE
          ? 'ORACLE'
          : undefined,
      }),
    ]);

    const buffer = await this.buildCombinedExcel(volume.data, perf.data, dateRange);
    const filename = `monthly-summary-${config.siteId}-${Date.now()}.xlsx`;
    return {
      buffer,
      filename,
      subject: `Laporan Ringkasan Bulanan - ${periodLabel}`,
      body: `Terlampir laporan ringkasan (volume + performa) untuk periode ${periodLabel} (site: ${config.siteId}).`,
    };
  }

  // ---------- Excel builders (in-memory) ----------

  private async buildVolumeExcel(data: any, dateRange: DateRange): Promise<Buffer> {
    const wb = createStyledWorkbook();
    const periodStr = `${dateRange.startDate.toLocaleDateString('id-ID')} - ${dateRange.endDate.toLocaleDateString('id-ID')}`;

    // Sheet 1: Summary
    const summary = wb.addWorksheet('Summary');
    let curRow = drawCorporateExcelHeader(summary, 'LAPORAN VOLUME TIKET TERJADWAL', periodStr, 'Otomatis via Scheduled Report', 'D');

    curRow = drawExecutiveKpiCards(
      summary,
      curRow,
      [
        { label: 'Total Tiket Masuk', value: (data.summary.totalCreated ?? 0).toLocaleString('id-ID'), subtext: `Rata-rata ${data.summary.avgPerDay ?? 0} tiket/hari` },
        { label: 'Total Tiket Selesai', value: (data.summary.totalResolved ?? 0).toLocaleString('id-ID'), subtext: `Peak: ${data.summary.peakCount ?? 0} (${data.summary.peakDay ?? '-'})` },
        { label: 'Tiket Pending/Open', value: (data.summary.totalPending ?? 0).toLocaleString('id-ID'), subtext: 'Memerlukan tindak lanjut' },
      ],
      [['A', 'B'], ['C', 'D'], ['E', 'F']]
    );

    summary.mergeCells(`A${curRow}:D${curRow}`);
    const secHead = summary.getCell(`A${curRow}`);
    secHead.value = 'DETAIL METRIK VOLUME TIKET';
    Object.assign(secHead, { style: EXCEL_STYLES.sectionHeader });
    summary.getRow(curRow).height = 22;
    curRow++;

    const metricHeaderRow = curRow;
    summary.getRow(metricHeaderRow).values = ['Parameter Metrik', 'Nilai'];
    summary.mergeCells(`B${metricHeaderRow}:D${metricHeaderRow}`);
    applyHeaderStyle(summary.getRow(metricHeaderRow));
    curRow++;

    const metricRows = [
      ['Periode Laporan', periodStr],
      ['Total Tiket Masuk (Created)', data.summary.totalCreated ?? 0],
      ['Total Tiket Diselesaikan (Resolved)', data.summary.totalResolved ?? 0],
      ['Total Tiket Masih Tertunda (Pending)', data.summary.totalPending ?? 0],
      ['Rata-rata Tiket Per Hari', data.summary.avgPerDay ?? 0],
      ['Hari dengan Volume Puncak', data.summary.peakDay ?? '-'],
      ['Jumlah Tiket pada Volume Puncak', data.summary.peakCount ?? 0],
    ];

    metricRows.forEach((r, idx) => {
      const row = summary.getRow(curRow);
      row.values = [r[0], r[1]];
      summary.mergeCells(`B${curRow}:D${curRow}`);
      applyRowStyle(row, idx);
      curRow++;
    });

    applyFullBorders(summary, metricHeaderRow, curRow - 1, 4);
    summary.columns = [{ width: 32 }, { width: 18 }, { width: 18 }, { width: 18 }];

    // Sheet 2: Daily Volume
    const daily = wb.addWorksheet('Daily Volume');
    const dHead = daily.addRow(['Tanggal', 'Tiket Masuk (Created)', 'Tiket Selesai (Resolved)', 'Tiket Pending']);
    applyHeaderStyle(dHead);
    setupFreezePanes(daily, 1);

    (data.daily || []).forEach((d: any, idx: number) => {
      const row = daily.addRow([d.date, d.created, d.resolved, d.pending]);
      applyRowStyle(row, idx);
    });

    if (data.daily && data.daily.length > 0) {
      applyAutoFilter(daily, 'A', 1, 'D', 1 + data.daily.length);
      applyFullBorders(daily, 1, 1 + data.daily.length, 4);
    }
    autoFitColumns(daily, 16, 28);

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private async buildPerformanceExcel(data: any[], dateRange: DateRange): Promise<Buffer> {
    const wb = createStyledWorkbook();
    const periodStr = `${dateRange.startDate.toLocaleDateString('id-ID')} - ${dateRange.endDate.toLocaleDateString('id-ID')}`;

    const sheet = wb.addWorksheet('Agent Performance');
    let curRow = drawCorporateExcelHeader(sheet, 'LAPORAN KINERJA TEKNISI / AGENT TERJADWAL', periodStr, 'Otomatis via Scheduled Report', 'G');

    const totalAssigned = data.reduce((sum, a) => sum + (a.totalAssigned || 0), 0);
    const totalResolved = data.reduce((sum, a) => sum + (a.totalResolved || 0), 0);
    const avgSla = data.length > 0 ? Math.round(data.reduce((sum, a) => sum + (a.slaComplianceRate || 0), 0) / data.length) : 0;

    curRow = drawExecutiveKpiCards(
      sheet,
      curRow,
      [
        { label: 'Total Ditugaskan', value: totalAssigned.toLocaleString('id-ID'), subtext: `${data.length} Teknisi Terdaftar` },
        { label: 'Total Selesai', value: totalResolved.toLocaleString('id-ID'), subtext: totalAssigned > 0 ? `${((totalResolved / totalAssigned) * 100).toFixed(1)}% Resolusi` : '0%' },
        { label: 'Rata-rata SLA', value: `${avgSla}%`, subtext: 'Kepatuhan SLA gabungan' },
      ],
      [['A', 'B'], ['C', 'D'], ['E', 'G']]
    );

    const tableHeadRow = curRow;
    const header = sheet.getRow(tableHeadRow);
    header.values = ['Nama Teknisi', 'Ditugaskan', 'Selesai', 'Tingkat Resolusi (%)', 'Avg Respon (Menit)', 'Avg Resolusi (Menit)', 'Kepatuhan SLA (%)'];
    applyHeaderStyle(header);
    setupFreezePanes(sheet, tableHeadRow);
    curRow++;

    data.forEach((row, idx) => {
      const r = sheet.getRow(curRow);
      r.values = [
        row.agentName,
        row.totalAssigned,
        row.totalResolved,
        `${row.resolutionRate}%`,
        `${row.avgResponseTimeMinutes} m`,
        `${row.avgResolutionTimeMinutes} m`,
        `${row.slaComplianceRate}%`,
      ];
      applyRowStyle(r, idx);
      curRow++;
    });

    if (data.length > 0) {
      applyAutoFilter(sheet, 'A', tableHeadRow, 'G', curRow - 1);
      applyFullBorders(sheet, tableHeadRow, curRow - 1, 7);
    }
    autoFitColumns(sheet, 16, 32);

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private async buildCombinedExcel(volumeData: any, perfData: any[], dateRange: DateRange): Promise<Buffer> {
    const wb = createStyledWorkbook();
    const periodStr = `${dateRange.startDate.toLocaleDateString('id-ID')} - ${dateRange.endDate.toLocaleDateString('id-ID')}`;

    // Sheet 1: Executive Dashboard / Volume Summary
    const vol = wb.addWorksheet('Executive Summary');
    let curRow = drawCorporateExcelHeader(vol, 'RINGKASAN EKSEKUTIF & VOLUME TIKET TERJADWAL', periodStr, 'Otomatis via Scheduled Report', 'E');

    const totalCreated = volumeData.summary?.totalCreated ?? 0;
    const totalResolved = volumeData.summary?.totalResolved ?? 0;
    const totalPending = volumeData.summary?.totalPending ?? 0;

    curRow = drawExecutiveKpiCards(
      vol,
      curRow,
      [
        { label: 'Total Tiket Masuk', value: totalCreated.toLocaleString('id-ID'), subtext: `Rata-rata ${volumeData.summary?.avgPerDay ?? 0} tiket/hari` },
        { label: 'Total Selesai', value: totalResolved.toLocaleString('id-ID'), subtext: totalCreated > 0 ? `${((totalResolved / totalCreated) * 100).toFixed(1)}% Resolusi` : '0%' },
        { label: 'Tiket Pending', value: totalPending.toLocaleString('id-ID'), subtext: 'Memerlukan tindak lanjut' },
      ],
      [['A', 'B'], ['C', 'D'], ['E', 'E']]
    );

    const mHead = vol.getCell(`A${curRow}`);
    vol.mergeCells(`A${curRow}:E${curRow}`);
    mHead.value = 'RINGKASAN METRIK OPERASIONAL';
    Object.assign(mHead, { style: EXCEL_STYLES.sectionHeader });
    vol.getRow(curRow).height = 22;
    curRow++;

    const metricHeaderRow = curRow;
    vol.getRow(metricHeaderRow).values = ['Parameter Metrik', 'Nilai Realisasi'];
    vol.mergeCells(`B${metricHeaderRow}:E${metricHeaderRow}`);
    applyHeaderStyle(vol.getRow(metricHeaderRow));
    curRow++;

    const rows = [
      ['Periode Laporan', periodStr],
      ['Total Tiket Terdaftar', totalCreated],
      ['Tiket Diselesaikan', totalResolved],
      ['Tiket Masih Pending', totalPending],
      ['Rata-rata Tiket Per Hari', volumeData.summary?.avgPerDay ?? 0],
    ];

    rows.forEach((r, idx) => {
      const row = vol.getRow(curRow);
      row.values = [r[0], r[1]];
      vol.mergeCells(`B${curRow}:E${curRow}`);
      applyRowStyle(row, idx);
      curRow++;
    });

    applyFullBorders(vol, metricHeaderRow, curRow - 1, 5);
    vol.columns = [{ width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

    // Sheet 2: Agent Performance
    const agents = wb.addWorksheet('Agent Performance');
    const aHead = agents.addRow(['Nama Teknisi', 'Ditugaskan', 'Selesai', 'Tingkat Resolusi (%)', 'Avg Respon (Menit)', 'Kepatuhan SLA (%)']);
    applyHeaderStyle(aHead);
    setupFreezePanes(agents, 1);

    perfData.forEach((a, idx) => {
      const row = agents.addRow([
        a.agentName,
        a.totalAssigned,
        a.totalResolved,
        `${a.resolutionRate}%`,
        `${a.avgResponseTimeMinutes} m`,
        `${a.slaComplianceRate}%`,
      ]);
      applyRowStyle(row, idx);
    });

    if (perfData.length > 0) {
      applyAutoFilter(agents, 'A', 1, 'F', 1 + perfData.length);
      applyFullBorders(agents, 1, 1 + perfData.length, 6);
    }
    autoFitColumns(agents, 16, 30);

    // Sheet 3: Daily Volume
    const daily = wb.addWorksheet('Daily Volume');
    const dHead = daily.addRow(['Tanggal', 'Tiket Masuk (Created)', 'Tiket Selesai (Resolved)', 'Tiket Pending']);
    applyHeaderStyle(dHead);
    setupFreezePanes(daily, 1);

    (volumeData.daily || []).forEach((d: any, idx: number) => {
      const row = daily.addRow([d.date, d.created, d.resolved, d.pending]);
      applyRowStyle(row, idx);
    });

    if (volumeData.daily && volumeData.daily.length > 0) {
      applyAutoFilter(daily, 'A', 1, 'D', 1 + volumeData.daily.length);
      applyFullBorders(daily, 1, 1 + volumeData.daily.length, 4);
    }
    autoFitColumns(daily, 16, 28);

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
