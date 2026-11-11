import * as ExcelJS from 'exceljs';
import { CsiScoreBand, CsiScoreBands, scoreBand } from './csi-score-bands';

/**
 * CSI Excel style (report + raw data + templates; ticket reports keep reports/utils/excel-styles.util.ts): navy header
 * with white bold text, soft zebra, hairline borders, survey-band fills with dark text, totals row outside the filter,
 * real number / percent / date formats, auto column widths, print-ready A4 landscape with repeated header row.
 */
export const XL_COLOR = {
    navy: 'FF1F3A5F', white: 'FFFFFFFF', zebra: 'FFF5F7FA', border: 'FFD9DEE7', total: 'FFE8EDF5',
    good: 'FFD7F2EC', fair: 'FFFFF1CC', poor: 'FFFBDDD7',
    goodInk: 'FF0E5A47', fairInk: 'FF7A5200', poorInk: 'FF8F2314',
    ink: 'FF1F2937', muted: 'FF5B6575', group: 'FFDCE4EF', link: 'FF1F5FA8',
    simulation: 'FFFFF1CC', simulationInk: 'FF7A5200', confidential: 'FFB42318',
} as const;

/** Sheet tab colours per group: summary navy, analysis teal, participation slate, comments sand, raw data red. */
export const XL_TAB = { summary: XL_COLOR.navy, analysis: 'FF2C7A7B', participation: 'FF6B7FA3', comments: 'FFB08D57', raw: XL_COLOR.confidential } as const;
export type XlTab = keyof typeof XL_TAB;

export const XL_FORMAT = {
    score: '0.00', delta: '+0.00;-0.00;0.00', count: '#,##0', percent: '0%', percent1: '0.0%', date: 'dd mmm yyyy hh:mm',
} as const;

const FONT = 'Calibri';
const BODY_SIZE = 10;
const TITLE_SIZE = 16;
const SECTION_SIZE = 12;
const NOTE_SIZE = 9;
const WIDTH_MIN = 8;
const WIDTH_MAX = 60;
const WIDTH_PADDING = 2;
const DATE_WIDTH = 18;
const LONG_TEXT_WIDTH = 70;
const LINE_HEIGHT = 13;
const HEADER_PADDING = 8;
const HEADER_MIN_HEIGHT = 22;
const INDENT_STEP = 2;
/** Excel stores a Date as UTC wall-clock time; shifted by +7 h the cell shows Jakarta time. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export type XlFormula = { formula: string; result: string };
export type XlValue = string | number | Date | XlFormula | null;
export type XlKind = 'text' | 'longText' | 'score' | 'delta' | 'count' | 'percent' | 'percent1' | 'date';
/** `band`: score cells get the survey band fill (needs `bands` on the table). `width` overrides the measured width. */
export type XlColumn = { header: string; kind?: XlKind; width?: number; band?: boolean; tone?: (value: XlValue) => CsiScoreBand | null; indent?: boolean };
/** A totals row; `numberKind` overrides the numeric columns' format (e.g. a count row under score columns). */
export type XlTotalRow = XlValue[] | { values: XlValue[]; numberKind: XlKind };
/** Hierarchy styling of one data row: group = bold on a tinted fill, subgroup = bold, item = indented. */
export type XlRowStyle = { level?: 'group' | 'subgroup' | 'item'; muted?: boolean; topRule?: boolean };
export type XlTableOptions = {
    /** Header row; default the next free row. */
    headerRow?: number;
    totals?: XlTotalRow[];
    bands?: CsiScoreBands;
    rowStyle?: (index: number) => XlRowStyle | undefined;
    /** Autofilter on header..last data row (never the totals); one per sheet, default true. */
    filter?: boolean;
    /** Freeze below the header, plus the first N columns. */
    freeze?: boolean | { columns: number };
    /** Text in one merged row when there are no data rows. */
    emptyText?: string;
};
export type XlTable = { header: number; first: number; last: number; end: number };

const NUMERIC: ReadonlySet<XlKind> = new Set(['score', 'delta', 'count', 'percent', 'percent1']);
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const hair = { style: 'thin' as const, color: { argb: XL_COLOR.border } };
const BORDER: Partial<ExcelJS.Borders> = { top: hair, left: hair, bottom: hair, right: hair };
const font = (extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: FONT, size: BODY_SIZE, color: { argb: XL_COLOR.ink }, ...extra });
const BAND_FILL: Record<CsiScoreBand, string> = { good: XL_COLOR.good, fair: XL_COLOR.fair, poor: XL_COLOR.poor };
const BAND_INK: Record<CsiScoreBand, string> = { good: XL_COLOR.goodInk, fair: XL_COLOR.fairInk, poor: XL_COLOR.poorInk };

/** A Date shown as Jakarta wall-clock time in Excel (see WIB_OFFSET_MS). */
export const wibDate = (date: Date): Date => new Date(date.getTime() + WIB_OFFSET_MS);
/** Whole percent (0-100) to the fraction a '0%' cell needs. */
export const fraction = (pct: number | null | undefined): number | null => (pct === null || pct === undefined ? null : pct / 100);
/** In-workbook link to the top of a sheet (HYPERLINK formula: Excel and LibreOffice both follow it). */
export const sheetLink = (sheetName: string, label = sheetName): XlFormula =>
    ({ formula: `HYPERLINK("#'${sheetName.replace(/'/g, "''")}'!A1","${label.replace(/"/g, '""')}")`, result: label });

/** New report sheet: tab colour, no gridlines (tables carry their own borders), A4 landscape fit to width. */
export function addReportSheet(workbook: ExcelJS.Workbook, name: string, tab: XlTab, gridLines = false): ExcelJS.Worksheet {
    const sheet = workbook.addWorksheet(name, { properties: { tabColor: { argb: XL_TAB[tab] } }, views: [{ showGridLines: gridLines }] });
    sheet.pageSetup = {
        paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    };
    sheet.headerFooter = { oddFooter: '&L&8iDesk CSI · &A&R&8Halaman &P dari &N' };
    return sheet;
}

const mergeRow = (sheet: ExcelJS.Worksheet, row: number, span: number) => {
    if (span > 1) sheet.mergeCells(row, 1, row, span);
};

/** Banner row across `span` columns (simulation = amber, confidential = red with white text). */
export function bannerRow(sheet: ExcelJS.Worksheet, row: number, text: string, tone: 'simulation' | 'confidential', span: number) {
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    const confidential = tone === 'confidential';
    cell.font = font({ bold: true, size: 11, color: { argb: confidential ? XL_COLOR.white : XL_COLOR.simulationInk } });
    cell.fill = fill(confidential ? XL_COLOR.confidential : XL_COLOR.simulation);
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(row).height = 22;
    mergeRow(sheet, row, span);
}

/** One muted line (subtitle / explanation) across `span` columns. */
export function noteRow(sheet: ExcelJS.Worksheet, row: number, text: string, span: number, size = NOTE_SIZE) {
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    cell.font = font({ size, italic: size === NOTE_SIZE, color: { argb: XL_COLOR.muted } });
    cell.alignment = { vertical: 'middle', wrapText: false };
    mergeRow(sheet, row, span);
}

/** Title (16 bold navy), subtitle and an optional simulation banner; returns the first free row after a gap. */
export function titleBlock(sheet: ExcelJS.Worksheet, input: { title: string; subtitle: string; simulation?: string | null; span: number }): number {
    const title = sheet.getCell(1, 1);
    title.value = input.title;
    title.font = font({ bold: true, size: TITLE_SIZE, color: { argb: XL_COLOR.navy } });
    title.alignment = { vertical: 'middle' };
    sheet.getRow(1).height = 26;
    mergeRow(sheet, 1, input.span);
    noteRow(sheet, 2, input.subtitle, input.span, BODY_SIZE);
    let next = 3;
    if (input.simulation) bannerRow(sheet, next++, input.simulation, 'simulation', input.span);
    return next + 1;
}

/** Section heading (12 bold navy, navy underline across `span`); returns the next row. */
export function sectionRow(sheet: ExcelJS.Worksheet, row: number, text: string, span: number): number {
    for (let column = 1; column <= span; column++) {
        const cell = sheet.getCell(row, column);
        if (column === 1) cell.value = text;
        cell.font = font({ bold: true, size: SECTION_SIZE, color: { argb: XL_COLOR.navy } });
        cell.border = { bottom: { style: 'medium', color: { argb: XL_COLOR.navy } } };
    }
    sheet.getRow(row).height = 20;
    return row + 1;
}

const displayText = (value: XlValue, kind: XlKind): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return 'dd mmm yyyy hh:mm';
    if (typeof value === 'object') return value.result;
    if (typeof value === 'number') {
        if (kind === 'percent' || kind === 'percent1') return `${(value * 100).toFixed(1)}%`;
        if (kind === 'count') return value.toLocaleString('en-US');
        return value.toFixed(2);
    }
    return value;
};
const longestLine = (text: string) => Math.max(0, ...text.split(/\r?\n/).map((line) => line.length));
const longestWord = (text: string) => Math.max(0, ...text.split(/\s+/).map((word) => word.length));
/** exceljs drops a width equal to its default (9) from the file, so such a column would fall back to Excel's 8.43. */
const EXCELJS_DEFAULT_WIDTH = 9;
const clamp = (value: number) => {
    const width = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.ceil(value)));
    return width === EXCELJS_DEFAULT_WIDTH ? width + 1 : width;
};

/** Measured width: the longest value (or a header word, headers wrap), clamped 8-60; long text and dates fixed. */
function measure(column: XlColumn, values: XlValue[]): number {
    if (column.width) return column.width;
    const kind = column.kind ?? 'text';
    if (kind === 'longText') return LONG_TEXT_WIDTH;
    if (kind === 'date') return DATE_WIDTH;
    const header = Math.max(longestWord(column.header), Math.ceil(column.header.length / 2));
    const body = Math.max(0, ...values.map((value) => longestLine(displayText(value, kind))));
    return clamp(Math.max(header, body) + WIDTH_PADDING);
}

function headerHeight(sheet: ExcelJS.Worksheet, columns: XlColumn[], first: number): number {
    const lines = columns.map((column, index) => {
        const width = Math.max(WIDTH_MIN, (sheet.getColumn(first + index).width ?? WIDTH_MIN) - 1);
        return column.header.split(/\s+/).reduce(({ count, used }, word) => (used + word.length + 1 > width && used > 0
            ? { count: count + 1, used: word.length } : { count, used: used + word.length + 1 }), { count: 1, used: 0 }).count;
    });
    return Math.max(HEADER_MIN_HEIGHT, Math.max(1, ...lines) * LINE_HEIGHT + HEADER_PADDING);
}

function styleHeader(sheet: ExcelJS.Worksheet, row: number, columns: XlColumn[]) {
    columns.forEach((column, index) => {
        const cell = sheet.getCell(row, index + 1);
        cell.value = column.header;
        cell.font = font({ bold: true, color: { argb: XL_COLOR.white } });
        cell.fill = fill(XL_COLOR.navy);
        cell.border = { top: { style: 'thin', color: { argb: XL_COLOR.navy } }, bottom: { style: 'thin', color: { argb: XL_COLOR.navy } },
            left: { style: 'thin', color: { argb: XL_COLOR.border } }, right: { style: 'thin', color: { argb: XL_COLOR.border } } };
        cell.alignment = { wrapText: true, vertical: 'middle', horizontal: NUMERIC.has(column.kind ?? 'text') ? 'center' : 'left' };
    });
    sheet.getRow(row).height = headerHeight(sheet, columns, 1);
}

const numFmtOf = (kind: XlKind): string | undefined => (kind === 'text' || kind === 'longText' ? undefined : XL_FORMAT[kind]);

const INDENT: Record<NonNullable<XlRowStyle['level']>, number> = { group: 0, subgroup: 1, item: INDENT_STEP };

function styleCell(cell: ExcelJS.Cell, column: XlColumn, value: XlValue, options: { zebra: boolean; style?: XlRowStyle; bands?: CsiScoreBands }) {
    const kind = column.kind ?? 'text';
    const { style } = options;
    const strong = style?.level === 'group' || style?.level === 'subgroup';
    cell.value = value as ExcelJS.CellValue;
    cell.border = style?.topRule ? { ...BORDER, top: { style: 'thin', color: { argb: XL_COLOR.navy } } } : BORDER;
    const indent = column.indent && style?.level ? INDENT[style.level] : 0;
    cell.alignment = { vertical: 'middle', wrapText: kind === 'text' || kind === 'longText', horizontal: NUMERIC.has(kind) ? 'center' : 'left', indent };
    const format = numFmtOf(kind);
    if (format) cell.numFmt = format;
    const isLink = typeof value === 'object' && value !== null && !(value instanceof Date);
    cell.font = font({ bold: strong, italic: style?.muted, color: { argb: isLink ? XL_COLOR.link : style?.muted ? XL_COLOR.muted : XL_COLOR.ink }, underline: isLink });
    if (style?.level === 'group') cell.fill = fill(XL_COLOR.group);
    else if (options.zebra) cell.fill = fill(XL_COLOR.zebra);
    const band = column.tone ? column.tone(value) : column.band && options.bands && typeof value === 'number' ? scoreBand(value, options.bands) : null;
    if (band) {
        cell.fill = fill(BAND_FILL[band]);
        cell.font = font({ bold: strong, color: { argb: BAND_INK[band] } });
    }
}

const totalValues = (row: XlTotalRow) => (Array.isArray(row) ? row : row.values);

function styleTotals(sheet: ExcelJS.Worksheet, row: number, columns: XlColumn[], total: XlTotalRow) {
    const values = totalValues(total);
    columns.forEach((column, index) => {
        const cell = sheet.getCell(row, index + 1);
        cell.value = (values[index] ?? null) as ExcelJS.CellValue;
        const own = column.kind ?? 'text';
        const kind = !Array.isArray(total) && NUMERIC.has(own) ? total.numberKind : own;
        const format = numFmtOf(kind);
        if (format) cell.numFmt = format;
        cell.font = font({ bold: true, color: { argb: XL_COLOR.navy } });
        cell.fill = fill(XL_COLOR.total);
        cell.border = { ...BORDER, top: { style: 'medium', color: { argb: XL_COLOR.navy } } };
        cell.alignment = { vertical: 'middle', horizontal: NUMERIC.has(kind) ? 'center' : 'left' };
    });
}

/** Column widths: never narrower than an earlier table on the same sheet already needed. */
function applyWidths(sheet: ExcelJS.Worksheet, columns: XlColumn[], rows: XlValue[][], totals: XlTotalRow[]) {
    columns.forEach((column, index) => {
        const need = measure(column, [...rows, ...totals.map(totalValues)].map((values) => values[index] ?? null));
        const current = sheet.getColumn(index + 1);
        current.width = Math.max(current.width ?? 0, need);
    });
}

/**
 * A styled table: header (navy), zebra data rows with hierarchy / band styling, then the totals rows below the
 * autofilter range. Freezes below the header (and the first columns) when asked; the header repeats on every printed page.
 */
export function addTable(sheet: ExcelJS.Worksheet, columns: XlColumn[], rows: XlValue[][], options: XlTableOptions = {}): XlTable {
    const header = options.headerRow ?? sheet.rowCount + 1;
    const totals = options.totals ?? [];
    applyWidths(sheet, columns, rows, totals);
    styleHeader(sheet, header, columns);
    rows.forEach((values, index) => {
        const style = options.rowStyle?.(index);
        columns.forEach((column, position) => styleCell(sheet.getCell(header + 1 + index, position + 1), column, values[position] ?? null,
            { zebra: index % 2 === 1, style, bands: options.bands }));
    });
    const last = header + rows.length;
    if (!rows.length && options.emptyText) noteRow(sheet, header + 1, options.emptyText, columns.length);
    totals.forEach((values, index) => styleTotals(sheet, last + 1 + index, columns, values));
    if (options.filter !== false && rows.length) sheet.autoFilter = { from: { row: header, column: 1 }, to: { row: last, column: columns.length } };
    if (options.freeze) {
        const xSplit = typeof options.freeze === 'object' ? options.freeze.columns : 0;
        sheet.views = [{ state: 'frozen', ySplit: header, xSplit, showGridLines: sheet.views[0]?.showGridLines ?? false }];
        sheet.pageSetup.printTitlesRow = `${header}:${header}`;
    }
    return { header, first: header + 1, last, end: last + totals.length + (!rows.length && options.emptyText ? 1 : 0) };
}

/** One line of a key-value block: label, a typed value (band / tone fill) and an optional note. */
export type XlKv = { label: string; value: XlValue; kind?: XlKind; note?: string; band?: boolean; tone?: CsiScoreBand | null };

/**
 * Key-value block in columns A (label), B (value), C (note), starting at `row`; a text value without a note spans B:C.
 * Returns the next free row.
 */
export function kvRows(sheet: ExcelJS.Worksheet, row: number, items: XlKv[], bands?: CsiScoreBands): number {
    items.forEach((item, index) => {
        const at = row + index;
        const kind = item.kind ?? 'text';
        const zebra = index % 2 === 1;
        const label = sheet.getCell(at, 1);
        label.value = item.label;
        label.font = font({ bold: true, color: { argb: XL_COLOR.muted } });
        const value = sheet.getCell(at, 2);
        value.value = item.value as ExcelJS.CellValue;
        const format = numFmtOf(kind);
        if (format) value.numFmt = format;
        value.font = font({ bold: NUMERIC.has(kind) || item.tone !== undefined });
        value.alignment = { vertical: 'middle', horizontal: NUMERIC.has(kind) ? 'center' : 'left', wrapText: !NUMERIC.has(kind) };
        const note = sheet.getCell(at, 3);
        note.value = item.note ?? null;
        note.font = font({ color: { argb: XL_COLOR.muted } });
        note.alignment = { vertical: 'middle', wrapText: true };
        [label, value, note].forEach((cell) => {
            cell.border = BORDER;
            if (zebra) cell.fill = fill(XL_COLOR.zebra);
            if (cell !== value) cell.alignment = { ...cell.alignment, vertical: 'middle' };
        });
        const band = item.tone !== undefined ? item.tone : item.band && bands && typeof item.value === 'number' ? scoreBand(item.value, bands) : null;
        if (band) {
            value.fill = fill(BAND_FILL[band]);
            value.font = font({ bold: true, color: { argb: BAND_INK[band] } });
        }
        if (kind === 'text' && !item.note) sheet.mergeCells(at, 2, at, 3);
        sheet.getRow(at).height = LINE_HEIGHT + HEADER_PADDING;
    });
    return row + items.length;
}

/** A wrapped paragraph merged over `span` columns, its height estimated from `widthChars` (merged cells never auto-fit). */
export function paragraphRow(sheet: ExcelJS.Worksheet, row: number, text: string, span: number, widthChars: number): number {
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    cell.font = font();
    cell.alignment = { vertical: 'top', wrapText: true, indent: 1 };
    mergeRow(sheet, row, span);
    const lines = text.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(1, widthChars - 4))), 0);
    sheet.getRow(row).height = lines * LINE_HEIGHT + 4;
    return row + 1;
}

export const CONFIDENTIAL_BANNER = 'RAHASIA — berisi nama penilai. Jangan diteruskan.';
/** Header row of every raw-data table (row 1 = confidential banner, row 2 = survey line). */
export const RAW_HEADER_ROW = 3;

export type SheetIntro = { name: string; tab: XlTab; title: string; subtitle: string; simulation?: string | null; span: number };

/** Report sheet with its title block; returns the sheet and the first free row. */
export function startReportSheet(workbook: ExcelJS.Workbook, intro: SheetIntro): { sheet: ExcelJS.Worksheet; row: number } {
    const sheet = addReportSheet(workbook, intro.name, intro.tab);
    return { sheet, row: titleBlock(sheet, intro) };
}

/** Raw-data sheet: red confidential banner, the survey line, the table header at RAW_HEADER_ROW. */
export function startRawSheet(workbook: ExcelJS.Workbook, name: string, subtitle: string, span: number): ExcelJS.Worksheet {
    const sheet = addReportSheet(workbook, name, 'raw', true);
    bannerRow(sheet, 1, CONFIDENTIAL_BANNER, 'confidential', span);
    noteRow(sheet, 2, subtitle, span);
    return sheet;
}
