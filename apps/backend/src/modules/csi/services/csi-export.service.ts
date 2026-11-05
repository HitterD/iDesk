import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { defaultSignoff, SignoffLayout } from '../../reports/generators/report-signoff';
import { CsiMemoSetting } from '../entities/csi-memo-setting.entity';
import { renderCsiReportPdf } from './csi-report-pdf';
import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { CsiRateeKind } from '../csi.constants';
import { answerColumns, answerRows, questionsOf } from './csi-export.answers';
import { addMatrixSheet } from './csi-export.matrix';
import { raterMatrix } from './csi-rater-matrix.calc';
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

/** Sign-off of the report PDF: the two signers remembered from the scope's last Interoffice Memo. */
function signoffFrom(setting: CsiMemoSetting | null): SignoffLayout {
    const left = setting?.data?.signerLeft;
    const right = setting?.data?.signerRight;
    const layout = defaultSignoff(left?.name ?? '', right?.name ?? '');
    return { ...layout, slots: [{ ...layout.slots[0], role: left?.title ?? '' }, { ...layout.slots[1], role: right?.title ?? '' }] };
}

@Injectable()
export class CsiExportService {
    constructor(
        private readonly reports: CsiReportService,
        @Optional() @InjectRepository(CsiMemoSetting) private readonly memoSettings?: Repository<CsiMemoSetting>,
    ) { }

    /** Survey report PDF (no respondent names); signers come from the scope's memo settings. */
    async buildPdf(scope: ServiceScope, periodId: string, siteId?: string, now: Date = new Date()): Promise<{ filename: string; buffer: Buffer }> {
        const [report, matrix, setting] = await Promise.all([
            this.reports.getReport(scope, periodId, siteId),
            this.reports.getRaterMatrix(scope, periodId, siteId),
            this.memoSettings ? this.memoSettings.findOne({ where: { scope } }) : Promise.resolve(null),
        ]);
        const buffer = await renderCsiReportPdf({ report, matrix, scopeLabel: scope, signoff: signoffFrom(setting), now });
        return { filename: `laporan-csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}.pdf`, buffer };
    }

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
        addMatrixSheet(workbook, raterMatrix(report.ratees.map((ratee) => ({
            periodRateeId: ratee.periodRateeId, kind: ratee.kind, siteId: ratee.siteId ?? null,
            displayName: ratee.kind === CsiRateeKind.TEAM ? ratee.displayName || report.period.teamLabel : ratee.displayName,
        })), answers));
        return {
            filename: `csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}.xlsx`,
            buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
        };
    }
}
