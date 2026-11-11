import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CSI_SIMULATION_BANNER, CsiPeriodPublishStatus, isSimulation } from '../csi.constants';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiHcRecap } from '../org/csi-hc-report.calc';
import { addHcAnswersRawSheet, addHcNestedSheet, addHcRespondentSheet, addHcServiceSheet, HcSheetContext } from '../org/csi-hc-report.render';
import { buildServiceReport, CsiPendingDepartment, mergeSmallDepartments } from '../org/csi-service-report.calc';
import { addTable, sectionRow, startReportSheet, XlColumn } from './csi-excel-style';
import { surveyLineOf } from './csi-export.executive';
import { newCsiWorkbook, RAW_FILENAME_SUFFIX } from './csi-export.service';
import { sanitizeCell } from './csi-export.sheet';
import { CsiReportAccessService } from './csi-report-access.service';
import { CsiHcPeriodRef, CsiReportService } from './csi-report.service';
import { CsiScoreBands } from './csi-score-bands';

/** Main service workbook (anonymous; numbered like the admin report) and the owner's raw-data file. */
export const SERVICE_SHEETS = ['1 Per layanan', '2 Layanan-bagian-PIC', '3 Rekap responden', '4 Belum menilai'] as const;
const PENDING_COLUMNS: XlColumn[] = [{ header: 'Departemen' }, { header: 'Belum menilai', kind: 'count' }, { header: 'Total penilai', kind: 'count' }];

export type CsiServiceReport = CsiHcRecap & {
    period: CsiHcPeriodRef; scoreBands: CsiScoreBands; serviceCode: string; pending: CsiPendingDepartment[] | null;
};

/**
 * Report of one service (HC layanan or ICT team) for its report owners (and scope admins), every location. Ratings
 * about the viewer's own rows are anonymous; who has not answered yet is shown per department only.
 */
@Injectable()
export class CsiServiceReportService {
    constructor(
        private readonly access: CsiReportAccessService,
        private readonly reports: CsiReportService,
        @InjectRepository(CsiPeriod) private readonly periods: Repository<CsiPeriod>,
        @InjectRepository(CsiPeriodRatee) private readonly ratees: Repository<CsiPeriodRatee>,
    ) { }

    async listPeriods(userId: string, scope: ServiceScope) {
        const { services } = await this.access.servicesFor(userId, scope);
        if (!services.length) return { services, periods: [] };
        const rows = await this.periods.find({
            where: { scope, publishStatus: Not(CsiPeriodPublishStatus.DRAFT), cancelledAt: IsNull() }, order: { startDate: 'DESC' },
            select: { id: true, title: true, startDate: true, endDate: true },
        });
        const withServices = await this.periodsWithServices(rows.map((row) => row.id));
        return {
            services,
            periods: rows.filter((row) => withServices.has(row.id)).map((row) => ({ id: row.id, title: row.title, startDate: row.startDate, endDate: row.endDate })),
        };
    }

    /** Surveys where somebody is rated under a layanan (older ICT surveys have none, so their report would be empty). */
    private async periodsWithServices(periodIds: string[]): Promise<Set<string>> {
        if (!periodIds.length) return new Set();
        const rows = await this.ratees.find({ where: { periodId: In(periodIds), serviceCode: Not(IsNull()) }, select: { periodId: true } });
        return new Set(rows.map((row) => row.periodId));
    }

    async get(userId: string, periodId: string, serviceCode: string, scope: ServiceScope): Promise<CsiServiceReport> {
        const code = serviceCode.toUpperCase();
        const { admin } = await this.access.assertService(userId, scope, code);
        await this.assertReadable(periodId, admin, scope);
        const input = await this.reports.hcRecapInput(scope, periodId);
        const hiddenRateeIds = new Set(admin ? [] : [...input.ownersOf].filter(([, owners]) => owners.includes(userId)).map(([rateeId]) => rateeId));
        const recap = buildServiceReport({ pics: input.pics, ratings: input.ratings, dimensions: input.dimensions, serviceCode: code, hiddenRateeIds, scope });
        const respondents = await this.reports.getRespondents(scope, periodId);
        return { ...recap, period: input.period, scoreBands: input.scoreBands, serviceCode: code,
            pending: respondents.pendingByDepartment ? mergeSmallDepartments(respondents.pendingByDepartment) : null };
    }

    /** Owners read published, not-cancelled HC surveys only; admins any HC survey (drafts included, as in the admin page). */
    private async assertReadable(periodId: string, admin: boolean, scope: ServiceScope) {
        const period = await this.periods.findOne({ where: { id: periodId } });
        const visible = period && period.scope === scope
            && (admin || (period.publishStatus !== CsiPeriodPublishStatus.DRAFT && !period.cancelledAt));
        if (!visible) throw new NotFoundException('Periode tidak ditemukan');
    }

    /** Main service workbook: anonymous recap sheets (no rater names) and who has not answered per department (merged < 3). */
    async exportWorkbook(userId: string, periodId: string, serviceCode: string, scope: ServiceScope): Promise<{ filename: string; buffer: Buffer }> {
        const report = await this.get(userId, periodId, serviceCode, scope);
        const context = this.sheetContext(report);
        const workbook = newCsiWorkbook(report.period.title, new Date());
        addHcServiceSheet(workbook, SERVICE_SHEETS[0], context);
        addHcNestedSheet(workbook, SERVICE_SHEETS[1], context);
        addHcRespondentSheet(workbook, SERVICE_SHEETS[2], context);
        if (report.pending) {
            const { sheet, row } = startReportSheet(workbook, {
                name: SERVICE_SHEETS[3], tab: 'participation', title: 'Belum menilai per departemen', subtitle: context.surveyLine,
                simulation: context.simulation, span: PENDING_COLUMNS.length,
            });
            addTable(sheet, PENDING_COLUMNS, report.pending.map((pending) => [sanitizeCell(pending.department), pending.pending, pending.total]), {
                headerRow: sectionRow(sheet, row, 'Tanpa nama; departemen dengan kurang dari 3 penilai digabung', PENDING_COLUMNS.length),
                freeze: true, emptyText: 'Semua penilai sudah mengisi.',
            });
        }
        return { filename: `${this.baseName(report, scope)}.xlsx`, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    }

    /**
     * Raw data of the owner's own service: every rating with the rater's name, except the ratings about the owner
     * themself, which stay "Anonim" exactly as on the screen (same report as `get`).
     */
    async exportRawWorkbook(userId: string, periodId: string, serviceCode: string, scope: ServiceScope): Promise<{ filename: string; buffer: Buffer }> {
        const report = await this.get(userId, periodId, serviceCode, scope);
        const workbook = newCsiWorkbook(`${report.period.title}${RAW_FILENAME_SUFFIX}`, new Date());
        const { surveyLine: line, simulation } = this.sheetContext(report);
        addHcAnswersRawSheet(workbook, report, { line, simulation }, report.scoreBands);
        return { filename: `${this.baseName(report, scope)}${RAW_FILENAME_SUFFIX}.xlsx`, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    }

    private sheetContext(report: CsiServiceReport): HcSheetContext {
        const { period } = report;
        return {
            recap: report, bands: report.scoreBands, hasPrevious: false,
            surveyLine: surveyLineOf({ title: period.title, startDate: period.startDate, endDate: period.endDate, siteLabel: `Layanan ${report.serviceCode}` }),
            simulation: isSimulation(period) ? CSI_SIMULATION_BANNER : null,
        };
    }

    private baseName(report: CsiServiceReport, scope: ServiceScope) {
        return `csi-${scope.toLowerCase()}-${report.serviceCode}-${report.period.id.slice(0, 8)}`;
    }
}
