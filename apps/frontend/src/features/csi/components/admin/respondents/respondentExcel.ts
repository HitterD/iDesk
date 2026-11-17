import { downloadBlob } from '../../../lib/csiAdmin';
import { formatDateTime } from '../../../lib/format';
import type { CsiScopeParam, CsiSiteSummary } from '../../../types';
import type { PersonRow } from './respondentModel';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DEFAULT_SURVEY_LINK = 'idesk.santos.co.id';
const REKAP_HEADERS = ['Site', 'Total Responden', 'Sudah Mengisi', 'Belum Mengisi', 'Persentase Selesai', 'Link Pengisian'] as const;
const LIST_HEADERS = ['No', 'Nama Responden', 'Site', 'Departemen', 'Status', 'Waktu Mengisi', 'Link Pengisian'] as const;

const REKAP_COL_WIDTHS = [
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 24 },
];

const LIST_COL_WIDTHS = [
    { wch: 6 },
    { wch: 34 },
    { wch: 10 },
    { wch: 42 },
    { wch: 16 },
    { wch: 22 },
    { wch: 24 },
];

type SheetCell = string | number | { t: 'n'; v: number; z: string };

/** Neutralises spreadsheet formula injection (`=`, `+`, `-`, `@`, tab, CR). */
export function sanitizeExcelCell(value: string | null | undefined): string {
    const text = value ?? '';
    return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

const slugify = (value: string): string =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'csi';

const surveyLinkOf = (): string => {
    if (typeof window === 'undefined') return DEFAULT_SURVEY_LINK;
    const host = window.location?.host?.trim();
    return host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1') ? host : DEFAULT_SURVEY_LINK;
};

const formatDateId = (date: Date): string =>
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date);

const safeSheetName = (name: string): string =>
    name.replace(/[\\/*?:[\]]/g, '').trim().slice(0, 31) || 'Responden';

function siteCodeMap(sites: readonly CsiSiteSummary[]): Map<string, string> {
    return new Map(sites.map((site) => [site.id, site.code ?? site.name ?? '']));
}

function siteCodeFor(row: PersonRow, codeOf: ReadonlyMap<string, string>): string {
    return (row.siteId ? codeOf.get(row.siteId) : null) || '-';
}

/** Sorts rows by Site ASC -> Status (`Belum` first, `Sudah mengisi` second) -> Name ASC. */
export function sortRespondentsForExport(
    rows: readonly PersonRow[],
    sites: readonly CsiSiteSummary[],
): PersonRow[] {
    const codeOf = siteCodeMap(sites);
    return [...rows].sort((a, b) => {
        const siteCmp = siteCodeFor(a, codeOf).localeCompare(siteCodeFor(b, codeOf), 'id');
        if (siteCmp !== 0) return siteCmp;
        if (a.done !== b.done) return Number(a.done) - Number(b.done);
        return a.name.localeCompare(b.name, 'id');
    });
}

/** Builds the Rekap sheet rows (summary per site + TOTAL). */
export function buildRekapSheetData(
    rows: readonly PersonRow[],
    sites: readonly CsiSiteSummary[],
    options: { scope: CsiScopeParam; periodTitle?: string; now?: Date; link?: string },
): SheetCell[][] {
    const codeOf = siteCodeMap(sites);
    const link = options.link ?? surveyLinkOf();
    const title = (options.periodTitle || `SURVEI CSI ${options.scope}`).toUpperCase();
    const bySite = new Map<string, { total: number; done: number; pending: number }>();

    for (const row of rows) {
        const code = siteCodeFor(row, codeOf);
        const entry = bySite.get(code) ?? { total: 0, done: 0, pending: 0 };
        entry.total += 1;
        if (row.done) entry.done += 1;
        else entry.pending += 1;
        bySite.set(code, entry);
    }

    const sortedSites = [...bySite.entries()].sort(([a], [b]) => a.localeCompare(b, 'id'));
    const totalAll = rows.length;
    const doneAll = rows.filter((row) => row.done).length;
    const pendingAll = totalAll - doneAll;
    const pctCell = (done: number, total: number): SheetCell => ({
        t: 'n',
        v: total > 0 ? done / total : 0,
        z: '0.0%',
    });

    return [
        [`REKAPITULASI PROGRES PENGISIAN ${title}`],
        [`Data per ${formatDateId(options.now ?? new Date())} | Diurutkan berdasarkan Site & Status Pengisian`],
        ['Link Pengisian Survei:', link],
        [],
        [...REKAP_HEADERS],
        ...sortedSites.map(([code, stat]) => [
            sanitizeExcelCell(code),
            stat.total,
            stat.done,
            stat.pending,
            pctCell(stat.done, stat.total),
            link,
        ]),
        ['TOTAL', totalAll, doneAll, pendingAll, pctCell(doneAll, totalAll), link],
    ];
}

/** Builds a respondent list sheet (used for both `Semua Site` and per-site sheets). */
export function buildRespondentsSheetData(
    rows: readonly PersonRow[],
    sites: readonly CsiSiteSummary[],
    options: { scope?: CsiScopeParam; periodTitle?: string; siteLabel?: string; link?: string } = {},
): Array<Array<string | number>> {
    const codeOf = siteCodeMap(sites);
    const sorted = sortRespondentsForExport(rows, sites);
    const link = options.link ?? surveyLinkOf();
    const title = (options.periodTitle || `SURVEI CSI ${options.scope ?? ''}`).trim().toUpperCase();
    const doneCount = sorted.filter((row) => row.done).length;
    const pendingCount = sorted.length - doneCount;
    const heading = options.siteLabel
        ? `DAFTAR RESPONDEN ${title} — SITE ${options.siteLabel}`
        : `DAFTAR RESPONDEN ${title} — SEMUA SITE (TERURUT PER SITE)`;
    const totalPrefix = options.siteLabel ? `Total Site ${options.siteLabel}` : 'Total';

    return [
        [heading],
        ['Link Pengisian:', link, '', '', `${totalPrefix}: ${sorted.length} | Sudah: ${doneCount} | Belum: ${pendingCount}`],
        [],
        [...LIST_HEADERS],
        ...sorted.map((row, index) => [
            index + 1,
            sanitizeExcelCell(row.name),
            sanitizeExcelCell(siteCodeFor(row, codeOf)),
            sanitizeExcelCell(row.department || '-'),
            row.done ? 'Sudah mengisi' : 'Belum',
            row.done && row.submittedAt ? sanitizeExcelCell(formatDateTime(row.submittedAt)) : '-',
            link,
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
    const link = surveyLinkOf();
    const workbook = XLSX.utils.book_new();
    const codeOf = siteCodeMap(input.sites);

    const rekapSheet = XLSX.utils.aoa_to_sheet(
        buildRekapSheetData(input.rows, input.sites, { scope: input.scope, periodTitle: input.periodTitle, link }),
    );
    rekapSheet['!cols'] = REKAP_COL_WIDTHS;
    XLSX.utils.book_append_sheet(workbook, rekapSheet, 'Rekap');

    const allSheetData = buildRespondentsSheetData(input.rows, input.sites, {
        scope: input.scope,
        periodTitle: input.periodTitle,
        link,
    });
    const allSheet = XLSX.utils.aoa_to_sheet(allSheetData);
    allSheet['!cols'] = LIST_COL_WIDTHS;
    XLSX.utils.book_append_sheet(workbook, allSheet, 'Semua Site');

    const grouped = new Map<string, PersonRow[]>();
    for (const row of sortRespondentsForExport(input.rows, input.sites)) {
        const code = siteCodeFor(row, codeOf);
        grouped.set(code, [...(grouped.get(code) ?? []), row]);
    }
    for (const [code, siteRows] of grouped) {
        const siteSheet = XLSX.utils.aoa_to_sheet(
            buildRespondentsSheetData(siteRows, input.sites, {
                scope: input.scope,
                periodTitle: input.periodTitle,
                siteLabel: code,
                link,
            }),
        );
        siteSheet['!cols'] = LIST_COL_WIDTHS;
        XLSX.utils.book_append_sheet(workbook, siteSheet, safeSheetName(code));
    }

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const filename = respondentsExportFilename(input.scope, input.periodTitle, input.suffix);
    downloadBlob(new Blob([buffer], { type: XLSX_MIME }), filename);
    return filename;
}
