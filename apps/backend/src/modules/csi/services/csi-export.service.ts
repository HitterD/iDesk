import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { CsiReportService } from './csi-report.service';

const FORMULA_PREFIX = /^[=+\-@]/;
const COLUMN_WIDTH = 22;
const STATUS_SUBMITTED = 'Sudah mengisi';
const STATUS_PENDING = 'Belum mengisi';
const WIB_DATETIME = new Intl.DateTimeFormat('sv-SE', {
    timeZone: DEFAULT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

/** Neutralises spreadsheet formula injection: text starting with = + - @ is prefixed with a single quote. */
export function sanitizeCell(value: string | null | undefined): string {
    const text = value ?? '';
    return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

@Injectable()
export class CsiExportService {
    constructor(private readonly reports: CsiReportService) { }

    async buildWorkbook(scope: ServiceScope, periodId: string, now: Date = new Date()): Promise<{ filename: string; buffer: Buffer }> {
        const [report, respondents, answers] = await Promise.all([
            this.reports.getReport(scope, periodId),
            this.reports.getRespondents(scope, periodId),
            this.reports.listAnswers(scope, periodId),
        ]);
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'iDesk CSI';
        workbook.created = now;
        workbook.title = sanitizeCell(report.period.title);

        const dimensionNames = [...new Set(report.ratees.flatMap((ratee) => ratee.dimensions.map((dimension) => dimension.name)))];
        addSheet(workbook, 'Nilai', ['Nama', 'Jabatan', 'Responden', ...dimensionNames, 'Rata-rata', 'Indeks %'],
            report.ratees.map((ratee) => [
                sanitizeCell(ratee.displayName), sanitizeCell(ratee.jobTitle), ratee.respondentCount,
                ...dimensionNames.map((name) => ratee.dimensions.find((dimension) => dimension.name === name)?.average ?? null),
                ratee.average, ratee.indexPct,
            ]));

        addSheet(workbook, 'Jawaban', ['Responden', 'Departemen', 'Dinilai', 'Dimensi', 'Skor', 'Komentar'],
            answers.flatMap((answer) => answer.ratees.flatMap((ratee) => ratee.scores.map(({ dimension, score }) => [
                sanitizeCell(answer.fullName), sanitizeCell(answer.departmentName), sanitizeCell(ratee.displayName),
                sanitizeCell(dimension), score, sanitizeCell(ratee.comment),
            ]))));

        addSheet(workbook, 'Status Responden', ['Nama', 'Departemen', 'Status', 'Waktu Mengisi (WIB)'], [
            ...respondents.submitted.map((row) => [
                sanitizeCell(row.fullName), sanitizeCell(row.departmentName), STATUS_SUBMITTED, WIB_DATETIME.format(row.submittedAt),
            ]),
            ...(respondents.pending ?? []).map((row) => [sanitizeCell(row.fullName), '', STATUS_PENDING, '']),
        ]);

        return {
            filename: `csi-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}.xlsx`,
            buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
        };
    }
}

function addSheet(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: Array<Array<string | number | null>>) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((column) => { column.width = COLUMN_WIDTH; });
    return sheet;
}
