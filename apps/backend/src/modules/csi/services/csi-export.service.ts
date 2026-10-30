import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { CsiRateeKind } from '../csi.constants';
import { answerColumns, answerRows, questionsOf } from './csi-export.answers';
import { addStyledSheet, AVERAGE_COLUMN, PERCENT_COLUMN, sanitizeCell, WIDTH } from './csi-export.sheet';
import { formatLocation } from './csi-format.util';
import { CsiReportService } from './csi-report.service';

export { sanitizeCell } from './csi-export.sheet';

type Report = Awaited<ReturnType<CsiReportService['getReport']>>;
const SHEET_RECAP = 'Rekap';
const SHEET_TEAM = 'Penilaian Tim';
const SHEET_PERSON = 'Penilaian Per Orang';

/** Rekap: Lokasi, Nama (team label or person), Average per ratee, Average survei, % Pengisi (SLA). */
function addRecap(workbook: ExcelJS.Workbook, report: Report) {
    const location = sanitizeCell(formatLocation(report.period.sites));
    const rows = report.ratees.map((ratee) => [
        location,
        sanitizeCell(ratee.kind === CsiRateeKind.TEAM ? report.period.teamLabel : ratee.displayName),
        ratee.average, report.overall.average, report.sla.pengisiPct,
    ]);
    addStyledSheet(workbook, SHEET_RECAP, [
        { header: 'Lokasi', width: WIDTH.name }, { header: 'Nama', width: WIDTH.name },
        AVERAGE_COLUMN('Average'), AVERAGE_COLUMN('Average survei'), PERCENT_COLUMN('% Pengisi (SLA)'),
    ], rows);
}

@Injectable()
export class CsiExportService {
    constructor(private readonly reports: CsiReportService) { }

    async buildWorkbook(scope: ServiceScope, periodId: string, now: Date = new Date()): Promise<{ filename: string; buffer: Buffer }> {
        const [report, answers] = await Promise.all([
            this.reports.getReport(scope, periodId),
            this.reports.listAnswers(scope, periodId),
        ]);
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'iDesk CSI';
        workbook.created = now;
        workbook.title = sanitizeCell(report.period.title);

        addRecap(workbook, report);
        const kinds: Array<[CsiRateeKind, string]> = [[CsiRateeKind.TEAM, SHEET_TEAM], [CsiRateeKind.PERSON, SHEET_PERSON]];
        for (const [kind, sheetName] of kinds) {
            if (!report.ratees.some((ratee) => ratee.kind === kind)) continue;
            const questions = questionsOf(report.ratees, kind);
            addStyledSheet(workbook, sheetName, answerColumns(questions, kind === CsiRateeKind.PERSON), answerRows(answers, kind, questions));
        }
        return {
            filename: `csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}.xlsx`,
            buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
        };
    }
}
