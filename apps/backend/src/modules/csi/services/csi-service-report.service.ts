import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { IsNull, Not, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPeriodPublishStatus } from '../csi.constants';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiHcRecap } from '../org/csi-hc-report.calc';
import { addHcRecapSheets } from '../org/csi-hc-report.render';
import { buildServiceReport, CsiPendingDepartment } from '../org/csi-service-report.calc';
import { addStyledSheet } from './csi-export.sheet';
import { CsiReportAccessService } from './csi-report-access.service';
import { CsiHcPeriodRef, CsiReportService } from './csi-report.service';

const PENDING_SHEET = 'Belum menilai per departemen';

export type CsiServiceReport = CsiHcRecap & { period: CsiHcPeriodRef; serviceCode: string; pending: CsiPendingDepartment[] | null };

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
    ) { }

    async listPeriods(userId: string, scope: ServiceScope) {
        const { services } = await this.access.servicesFor(userId, scope);
        if (!services.length) return { services, periods: [] };
        const rows = await this.periods.find({
            where: { scope, publishStatus: Not(CsiPeriodPublishStatus.DRAFT), cancelledAt: IsNull() }, order: { startDate: 'DESC' },
            select: { id: true, title: true, startDate: true, endDate: true },
        });
        return { services, periods: rows.map((row) => ({ id: row.id, title: row.title, startDate: row.startDate, endDate: row.endDate })) };
    }

    async get(userId: string, periodId: string, serviceCode: string, scope: ServiceScope): Promise<CsiServiceReport> {
        const code = serviceCode.toUpperCase();
        const { admin } = await this.access.assertService(userId, scope, code);
        await this.assertReadable(periodId, admin, scope);
        const input = await this.reports.hcRecapInput(scope, periodId);
        const hiddenRateeIds = new Set(admin ? [] : [...input.userIdOf].filter(([, owner]) => owner === userId).map(([rateeId]) => rateeId));
        const recap = buildServiceReport({ pics: input.pics, ratings: input.ratings, dimensions: input.dimensions, serviceCode: code, hiddenRateeIds, scope });
        const respondents = await this.reports.getRespondents(scope, periodId);
        return { ...recap, period: input.period, serviceCode: code, pending: respondents.pendingByDepartment };
    }

    /** Owners read published, not-cancelled HC surveys only; admins any HC survey (drafts included, as in the admin page). */
    private async assertReadable(periodId: string, admin: boolean, scope: ServiceScope) {
        const period = await this.periods.findOne({ where: { id: periodId } });
        const visible = period && period.scope === scope
            && (admin || (period.publishStatus !== CsiPeriodPublishStatus.DRAFT && !period.cancelledAt));
        if (!visible) throw new NotFoundException('Periode tidak ditemukan');
    }

    async exportWorkbook(userId: string, periodId: string, serviceCode: string, scope: ServiceScope): Promise<{ filename: string; buffer: Buffer }> {
        const report = await this.get(userId, periodId, serviceCode, scope);
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'iDesk CSI';
        addHcRecapSheets(workbook, report, true);
        if (report.pending) {
            addStyledSheet(workbook, PENDING_SHEET, [
                { header: 'Departemen', width: 36 }, { header: 'Belum menilai', width: 14 }, { header: 'Total penilai', width: 14 },
            ], report.pending.map((row) => [row.department, row.pending, row.total]));
        }
        const filename = `csi-${scope.toLowerCase()}-${report.serviceCode}-${report.period.id.slice(0, 8)}.xlsx`;
        return { filename, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    }
}
