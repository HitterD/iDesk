import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { normalizeName } from './csi-name-match';

/** "Area" column of the HC assignment workbook → layanan code. */
export const CSI_TEMPLATE_AREA_SERVICE: Readonly<Record<string, string>> = {
    'HC DEVELOPMENT': 'HCD', 'HC COMBEN': 'HCC', 'HC COMPENSATION & BENEFIT': 'HCC', 'HC SERVICES': 'HCS',
};
const HEADERS = { area: 'area', pic: 'nama lengkap karyawan (hc)', jobTitle: 'jabatan', serviceFunction: 'fungsi pelayanan', rater: 'nama lengkap penilai', raterJobTitle: 'jabatan (akan terisi otomatis)' } as const;
const EMPLOYEE_SHEET = 'Karyawan SMG';
const ROWS_MAX = 20000;
const EMPTY_VALUES = new Set(['', '#N/A']);

export type CsiTemplateSeedRater = { name: string; jobTitle: string | null };
export type CsiTemplateSeedPic = {
    area: string; serviceCode: string; picName: string; jobTitle: string | null; serviceFunction: string | null; raters: CsiTemplateSeedRater[];
};
export type CsiTemplateSeed = { scope: 'HC'; locationCode: string; name: string; pics: CsiTemplateSeedPic[] };
export type CsiTemplateDraft = { pics: CsiTemplateSeedPic[]; problems: Array<{ row: number; message: string }> };

const cellText = (value: ExcelJS.CellValue): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        if ('richText' in value) return value.richText.map((part) => part.text).join('');
        if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
        if ('text' in value) return String(value.text);
        if ('error' in value) return '';
        return '';
    }
    return String(value);
};
const clean = (value: ExcelJS.CellValue): string | null => {
    const text = cellText(value).replace(/\s+/g, ' ').trim();
    return EMPTY_VALUES.has(text) ? null : text;
};

async function load(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    try {
        // exceljs types its Buffer differently from Node 22+ (ArrayBufferLike); the runtime value is the same.
        await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
        throw new BadRequestException('File Excel tidak bisa dibaca');
    }
    return workbook;
}

/** Job title per employee name from the optional "Karyawan SMG"-style sheet (name, title). */
function employeeTitles(workbook: ExcelJS.Workbook) {
    const titles = new Map<string, string>();
    const sheet = workbook.getWorksheet(EMPLOYEE_SHEET);
    if (sheet && sheet.rowCount - 1 > ROWS_MAX) throw new BadRequestException(`Maksimal ${ROWS_MAX} baris per sheet`);
    sheet?.eachRow((row, number) => {
        if (number === 1) return;
        const values = row.values as ExcelJS.CellValue[];
        const name = clean(values[1]);
        const title = clean(values[2]);
        if (name && title) titles.set(normalizeName(name), title);
    });
    return titles;
}

function columnsOf(sheet: ExcelJS.Worksheet) {
    const header = (sheet.getRow(1).values as ExcelJS.CellValue[]).map((value) => cellText(value).replace(/\s+/g, ' ').trim().toLowerCase());
    const columns = Object.fromEntries(Object.entries(HEADERS).map(([key, label]) => [key, header.indexOf(label)])) as Record<keyof typeof HEADERS, number>;
    if (columns.pic < 1 || columns.rater < 1 || columns.area < 1) {
        throw new BadRequestException('Kolom "Area", "Nama Lengkap Karyawan (HC)" dan "Nama Lengkap Penilai" wajib ada di baris pertama');
    }
    return columns;
}

/** Longest text the template tables store (varchar(150)). */
const TEXT_MAX = 150;
type ParseState = {
    columns: Record<keyof typeof HEADERS, number>; titles: Map<string, string>;
    pics: CsiTemplateSeedPic[]; problems: CsiTemplateDraft['problems']; area: string | null; current: CsiTemplateSeedPic | null;
};

/** First value longer than the column allows, as a row problem (the row is then skipped). */
function tooLong(state: ParseState, row: number, fields: Array<[string, string | null]>): boolean {
    const field = fields.find(([, value]) => (value ?? '').length > TEXT_MAX);
    if (field) state.problems.push({ row, message: `${field[0]} lebih dari ${TEXT_MAX} karakter` });
    return !!field;
}

/** A row that names a PIC starts (or continues) that PIC; the area carries down from the rows above. */
function readPic(state: ParseState, values: ExcelJS.CellValue[], row: number, picName: string) {
    const { columns, titles } = state;
    const serviceCode = CSI_TEMPLATE_AREA_SERVICE[(state.area ?? '').toUpperCase()];
    if (!serviceCode) {
        state.problems.push({ row, message: `Area "${state.area ?? ''}" bukan HC Development / HC Comben / HC Services` });
        state.current = null;
        return;
    }
    const name = normalizeName(picName);
    const jobTitle = titles.get(name) ?? clean(values[columns.jobTitle]);
    const serviceFunction = clean(values[columns.serviceFunction]);
    if (tooLong(state, row, [['Nama PIC', name], ['Jabatan', jobTitle], ['Fungsi pelayanan', serviceFunction]])) {
        state.current = null;
        return;
    }
    // A PIC written twice in the file continues the first block (one PIC, raters of both).
    state.current = state.pics.find((pic) => pic.picName === name) ?? null;
    if (state.current) return;
    state.current = { area: state.area!, serviceCode, picName: name, jobTitle, serviceFunction, raters: [] };
    state.pics.push(state.current);
}

function readRow(state: ParseState, values: ExcelJS.CellValue[], row: number) {
    const { columns, titles } = state;
    state.area = clean(values[columns.area]) ?? state.area;
    const picName = clean(values[columns.pic]);
    if (picName) readPic(state, values, row, picName);
    const rater = clean(values[columns.rater]);
    if (!rater || !state.current) return;
    const name = normalizeName(rater);
    const jobTitle = titles.get(name) ?? clean(values[columns.raterJobTitle]);
    if (tooLong(state, row, [['Nama penilai', name], ['Jabatan penilai', jobTitle]])) return;
    if (state.current.raters.some((entry) => entry.name === name)) return;
    state.current.raters.push({ name, jobTitle });
}

/**
 * Reads the HC assignment workbook (layout of "CSI HC 2026 (semarang).xlsx"): one row per rater; the area and PIC
 * name are written on the PIC's first row only and carry down. Names are stored upper case; a rater listed twice
 * for one PIC counts once; a PIC without raters is kept (new staff, raters added later).
 */
export async function parseTemplateWorkbook(buffer: Buffer): Promise<CsiTemplateDraft> {
    const workbook = await load(buffer);
    const sheet = workbook.worksheets.find((candidate) => candidate.name !== EMPLOYEE_SHEET) ?? workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Sheet tidak ditemukan');
    if (sheet.rowCount - 1 > ROWS_MAX) throw new BadRequestException(`Maksimal ${ROWS_MAX} baris`);
    const state: ParseState = { columns: columnsOf(sheet), titles: employeeTitles(workbook), pics: [], problems: [], area: null, current: null };
    sheet.eachRow((row, number) => { if (number > 1) readRow(state, row.values as ExcelJS.CellValue[], number); });
    const { pics, problems } = state;
    return { pics, problems };
}
