import type { Border, Borders, CellValue, Fill, Font, Workbook, Worksheet } from 'exceljs';
import { downloadBlob } from '../../../lib/csiAdmin';
import { formatDateTime } from '../../../lib/format';
import type { CsiScopeParam, CsiSiteSummary } from '../../../types';
import type { PersonRow } from './respondentModel';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DEFAULT_SURVEY_HOST = 'idesk.santos.co.id';
const FONT_FAMILY = 'Calibri';
const MAX_SHEET_NAME_LENGTH = 31;

const RINGKASAN_HEADERS = ['Site', 'Total Responden', 'Sudah Mengisi', 'Belum Mengisi', 'Persentase Selesai', 'Link Pengisian'] as const;
const LIST_HEADERS = ['No', 'Nama Responden', 'Site', 'Departemen', 'Status', 'Waktu Mengisi', 'Link Pengisian'] as const;
const RINGKASAN_COL_WIDTHS = [22, 18, 18, 18, 20, 24] as const;
const LIST_COL_WIDTHS = [7, 36, 10, 44, 18, 22, 22] as const;

const COLORS = {
    navy: 'FF1B365D',
    white: 'FFFFFFFF',
    zebraAlt: 'FFF4F7FA',
    bannerBg: 'FFEDF2F7',
    totalBg: 'FFE2E8F0',
    subtitleText: 'FF4A5568',
    bodyText: 'FF1A202C',
    mutedText: 'FF718096',
    linkBlue: 'FF1D4ED8',
    pendingText: 'FF9B1C1C',
    pendingBg: 'FFFDE8E8',
    doneText: 'FF03543F',
    doneBg: 'FFDEF7EC',
    borderGray: 'FFCBD5E0',
} as const;

const THIN_GRAY: Partial<Border> = { style: 'thin', color: { argb: COLORS.borderGray } };
const MEDIUM_NAVY: Partial<Border> = { style: 'medium', color: { argb: COLORS.navy } };
const DOUBLE_NAVY: Partial<Border> = { style: 'double', color: { argb: COLORS.navy } };

const DATA_BORDER: Partial<Borders> = { top: THIN_GRAY, bottom: THIN_GRAY, left: THIN_GRAY, right: THIN_GRAY };
const HEADER_BORDER: Partial<Borders> = { top: MEDIUM_NAVY, bottom: MEDIUM_NAVY, left: THIN_GRAY, right: THIN_GRAY };
const TOTAL_BORDER: Partial<Borders> = { top: THIN_GRAY, bottom: DOUBLE_NAVY, left: THIN_GRAY, right: THIN_GRAY };

const solidFill = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const makeFont = (opts: Partial<Font> = {}): Partial<Font> => ({ name: FONT_FAMILY, size: 10, color: { argb: COLORS.bodyText }, ...opts });

type SheetCell = string | number | { t: 'n'; v: number; z: string };
interface SiteGroup {
    code: string;
    rows: PersonRow[];
    total: number;
    done: number;
    pending: number;
}

/** Neutralises spreadsheet formula injection (`=`, `+`, `-`, `@`, tab, CR). */
export function sanitizeExcelCell(value: string | null | undefined): string {
    const text = value ?? '';
    return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

const slugify = (value: string): string =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'csi';

const surveyLinkInfo = (): { label: string; href: string } => {
    if (typeof window === 'undefined') return { label: DEFAULT_SURVEY_HOST, href: `https://${DEFAULT_SURVEY_HOST}` };
    const host = window.location?.host?.trim() ?? '';
    const isLocal = !host || host.startsWith('localhost') || host.startsWith('127.0.0.1');
    if (isLocal) return { label: DEFAULT_SURVEY_HOST, href: `https://${DEFAULT_SURVEY_HOST}` };
    const origin = window.location?.origin?.trim();
    const href = origin && /^https?:\/\//.test(origin) ? origin : `https://${host}`;
    return { label: host, href };
};

const toHyperlinkHref = (label: string, fallbackHref?: string): string => {
    if (fallbackHref && /^https?:\/\//.test(fallbackHref)) return fallbackHref;
    return /^https?:\/\//.test(label) ? label : `https://${label}`;
};

const formatDateId = (date: Date): string =>
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date);

const safeSheetName = (name: string, used: Set<string>): string => {
    const cleaned = name.replace(/[\\/*?:[\]]/g, '').trim() || 'Responden';
    let candidate = cleaned.slice(0, MAX_SHEET_NAME_LENGTH);
    let suffix = 2;
    while (used.has(candidate)) {
        const tag = ` (${suffix})`;
        candidate = `${cleaned.slice(0, MAX_SHEET_NAME_LENGTH - tag.length)}${tag}`;
        suffix += 1;
    }
    used.add(candidate);
    return candidate;
};

const siteCodeMap = (sites: readonly CsiSiteSummary[]): Map<string, string> =>
    new Map(sites.map((site) => [site.id, site.code ?? site.name ?? '']));

const siteCodeFor = (row: PersonRow, codeOf: ReadonlyMap<string, string>): string =>
    (row.siteId ? codeOf.get(row.siteId) : null) || '-';

/** Sorts rows by Site ASC -> Status (`Belum` first, `Sudah mengisi` second) -> Name ASC. */
export function sortRespondentsForExport(rows: readonly PersonRow[], sites: readonly CsiSiteSummary[]): PersonRow[] {
    const codeOf = siteCodeMap(sites);
    return [...rows].sort((a, b) => {
        const siteCmp = siteCodeFor(a, codeOf).localeCompare(siteCodeFor(b, codeOf), 'id');
        if (siteCmp !== 0) return siteCmp;
        if (a.done !== b.done) return Number(a.done) - Number(b.done);
        return a.name.localeCompare(b.name, 'id');
    });
}

function groupBySite(rows: readonly PersonRow[], sites: readonly CsiSiteSummary[]): { sorted: PersonRow[]; groups: SiteGroup[] } {
    const codeOf = siteCodeMap(sites);
    const sorted = sortRespondentsForExport(rows, sites);
    const bySite = new Map<string, PersonRow[]>();

    for (const row of sorted) {
        const code = siteCodeFor(row, codeOf);
        const list = bySite.get(code) ?? [];
        list.push(row);
        bySite.set(code, list);
    }

    const groups: SiteGroup[] = [...bySite.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'id'))
        .map(([code, siteRows]) => {
            const done = siteRows.filter((row) => row.done).length;
            return { code, rows: siteRows, total: siteRows.length, done, pending: siteRows.length - done };
        });

    return { sorted, groups };
}

/** Builds the plain data matrix for Ringkasan / Rekap summary (used in unit assertions). */
export function buildRekapSheetData(
    rows: readonly PersonRow[],
    sites: readonly CsiSiteSummary[],
    options: { scope: CsiScopeParam; periodTitle?: string; now?: Date; link?: string },
): SheetCell[][] {
    const { groups } = groupBySite(rows, sites);
    const link = options.link ?? surveyLinkInfo().label;
    const title = (options.periodTitle || `SURVEI CSI ${options.scope}`).toUpperCase();
    const totalAll = rows.length;
    const doneAll = rows.filter((row) => row.done).length;
    const pctCell = (done: number, total: number): SheetCell => ({ t: 'n', v: total > 0 ? done / total : 0, z: '0.0%' });

    return [
        [`REKAPITULASI PROGRES PENGISIAN ${title}`],
        [`Data per ${formatDateId(options.now ?? new Date())} | Diurutkan berdasarkan Site & Status Pengisian`],
        ['Link Pengisian Survei:', link],
        [],
        [...RINGKASAN_HEADERS],
        ...groups.map((group) => [sanitizeExcelCell(group.code), group.total, group.done, group.pending, pctCell(group.done, group.total), link]),
        ['TOTAL', totalAll, doneAll, totalAll - doneAll, pctCell(doneAll, totalAll), link],
    ];
}

/** Builds the plain data matrix for a respondent list sheet (used in unit assertions). */
export function buildRespondentsSheetData(
    rows: readonly PersonRow[],
    sites: readonly CsiSiteSummary[],
    options: { scope?: CsiScopeParam; periodTitle?: string; siteLabel?: string; link?: string } = {},
): Array<Array<string | number>> {
    const codeOf = siteCodeMap(sites);
    const sorted = sortRespondentsForExport(rows, sites);
    const link = options.link ?? surveyLinkInfo().label;
    const title = (options.periodTitle || `SURVEI CSI ${options.scope ?? ''}`).trim().toUpperCase();
    const doneCount = sorted.filter((row) => row.done).length;
    const heading = options.siteLabel
        ? `DAFTAR RESPONDEN ${title} — SITE ${options.siteLabel}`
        : `DAFTAR RESPONDEN ${title} — SEMUA SITE (TERURUT PER SITE)`;
    const totalPrefix = options.siteLabel ? `Total Site ${options.siteLabel}` : 'Total';

    return [
        [heading],
        ['Link Pengisian:', link, '', '', `${totalPrefix}: ${sorted.length} | Sudah: ${doneCount} | Belum: ${sorted.length - doneCount}`],
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

function setColWidths(ws: Worksheet, widths: readonly number[]): void {
    widths.forEach((width, index) => {
        ws.getColumn(index + 1).width = width;
    });
}

function styleBannerRange(ws: Worksheet, rowNum: number, startCol: number, endCol: number): void {
    const fill = solidFill(COLORS.bannerBg);
    for (let col = startCol; col <= endCol; col += 1) {
        const cell = ws.getCell(rowNum, col);
        cell.fill = fill;
        cell.border = {
            top: THIN_GRAY,
            bottom: THIN_GRAY,
            left: col === startCol ? THIN_GRAY : undefined,
            right: col === endCol ? THIN_GRAY : undefined,
        };
    }
}

function styleHeaderRow(ws: Worksheet, rowNum: number, headers: readonly string[]): void {
    const row = ws.getRow(rowNum);
    row.height = 26;
    headers.forEach((header, index) => {
        const cell = row.getCell(index + 1);
        cell.value = header;
        cell.font = makeFont({ bold: true, color: { argb: COLORS.white } });
        cell.fill = solidFill(COLORS.navy);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = HEADER_BORDER;
    });
}

function setHyperlinkCell(cell: Worksheet['getCell'] extends (...args: never[]) => infer C ? C : never, link: { label: string; href: string }, horizontal: 'left' | 'center'): void {
    cell.value = { text: link.label, hyperlink: link.href };
    cell.font = makeFont({ bold: true, underline: 'single', color: { argb: COLORS.linkBlue } });
    cell.alignment = { horizontal, vertical: 'middle', wrapText: true };
}

function populateSummarySheet(
    wb: Workbook,
    sheetName: string,
    allSheetName: string,
    groups: readonly SiteGroup[],
    totalAll: number,
    options: { title: string; now: Date; link: { label: string; href: string } },
): void {
    const ws = wb.addWorksheet(sheetName);
    setColWidths(ws, RINGKASAN_COL_WIDTHS);

    ws.getRow(1).height = 28;
    ws.mergeCells('A1:F1');
    const a1 = ws.getCell('A1');
    a1.value = `REKAPITULASI PROGRES PENGISIAN ${options.title}`;
    a1.font = makeFont({ size: 14, bold: true, color: { argb: COLORS.navy } });
    a1.alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getRow(2).height = 18;
    ws.mergeCells('A2:F2');
    const a2 = ws.getCell('A2');
    a2.value = `Data per ${formatDateId(options.now)} | Diurutkan berdasarkan Site & Status Pengisian`;
    a2.font = makeFont({ italic: true, color: { argb: COLORS.subtitleText } });
    a2.alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getRow(3).height = 24;
    const a3 = ws.getCell('A3');
    a3.value = 'Link Pengisian Survei:';
    a3.font = makeFont({ bold: true, color: { argb: COLORS.navy } });
    a3.fill = solidFill(COLORS.bannerBg);
    a3.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    a3.border = DATA_BORDER;

    ws.mergeCells('B3:F3');
    styleBannerRange(ws, 3, 2, 6);
    setHyperlinkCell(ws.getCell('B3'), options.link, 'left');

    styleHeaderRow(ws, 5, RINGKASAN_HEADERS);

    const lastDataRow = 4 + totalAll;
    const escapedSheet = allSheetName.replace(/'/g, "''");
    const siteColRange = `'${escapedSheet}'!$C$5:$C$${lastDataRow}`;
    const statusColRange = `'${escapedSheet}'!$E$5:$E$${lastDataRow}`;

    groups.forEach((group, idx) => {
        const rowNum = 6 + idx;
        const row = ws.getRow(rowNum);
        row.height = 22;
        const rowFill = solidFill(idx % 2 === 0 ? COLORS.white : COLORS.zebraAlt);
        const pct = group.total > 0 ? group.done / group.total : 0;

        const values: CellValue[] = [
            sanitizeExcelCell(group.code),
            totalAll > 0 ? { formula: `COUNTIF(${siteColRange}, A${rowNum})`, result: group.total } : 0,
            totalAll > 0 ? { formula: `COUNTIFS(${siteColRange}, A${rowNum}, ${statusColRange}, "Sudah mengisi")`, result: group.done } : 0,
            totalAll > 0 ? { formula: `COUNTIFS(${siteColRange}, A${rowNum}, ${statusColRange}, "Belum")`, result: group.pending } : 0,
            { formula: `IF(B${rowNum}>0, C${rowNum}/B${rowNum}, 0)`, result: pct },
        ];

        values.forEach((val, colIdx) => {
            const cell = row.getCell(colIdx + 1);
            cell.value = val;
            cell.font = makeFont({ bold: colIdx === 0 || colIdx === 4 });
            cell.fill = rowFill;
            cell.border = DATA_BORDER;
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            if (colIdx >= 1 && colIdx <= 3) cell.numFmt = '#,##0';
            if (colIdx === 4) cell.numFmt = '0.0%';
        });

        const linkCell = row.getCell(6);
        setHyperlinkCell(linkCell, options.link, 'center');
        linkCell.fill = rowFill;
        linkCell.border = DATA_BORDER;
    });

    const totalRowNum = 6 + groups.length;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.height = 24;
    const totalFill = solidFill(COLORS.totalBg);
    const doneAll = groups.reduce((acc, g) => acc + g.done, 0);
    const pendingAll = totalAll - doneAll;
    const endSumRow = totalRowNum - 1;
    const hasGroups = groups.length > 0;

    const totalValues: CellValue[] = [
        'TOTAL',
        hasGroups ? { formula: `SUM(B6:B${endSumRow})`, result: totalAll } : 0,
        hasGroups ? { formula: `SUM(C6:C${endSumRow})`, result: doneAll } : 0,
        hasGroups ? { formula: `SUM(D6:D${endSumRow})`, result: pendingAll } : 0,
        { formula: `IF(B${totalRowNum}>0, C${totalRowNum}/B${totalRowNum}, 0)`, result: totalAll > 0 ? doneAll / totalAll : 0 },
    ];

    totalValues.forEach((val, colIdx) => {
        const cell = totalRow.getCell(colIdx + 1);
        cell.value = val;
        cell.font = makeFont({ bold: true });
        cell.fill = totalFill;
        cell.border = TOTAL_BORDER;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        if (colIdx >= 1 && colIdx <= 3) cell.numFmt = '#,##0';
        if (colIdx === 4) cell.numFmt = '0.0%';
    });

    const totalLinkCell = totalRow.getCell(6);
    setHyperlinkCell(totalLinkCell, options.link, 'center');
    totalLinkCell.fill = totalFill;
    totalLinkCell.border = TOTAL_BORDER;
}

function populateRespondentsSheet(
    wb: Workbook,
    sheetName: string,
    rows: readonly PersonRow[],
    codeOf: ReadonlyMap<string, string>,
    options: { title: string; siteLabel?: string; link: { label: string; href: string } },
): void {
    const ws = wb.addWorksheet(sheetName);
    setColWidths(ws, LIST_COL_WIDTHS);
    ws.views = [{ state: 'frozen', ySplit: 4, topLeftCell: 'A5' }];
    ws.autoFilter = rows.length > 0 ? `A4:G${4 + rows.length}` : 'A4:G4';

    const doneCount = rows.filter((row) => row.done).length;
    const pendingCount = rows.length - doneCount;
    const heading = options.siteLabel
        ? `DAFTAR RESPONDEN ${options.title} — SITE ${options.siteLabel}`
        : `DAFTAR RESPONDEN ${options.title} — SEMUA SITE (TERURUT PER SITE)`;
    const totalPrefix = options.siteLabel ? `Total Site ${options.siteLabel}` : 'Total';

    ws.getRow(1).height = 26;
    ws.mergeCells('A1:G1');
    const a1 = ws.getCell('A1');
    a1.value = heading;
    a1.font = makeFont({ size: 14, bold: true, color: { argb: COLORS.navy } });
    a1.alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getRow(2).height = 22;
    const a2 = ws.getCell('A2');
    a2.value = 'Link Pengisian:';
    a2.font = makeFont({ bold: true, color: { argb: COLORS.navy } });
    a2.fill = solidFill(COLORS.bannerBg);
    a2.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    a2.border = DATA_BORDER;

    ws.mergeCells('B2:D2');
    styleBannerRange(ws, 2, 2, 4);
    setHyperlinkCell(ws.getCell('B2'), options.link, 'left');

    ws.mergeCells('E2:G2');
    styleBannerRange(ws, 2, 5, 7);
    const e2 = ws.getCell('E2');
    e2.value = `${totalPrefix}: ${rows.length} | Sudah: ${doneCount} | Belum: ${pendingCount}`;
    e2.font = makeFont({ italic: true, color: { argb: COLORS.subtitleText } });
    e2.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };

    ws.getRow(3).height = 8;
    styleHeaderRow(ws, 4, LIST_HEADERS);

    rows.forEach((person, idx) => {
        const row = ws.getRow(5 + idx);
        row.height = 21;
        const rowFill = solidFill(idx % 2 === 0 ? COLORS.white : COLORS.zebraAlt);
        const siteCode = sanitizeExcelCell(siteCodeFor(person, codeOf));
        const submittedAt = person.done ? person.submittedAt : null;
        const hasTime = Boolean(submittedAt);
        const timeValue = submittedAt ? sanitizeExcelCell(formatDateTime(submittedAt)) : '-';

        const rowCells: Array<{ value: CellValue; align: 'left' | 'center'; font?: Partial<Font>; fill?: Fill }> = [
            { value: idx + 1, align: 'center' },
            { value: sanitizeExcelCell(person.name), align: 'left' },
            { value: siteCode, align: 'center', font: makeFont({ bold: true }) },
            { value: sanitizeExcelCell(person.department || '-'), align: 'left' },
            {
                value: person.done ? 'Sudah mengisi' : 'Belum',
                align: 'center',
                font: makeFont({ bold: true, color: { argb: person.done ? COLORS.doneText : COLORS.pendingText } }),
                fill: solidFill(person.done ? COLORS.doneBg : COLORS.pendingBg),
            },
            {
                value: timeValue,
                align: 'center',
                font: hasTime ? makeFont() : makeFont({ color: { argb: COLORS.mutedText } }),
            },
        ];

        rowCells.forEach((spec, colIdx) => {
            const cell = row.getCell(colIdx + 1);
            cell.value = spec.value;
            cell.font = spec.font ?? makeFont();
            cell.fill = spec.fill ?? rowFill;
            cell.border = DATA_BORDER;
            cell.alignment = { horizontal: spec.align, vertical: 'middle', wrapText: true };
        });

        const linkCell = row.getCell(7);
        setHyperlinkCell(linkCell, options.link, 'center');
        linkCell.fill = rowFill;
        linkCell.border = DATA_BORDER;
    });
}

async function loadExcelJs(): Promise<{ Workbook: typeof Workbook }> {
    const mod = await import('exceljs');
    const resolved = ((mod as { default?: typeof import('exceljs') }).default ?? mod) as { Workbook: typeof Workbook };
    return resolved;
}

export async function exportRespondentsExcel(input: {
    rows: readonly PersonRow[];
    sites: readonly CsiSiteSummary[];
    scope: CsiScopeParam;
    periodTitle?: string;
    suffix?: string;
    link?: string;
    now?: Date;
}): Promise<string> {
    const { Workbook: ExcelWorkbook } = await loadExcelJs();
    const linkInfo = input.link
        ? { label: input.link, href: toHyperlinkHref(input.link) }
        : surveyLinkInfo();
    const title = (input.periodTitle || `SURVEI CSI ${input.scope}`).trim().toUpperCase();
    const now = input.now ?? new Date();
    const codeOf = siteCodeMap(input.sites);
    const { sorted, groups } = groupBySite(input.rows, input.sites);

    const workbook = new ExcelWorkbook();
    workbook.created = now;
    workbook.modified = now;

    const usedNames = new Set<string>();
    const summarySheetName = safeSheetName('Ringkasan', usedNames);
    const allSheetName = safeSheetName('Semua Responden', usedNames);

    populateSummarySheet(workbook, summarySheetName, allSheetName, groups, sorted.length, { title, now, link: linkInfo });
    populateRespondentsSheet(workbook, allSheetName, sorted, codeOf, { title, link: linkInfo });

    for (const group of groups) {
        const siteSheetName = safeSheetName(`Site ${group.code}`, usedNames);
        populateRespondentsSheet(workbook, siteSheetName, group.rows, codeOf, {
            title,
            siteLabel: group.code,
            link: linkInfo,
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = respondentsExportFilename(input.scope, input.periodTitle, input.suffix);
    downloadBlob(new Blob([buffer], { type: XLSX_MIME }), filename);
    return filename;
}
