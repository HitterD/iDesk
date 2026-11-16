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
import { addExecutiveSheets } from './csi-export.executive';
import { sanitizeCell } from './csi-export.sheet';
import { CsiReportService } from './csi-report.service';

export { sanitizeCell } from './csi-export.sheet';

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
        // The model carries the HC recap (same site filter), or null when the period has no HC PIC (ICT never has one).
        return this.reports.getExecutiveModel(scope, periodId, { siteId: options.siteId, notes: options.notes });
    }

    /** Executive survey report PDF (rankings and comments carry no respondent names). */
    async buildPdf(scope: ServiceScope, periodId: string, options: CsiExportOptions = {}, now: Date = new Date()): Promise<{ filename: string; buffer: Buffer }> {
        const [model, signoff] = await Promise.all([this.model(scope, periodId, options), this.signoffFor(scope, options.signoff)]);
        const buffer = await renderCsiReportPdf({ model, signoff, now });
        return { filename: `laporan-csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}.pdf`, buffer };
    }

    /** Main report workbook: the PDF's parameters in numbered sheets, anonymous (no rater names or e-mails). */
    async buildWorkbook(scope: ServiceScope, periodId: string, now: Date = new Date(), options: CsiExportOptions = {}): Promise<{ filename: string; buffer: Buffer }> {
        const model = await this.model(scope, periodId, { siteId: options.siteId, notes: options.notes });
        const workbook = newCsiWorkbook(model.title, now);
        addExecutiveSheets(workbook, model);
        return { filename: `${this.baseName(scope, now)}.xlsx`, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    }

    private baseName(scope: ServiceScope, now: Date) {
        return `csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}`;
    }
}
