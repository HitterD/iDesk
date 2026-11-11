import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { defaultSignoff, parseSignoffParam, SignoffLayout } from '../../reports/generators/report-signoff';
import { CsiSignoffType, ReportSignoffService } from '../../reports/services/report-signoff.service';
import { CsiMemoSetting } from '../entities/csi-memo-setting.entity';
import { renderCsiReportPdf } from './csi-report-pdf';
import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { CsiRateeKind } from '../csi.constants';
import { answerColumns, answerSheetRows, questionsOf } from './csi-export.answers';
import { addMatrixSheet } from './csi-export.matrix';
import { addExecutiveSheets, surveyLineOf } from './csi-export.executive';
import { addTable, RAW_HEADER_ROW, startRawSheet } from './csi-excel-style';
import { raterMatrix } from './csi-rater-matrix.calc';
import { sanitizeCell } from './csi-export.sheet';
import { CsiReportService } from './csi-report.service';
import { addHcAnswersRawSheet } from '../org/csi-hc-report.render';

export { sanitizeCell } from './csi-export.sheet';

type Report = Awaited<ReturnType<CsiReportService['getReport']>>;
export const RAW_SHEETS = { team: 'Penilaian Tim', person: 'Penilaian Per Orang' } as const;
/** Suffix of the raw-data workbook file name (it names the raters). */
export const RAW_FILENAME_SUFFIX = ' - DATA MENTAH (RAHASIA)';
const IDENTITY_FREEZE = 2;

/** Shown name of a ratee: a team carries its own name (HC custom teams), falling back to the period team label. */
const rateeName = (ratee: Report['ratees'][number], report: Report): string =>
    ratee.kind === CsiRateeKind.TEAM ? ratee.displayName || report.period.teamLabel : ratee.displayName;

/** Workbook shell shared by both files. */
export function newCsiWorkbook(title: string, now: Date): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'iDesk CSI';
    workbook.created = now;
    workbook.title = sanitizeCell(title);
    return workbook;
}

/** Sign-off of the report PDF: the two signers remembered from the scope's last Interoffice Memo. */
export const csiSignoffType = (scope: ServiceScope): CsiSignoffType => `csi-${scope}` as CsiSignoffType;
export type CsiExportOptions = { siteId?: string; notes?: string; signoff?: string };

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
        @Optional() private readonly signoffs?: ReportSignoffService,
    ) { }

    /** One-off layout from the preview, else the saved CSI layout of the scope, else the memo signers. */
    async signoffFor(scope: ServiceScope, override?: string): Promise<SignoffLayout> {
        const oneOff = parseSignoffParam(override, undefined);
        if (oneOff) return oneOff;
        const saved = await this.signoffs?.resolve(csiSignoffType(scope));
        if (saved) return saved;
        return signoffFrom(this.memoSettings ? await this.memoSettings.findOne({ where: { scope } }) : null);
    }

    private async model(scope: ServiceScope, periodId: string, options: CsiExportOptions) {
        const matrix = await this.reports.getRaterMatrix(scope, periodId, options.siteId);
        // The model carries the HC recap (same site filter), or null when the period has no HC PIC (ICT never has one).
        return this.reports.getExecutiveModel(scope, periodId, { siteId: options.siteId, notes: options.notes, matrix });
    }

    /** Executive survey report PDF (rankings and comments carry no respondent names). */
    async buildPdf(scope: ServiceScope, periodId: string, options: CsiExportOptions = {}, now: Date = new Date()): Promise<{ filename: string; buffer: Buffer }> {
        const [model, signoff] = await Promise.all([this.model(scope, periodId, options), this.signoffFor(scope, options.signoff)]);
        const buffer = await renderCsiReportPdf({ model, signoff, now });
        return { filename: `laporan-csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}.pdf`, buffer };
    }

    /** Main report workbook: the PDF's parameters in numbered sheets, anonymous (no rater names or e-mails). */
    async buildWorkbook(scope: ServiceScope, periodId: string, now: Date = new Date(), options: CsiExportOptions = {}): Promise<{ filename: string; buffer: Buffer }> {
        const model = await this.model(scope, periodId, { notes: options.notes });
        const workbook = newCsiWorkbook(model.title, now);
        addExecutiveSheets(workbook, model);
        return { filename: `${this.baseName(scope, now)}.xlsx`, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    }

    /**
     * Raw-data workbook (admin only, it names the raters): every answer per team / person, the rater × subject matrix
     * and, for HC, every respondent's stars per PIC. Each sheet opens with the confidential banner.
     */
    async buildRawWorkbook(scope: ServiceScope, periodId: string, now: Date = new Date()): Promise<{ filename: string; buffer: Buffer }> {
        const [report, answers, model] = await Promise.all([
            this.reports.getReport(scope, periodId),
            this.reports.listAnswers(scope, periodId),
            this.model(scope, periodId, {}),
        ]);
        const workbook = newCsiWorkbook(`${report.period.title}${RAW_FILENAME_SUFFIX}`, now);
        const line = surveyLineOf(model);
        const kinds: Array<[CsiRateeKind, string]> = [[CsiRateeKind.TEAM, RAW_SHEETS.team], [CsiRateeKind.PERSON, RAW_SHEETS.person]];
        for (const [kind, sheetName] of kinds) {
            if (!report.ratees.some((ratee) => ratee.kind === kind)) continue;
            const questions = questionsOf(report.ratees, kind);
            const columns = answerColumns(questions, kind === CsiRateeKind.PERSON);
            const sheet = startRawSheet(workbook, sheetName, line, Math.min(columns.length, 10));
            addTable(sheet, columns, answerSheetRows(answers, kind, questions),
                { bands: model.bands, headerRow: RAW_HEADER_ROW, freeze: { columns: IDENTITY_FREEZE }, emptyText: 'Belum ada jawaban.' });
        }
        addMatrixSheet(workbook, raterMatrix(report.ratees.map((ratee) => ({
            periodRateeId: ratee.periodRateeId, kind: ratee.kind, siteId: ratee.siteId ?? null,
            displayName: rateeName(ratee, report),
        })), answers), model.bands, line);
        if (model.hcRecap) addHcAnswersRawSheet(workbook, model.hcRecap, line, model.bands);
        return {
            filename: `${this.baseName(scope, now)}${RAW_FILENAME_SUFFIX}.xlsx`,
            buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
        };
    }

    private baseName(scope: ServiceScope, now: Date) {
        return `csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}`;
    }
}
