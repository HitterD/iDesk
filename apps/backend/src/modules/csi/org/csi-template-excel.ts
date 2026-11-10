import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { normalizeName } from './csi-name-match';
import { normalizeNik } from './csi-org.constants';
import { cleanTemplateCell as clean, templateCellText as cellText, parseMatrixWorkbook,
    TEMPLATE_NIK_MAX, TEMPLATE_ROWS_MAX as ROWS_MAX, TEMPLATE_TEXT_MAX as TEXT_MAX } from './csi-template-matrix';

/** "Area" column of the HC assignment workbook → layanan code. */
export const CSI_TEMPLATE_AREA_SERVICE: Readonly<Record<string, string>> = {
    'HC DEVELOPMENT': 'HCD', 'HC COMBEN': 'HCC', 'HC COMPENSATION & BENEFIT': 'HCC', 'HC SERVICES': 'HCS',
};
const HEADERS = { area: 'area', pic: 'nama lengkap karyawan (hc)', jobTitle: 'jabatan', serviceFunction: 'fungsi pelayanan', rater: 'nama lengkap penilai', raterJobTitle: 'jabatan (akan terisi otomatis)' } as const;
const isEmployeeSheet = (name: string) => /^karyawan/i.test(name);
type Employee = { jobTitle: string | null; nik: string | null };
type Columns = Record<keyof typeof HEADERS, number> & { raterNik: number };

export type CsiTemplateSeedRater = { name: string; jobTitle: string | null; nik: string | null };
export type CsiTemplateSeedPic = {
    area: string; serviceCode: string; picName: string; nik: string | null; jobTitle: string | null; serviceFunction: string | null; raters: CsiTemplateSeedRater[];
};
/** Historical bundled seeds predate NIK; parsed drafts always provide it explicitly. */
export type CsiTemplateSeed = { scope: 'HC'; locationCode: string; name: string; pics: Array<Omit<CsiTemplateSeedPic, 'nik' | 'raters'> & {
    nik?: string | null; raters: Array<Omit<CsiTemplateSeedRater, 'nik'> & { nik?: string | null }>;
}> };
export type CsiTemplateDraft = { format: 'list' | 'matrix'; pics: CsiTemplateSeedPic[];
    teams: Array<{ name: string; members: Array<{ name: string; nik: string | null }> }>;
    problems: Array<{ row: number; message: string }> };

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

/** Employee metadata is optional and independent of the site's sheet suffix. */
function employeeTitles(workbook: ExcelJS.Workbook) {
    const titles = new Map<string, Employee>();
    for (const sheet of workbook.worksheets.filter((candidate) => isEmployeeSheet(candidate.name))) {
        if (sheet.rowCount - 1 > ROWS_MAX) throw new BadRequestException(`Maksimal ${ROWS_MAX} baris per sheet`);
        sheet.eachRow((row, number) => {
            if (number === 1) return;
            const name = clean(row.getCell(1).value);
            if (name) titles.set(normalizeName(name), { jobTitle: clean(row.getCell(2).value), nik: normalizeNik(clean(row.getCell(3).value)) });
        });
    }
    return titles;
}

function readTeams(workbook: ExcelJS.Workbook, employees: Map<string, Employee>, problems: CsiTemplateDraft['problems']): CsiTemplateDraft['teams'] {
    const teams: CsiTemplateDraft['teams'] = [];
    const sheet = workbook.worksheets.find((candidate) => candidate.name.toLowerCase() === 'tim');
    if (!sheet) return teams;
    if (sheet.rowCount - 1 > ROWS_MAX) throw new BadRequestException(`Maksimal ${ROWS_MAX} baris per sheet`);
    const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).map((value) => clean(value)?.toLowerCase());
    const teamColumn = headers.indexOf('nama tim');
    const memberColumn = headers.indexOf('anggota');
    const nikColumn = headers.indexOf('nik');
    if (teamColumn < 1 || memberColumn < 1) throw new BadRequestException('Kolom Nama Tim dan Anggota wajib ada di sheet Tim');
    let current: CsiTemplateDraft['teams'][number] | undefined;
    sheet.eachRow((row, number) => {
        if (number === 1) return;
        const teamName = clean(row.getCell(teamColumn).value);
        if (teamName) {
            current = teams.find((team) => team.name === teamName);
            if (!current) { current = { name: teamName, members: [] }; teams.push(current); }
        }
        const member = clean(row.getCell(memberColumn).value);
        if (!member || !current) return;
        const name = normalizeName(member);
        const nik = (nikColumn > 0 ? normalizeNik(clean(row.getCell(nikColumn).value)) : null) ?? employees.get(name)?.nik ?? null;
        if ([current.name, name, nik].some((value) => (value?.length ?? 0) > TEXT_MAX)) {
            problems.push({ row: number, message: `Identitas tim lebih dari ${TEXT_MAX} karakter` });
            return;
        }
        current.members.push({ name, nik });
    });
    return teams;
}

function columnsOf(sheet: ExcelJS.Worksheet) {
    const header = (sheet.getRow(1).values as ExcelJS.CellValue[]).map((value) => cellText(value).replace(/\s+/g, ' ').trim().toLowerCase());
    const columns = Object.fromEntries(Object.entries(HEADERS).map(([key, label]) => [key, header.indexOf(label)])) as Record<keyof typeof HEADERS, number>;
    if (columns.pic < 1 || columns.rater < 1 || columns.area < 1) {
        throw new BadRequestException('Kolom "Area", "Nama Lengkap Karyawan (HC)" dan "Nama Lengkap Penilai" wajib ada di baris pertama');
    }
    return { ...columns, raterNik: header.findIndex((label) => label === 'nik hris (dikosongkan saja)' || label === 'nik penilai') };
}

type ParseState = {
    columns: Columns; titles: Map<string, Employee>;
    pics: CsiTemplateSeedPic[]; problems: CsiTemplateDraft['problems']; area: string | null; current: CsiTemplateSeedPic | null;
};

/** First value longer than the column allows, as a row problem (the row is then skipped). */
function tooLong(state: ParseState, row: number, fields: Array<[string, string | null]>): boolean {
    const limitOf = (label: string) => label.startsWith('NIK') ? TEMPLATE_NIK_MAX : TEXT_MAX;
    const field = fields.find(([label, value]) => (value ?? '').length > limitOf(label));
    if (field) state.problems.push({ row, message: `${field[0]} lebih dari ${limitOf(field[0])} karakter` });
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
    const jobTitle = titles.get(name)?.jobTitle ?? clean(values[columns.jobTitle]);
    const nik = titles.get(name)?.nik ?? null;
    const serviceFunction = clean(values[columns.serviceFunction]);
    if (tooLong(state, row, [['Nama PIC', name], ['Jabatan', jobTitle], ['Fungsi pelayanan', serviceFunction], ['NIK PIC', nik]])) {
        state.current = null;
        return;
    }
    // A PIC written twice in the file continues the first block (one PIC, raters of both).
    state.current = state.pics.find((pic) => pic.picName === name) ?? null;
    if (state.current) return;
    state.current = { area: state.area!, serviceCode, picName: name, nik, jobTitle, serviceFunction, raters: [] };
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
    const jobTitle = titles.get(name)?.jobTitle ?? clean(values[columns.raterJobTitle]);
    const nik = normalizeNik(clean(values[columns.raterNik])) ?? titles.get(name)?.nik ?? null;
    if (tooLong(state, row, [['Nama penilai', name], ['Jabatan penilai', jobTitle], ['NIK penilai', nik]])) return;
    if (state.current.raters.some((entry) => entry.name === name)) return;
    state.current.raters.push({ name, jobTitle, nik });
}

/**
 * Reads the HC assignment workbook (layout of "CSI HC 2026 (semarang).xlsx"): one row per rater; the area and PIC
 * name are written on the PIC's first row only and carry down. Names are stored upper case; a rater listed twice
 * for one PIC counts once; a PIC without raters is kept (new staff, raters added later).
 */
export async function parseTemplateWorkbook(buffer: Buffer): Promise<CsiTemplateDraft> {
    const workbook = await load(buffer);
    const titles = employeeTitles(workbook);
    if (workbook.getWorksheet('List PIC') && workbook.getWorksheet('List Penilai')) {
        const draft = parseMatrixWorkbook(workbook);
        return { ...draft, teams: readTeams(workbook, titles, draft.problems) };
    }
    const sheet = workbook.worksheets.find((candidate) => !isEmployeeSheet(candidate.name) && !/^(tim|petunjuk)$/i.test(candidate.name));
    if (!sheet) throw new BadRequestException('Sheet tidak ditemukan');
    if (sheet.rowCount - 1 > ROWS_MAX) throw new BadRequestException(`Maksimal ${ROWS_MAX} baris`);
    const state: ParseState = { columns: columnsOf(sheet), titles, pics: [], problems: [], area: null, current: null };
    sheet.eachRow((row, number) => { if (number > 1) readRow(state, row.values as ExcelJS.CellValue[], number); });
    const { pics, problems } = state;
    return { format: 'list', pics, teams: readTeams(workbook, titles, problems), problems };
}
