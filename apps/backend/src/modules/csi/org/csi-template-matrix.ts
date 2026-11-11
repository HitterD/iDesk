import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { normalizeName } from './csi-name-match';
import { normalizeNik } from './csi-org.constants';
import type { CsiTemplateDraft, CsiTemplateSeedPic, CsiTemplateSeedRater } from './csi-template-excel';

export const TEMPLATE_ROWS_MAX = 20000;
export const TEMPLATE_TEXT_MAX = 150;
export const TEMPLATE_NIK_MAX = 20;
const HEADER_SCAN_MAX = 10;
const GROUP_SERVICE: Readonly<Record<string, string>> = { 'HC SERVICES': 'HCS', COMBEN: 'HCC', 'HC DEVELOPMENT': 'HCD' };
const SERVICE_AREA: Readonly<Record<string, string>> = { HCS: 'HC Services', HCC: 'HC Comben', HCD: 'HC Development' };
const FUNCTION_SEPARATOR = ' · ';

/** Use cached formula results and rich text, not Excel's object string representation. */
export function templateCellText(value: ExcelJS.CellValue): string {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('result' in value) return templateCellText(value.result as ExcelJS.CellValue);
    if ('text' in value) return String(value.text);
    return '';
}
export function cleanTemplateCell(value: ExcelJS.CellValue): string | null {
    const text = templateCellText(value).replace(/\s+/g, ' ').trim();
    return text === '' || text === '#N/A' ? null : text;
}

type ServiceColumn = { index: number; name: string; serviceCode: string | null };
type MatrixPerson = CsiTemplateSeedRater & { row: number; checks: ServiceColumn[] };
function matrixColumns(sheet: ExcelJS.Worksheet) {
    for (let row = 1; row <= Math.min(HEADER_SCAN_MAX, sheet.rowCount); row++) {
        const headers = (sheet.getRow(row).values as ExcelJS.CellValue[]).map((value) => cleanTemplateCell(value)?.toUpperCase() ?? '');
        if (!headers.includes('NIK') || !headers.includes('NAMA')) continue;
        const after = headers.includes('SUM') ? headers.indexOf('SUM') : headers.indexOf('LOKASI');
        if (after < 1) throw new BadRequestException(`Kolom Sum atau LOKASI wajib ada di ${sheet.name}`);
        const services: ServiceColumn[] = [];
        let group: string | null = null;
        for (let index = after + 1; index < headers.length; index++) {
            // A header in row one has no group row; never depend on ExcelJS accepting row zero.
            const groupCell = row > 1 ? sheet.getRow(row - 1).getCell(index).value : null;
            group = cleanTemplateCell(groupCell)?.toUpperCase() ?? group;
            const name = cleanTemplateCell(sheet.getRow(row).getCell(index).value);
            if (name) services.push({ index, name, serviceCode: GROUP_SERVICE[group ?? ''] ?? null });
        }
        return { row, nik: headers.indexOf('NIK'), name: headers.indexOf('NAMA'), title: headers.indexOf('JABATAN'), services };
    }
    throw new BadRequestException(`Header NIK dan NAMA tidak ditemukan di ${sheet.name}`);
}

function matrixPeople(sheet: ExcelJS.Worksheet, problems: CsiTemplateDraft['problems']): MatrixPerson[] {
    const columns = matrixColumns(sheet);
    if (sheet.rowCount - columns.row > TEMPLATE_ROWS_MAX) throw new BadRequestException(`Maksimal ${TEMPLATE_ROWS_MAX} baris per sheet`);
    const people = new Map<string, MatrixPerson>();
    sheet.eachRow((row, number) => {
        if (number <= columns.row) return;
        const name = cleanTemplateCell(row.getCell(columns.name).value);
        if (!name) return; // Includes the spreadsheet's trailing Sum=0 rows.
        const nik = normalizeNik(cleanTemplateCell(row.getCell(columns.nik).value));
        const jobTitle = columns.title > 0 ? cleanTemplateCell(row.getCell(columns.title).value) : null;
        if ([name, jobTitle].some((value) => (value?.length ?? 0) > TEMPLATE_TEXT_MAX) || (nik?.length ?? 0) > TEMPLATE_NIK_MAX) {
            const limit = (nik?.length ?? 0) > TEMPLATE_NIK_MAX ? TEMPLATE_NIK_MAX : TEMPLATE_TEXT_MAX;
            problems.push({ row: number, message: `Identitas di ${sheet.name} lebih dari ${limit} karakter` });
            return;
        }
        const checks = columns.services.filter(({ index }) => {
            const text = cleanTemplateCell(row.getCell(index).value);
            return text !== null && text !== '0';
        });
        const key = nik ?? normalizeName(name);
        const known = people.get(key);
        const union = known ? [...known.checks, ...checks.filter((check) => !known.checks.some((entry) => entry.name === check.name))] : checks;
        people.set(key, known ? { ...known, checks: union } : { name: normalizeName(name), nik, jobTitle, checks, row: number });
    });
    return [...people.values()];
}

/** Match by service label, since the two sheets may arrange their service columns differently. */
export function parseMatrixWorkbook(workbook: ExcelJS.Workbook): CsiTemplateDraft {
    const problems: CsiTemplateDraft['problems'] = [];
    const people = matrixPeople(workbook.getWorksheet('List PIC')!, problems);
    const raters = matrixPeople(workbook.getWorksheet('List Penilai')!, problems);
    const pics: CsiTemplateSeedPic[] = [];
    for (const person of people) {
        if (!person.checks.length) continue;
        const serviceCode = person.checks[0].serviceCode;
        if (!serviceCode || person.checks.some((check) => !check.serviceCode)) {
            problems.push({ row: person.row, message: 'Grup layanan PIC tidak dikenali' });
            continue;
        }
        if (person.checks.some((check) => check.serviceCode !== serviceCode)) problems.push({ row: person.row, message: 'PIC memiliki pelayanan dari beberapa grup' });
        const serviceFunction = person.checks.map((check) => check.name).join(FUNCTION_SEPARATOR);
        if (serviceFunction.length > TEMPLATE_TEXT_MAX) {
            problems.push({ row: person.row, message: `Fungsi pelayanan lebih dari ${TEMPLATE_TEXT_MAX} karakter` });
            continue;
        }
        const matches = raters.filter((rater) => !(person.nik && rater.nik === person.nik)
            && rater.checks.some((check) => person.checks.some((entry) => entry.name === check.name)));
        pics.push({ area: SERVICE_AREA[serviceCode], serviceCode, picName: person.name, nik: person.nik, jobTitle: person.jobTitle,
            serviceFunction, raters: matches.map(({ name, jobTitle, nik }) => ({ name, jobTitle, nik })) });
    }
    return { format: 'matrix', pics, teams: [], problems };
}
