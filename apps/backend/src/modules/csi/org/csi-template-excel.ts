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
    workbook.getWorksheet(EMPLOYEE_SHEET)?.eachRow((row, number) => {
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
    const columns = columnsOf(sheet);
    const titles = employeeTitles(workbook);
    const pics: CsiTemplateSeedPic[] = [];
    const problems: CsiTemplateDraft['problems'] = [];
    let area: string | null = null;
    let current: CsiTemplateSeedPic | null = null;
    sheet.eachRow((row, number) => {
        if (number === 1) return;
        const values = row.values as ExcelJS.CellValue[];
        area = clean(values[columns.area]) ?? area;
        const picName = clean(values[columns.pic]);
        if (picName) {
            const serviceCode = CSI_TEMPLATE_AREA_SERVICE[(area ?? '').toUpperCase()];
            if (!serviceCode) {
                problems.push({ row: number, message: `Area "${area ?? ''}" bukan HC Development / HC Comben / HC Services` });
                current = null;
                return;
            }
            const name = normalizeName(picName);
            current = {
                area: area!, serviceCode, picName: name, jobTitle: titles.get(name) ?? clean(values[columns.jobTitle]),
                serviceFunction: clean(values[columns.serviceFunction]), raters: [],
            };
            pics.push(current);
        }
        const rater = clean(values[columns.rater]);
        if (!rater || !current) return;
        const name = normalizeName(rater);
        if (current.raters.some((entry) => entry.name === name)) return;
        current.raters.push({ name, jobTitle: titles.get(name) ?? clean(values[columns.raterJobTitle]) });
    });
    return { pics, problems };
}
