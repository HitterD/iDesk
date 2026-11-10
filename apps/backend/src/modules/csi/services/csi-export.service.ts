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
import { answerColumns, answerRows, questionsOf } from './csi-export.answers';
import { addMatrixSheet } from './csi-export.matrix';
import { addExecutiveSheets } from './csi-export.executive';
import { raterMatrix } from './csi-rater-matrix.calc';
import { addStyledSheet, AVERAGE_COLUMN, PERCENT_COLUMN, sanitizeCell, WIDTH } from './csi-export.sheet';
import { formatLocation } from './csi-format.util';
import { CsiReportService } from './csi-report.service';
import { addHcRecapSheets } from '../org/csi-hc-report.render';

export { sanitizeCell } from './csi-export.sheet';

type Report = Awaited<ReturnType<CsiReportService['getReport']>>;
const SHEET_RECAP = 'Rekap';
const SHEET_TEAM = 'Penilaian Tim';
const SHEET_PERSON = 'Penilaian Per Orang';

/** Shown name of a ratee: a team carries its own name (HC custom teams), falling back to the period team label. */
const rateeName = (ratee: Report['ratees'][number], report: Report): string =>
    ratee.kind === CsiRateeKind.TEAM ? ratee.displayName || report.period.teamLabel : ratee.displayName;

/** Rekap: Lokasi, Nama (team or person name), Average per ratee, Average survei, % Pengisi (SLA). */
function addRecap(workbook: ExcelJS.Workbook, report: Report) {
    const location = sanitizeCell(formatLocation(report.period.sites));
    const rows = report.ratees.map((ratee) => [
        location,
        sanitizeCell(rateeName(ratee, report)),
        ratee.average, report.overall.average, report.sla.pengisiPct,
    ]);
    addStyledSheet(workbook, SHEET_RECAP, [
        { header: 'Lokasi', width: WIDTH.name }, { header: 'Nama', width: WIDTH.name },
        AVERAGE_COLUMN('Average'), AVERAGE_COLUMN('Average survei'), PERCENT_COLUMN('% Pengisi (SLA)'),
    ], rows);
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
        const model = await this.reports.getExecutiveModel(scope, periodId, { siteId: options.siteId, notes: options.notes, matrix });
        return { ...model, hcRecap: await this.hcRecap(scope, periodId) };
    }

    /** HC per-PIC recap of the period, or null when it has no HC PIC (ICT never has one). */
    private async hcRecap(scope: ServiceScope, periodId: string) {
        if (scope !== ServiceScope.HC) return null;
        const recap = await this.reports.getHcRecap(scope, periodId);
        return recap.services.some((row) => row.level === 'pic' && row.serviceCode) ? recap : null;
    }

    /** Executive survey report PDF (rankings and comments carry no respondent names). */
    async buildPdf(scope: ServiceScope, periodId: string, options: CsiExportOptions = {}, now: Date = new Date()): Promise<{ filename: string; buffer: Buffer }> {
        const [model, signoff] = await Promise.all([this.model(scope, periodId, options), this.signoffFor(scope, options.signoff)]);
        const buffer = await renderCsiReportPdf({ model, signoff, now });
        return { filename: `laporan-csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}.pdf`, buffer };
    }

    /** Executive sheets (same parameters as the PDF) followed by the raw answer sheets and the rater matrix. */
    async buildWorkbook(scope: ServiceScope, periodId: string, now: Date = new Date(), options: CsiExportOptions = {}): Promise<{ filename: string; buffer: Buffer }> {
        const [report, answers, model] = await Promise.all([
            this.reports.getReport(scope, periodId),
            this.reports.listAnswers(scope, periodId),
            this.model(scope, periodId, { notes: options.notes }),
        ]);
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'iDesk CSI';
        workbook.created = now;
        workbook.title = sanitizeCell(report.period.title);

        addExecutiveSheets(workbook, model);
        // Admin-only workbook: the HC detail sheet names the respondents (the PDF never does).
        if (model.hcRecap) addHcRecapSheets(workbook, model.hcRecap, true);
        addRecap(workbook, report);
        const kinds: Array<[CsiRateeKind, string]> = [[CsiRateeKind.TEAM, SHEET_TEAM], [CsiRateeKind.PERSON, SHEET_PERSON]];
        for (const [kind, sheetName] of kinds) {
            if (!report.ratees.some((ratee) => ratee.kind === kind)) continue;
            const questions = questionsOf(report.ratees, kind);
            addStyledSheet(workbook, sheetName, answerColumns(questions, kind === CsiRateeKind.PERSON), answerRows(answers, kind, questions));
        }
        addMatrixSheet(workbook, raterMatrix(report.ratees.map((ratee) => ({
            periodRateeId: ratee.periodRateeId, kind: ratee.kind, siteId: ratee.siteId ?? null,
            displayName: rateeName(ratee, report),
        })), answers), model.bands);
        return {
            filename: `csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}.xlsx`,
            buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
        };
    }
}
