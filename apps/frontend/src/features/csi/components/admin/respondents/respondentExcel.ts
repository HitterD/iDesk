import { downloadBlob } from '../../../lib/csiAdmin';
import { formatDateTime } from '../../../lib/format';
import type { CsiScopeParam, CsiSiteSummary } from '../../../types';
import type { PersonRow } from './respondentModel';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADERS = ['No', 'Nama', 'Site', 'Departemen', 'Status', 'Waktu Mengisi'] as const;
const COL_WIDTHS = [
    { wch: 5 },
    { wch: 30 },
    { wch: 10 },
    { wch: 32 },
    { wch: 16 },
    { wch: 22 },
];

/** Neutralises spreadsheet formula injection (`=`, `+`, `-`, `@`, tab, CR). */
export function sanitizeExcelCell(value: string | null | undefined): string {
    const text = value ?? '';
    return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

const slugify = (value: string): string =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'csi';

/** Builds Row-1 header table ready to upload to Google Sheets without scores or answers. */
export function buildRespondentsSheetData(
    rows: readonly PersonRow[],
    sites: readonly CsiSiteSummary[],
): Array<Array<string | number>> {
    const codeOf = new Map(sites.map((site) => [site.id, site.code ?? site.name ?? '']));
    return [
        [...HEADERS],
        ...rows.map((row, index) => [
            index + 1,
            sanitizeExcelCell(row.name),
            sanitizeExcelCell((row.siteId ? codeOf.get(row.siteId) : null) || '-'),
            sanitizeExcelCell(row.department || '-'),
            row.done ? 'Sudah mengisi' : 'Belum',
            row.done && row.submittedAt ? sanitizeExcelCell(formatDateTime(row.submittedAt)) : '',
        ]),
    ];
}

export function respondentsExportFilename(scope: CsiScopeParam, periodTitle?: string, suffix?: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const base = slugify(periodTitle || `csi-${scope}`);
    const extra = suffix ? `-${slugify(suffix)}` : '';
    return `responden-${base}${extra}-${today}.xlsx`;
}

export async function exportRespondentsExcel(input: {
    rows: readonly PersonRow[];
    sites: readonly CsiSiteSummary[];
    scope: CsiScopeParam;
    periodTitle?: string;
    suffix?: string;
}): Promise<string> {
    const XLSX = await import('xlsx');
    const sheetData = buildRespondentsSheetData(input.rows, input.sites);
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!cols'] = COL_WIDTHS;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Responden');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const filename = respondentsExportFilename(input.scope, input.periodTitle, input.suffix);
    downloadBlob(new Blob([buffer], { type: XLSX_MIME }), filename);
    return filename;
}
