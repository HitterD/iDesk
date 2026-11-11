import * as ExcelJS from 'exceljs';
import { addStyledSheet, ColumnSpec, sanitizeCell } from '../services/csi-export.sheet';
import { TEMPLATE_EMPLOYEE_HEADERS, TEMPLATE_EMPLOYEE_SHEET_PREFIX, TEMPLATE_GUIDE_SHEET, TEMPLATE_LIST_HEADERS, TEMPLATE_RATER_NIK_HEADER,
    TEMPLATE_TEAM_HEADERS, TEMPLATE_TEAM_SHEET } from './csi-template-excel';
import { CsiTemplateLocation } from './csi-template-locations';

/** Same sheet name as the 2026 Semarang file, so a filled-in blank looks like the original. */
const LIST_SHEET = 'List Penilai 2026';
const WIDTH = { short: 18, name: 32, title: 30, nik: 16, guide: 110 } as const;
const LIST_COLUMNS: ColumnSpec[] = [
    { header: TEMPLATE_LIST_HEADERS.area, width: WIDTH.short }, { header: TEMPLATE_LIST_HEADERS.pic, width: WIDTH.name },
    { header: TEMPLATE_LIST_HEADERS.jobTitle, width: WIDTH.title }, { header: TEMPLATE_LIST_HEADERS.serviceFunction, width: WIDTH.title },
    { header: TEMPLATE_LIST_HEADERS.rater, width: WIDTH.name }, { header: TEMPLATE_LIST_HEADERS.raterJobTitle, width: WIDTH.title },
    { header: TEMPLATE_RATER_NIK_HEADER, width: WIDTH.nik },
];
const TEAM_COLUMNS: ColumnSpec[] = [
    { header: TEMPLATE_TEAM_HEADERS.team, width: WIDTH.name }, { header: TEMPLATE_TEAM_HEADERS.member, width: WIDTH.name },
    { header: TEMPLATE_TEAM_HEADERS.nik, width: WIDTH.nik },
];
const EMPLOYEE_WIDTHS = [WIDTH.name, WIDTH.title, WIDTH.nik];

export type CsiBlankTemplateEmployee = { fullName: string; jobTitle: string | null; employeeId: string | null };

/** The how-to, one line per row (kept to 10 lines or fewer). */
function guideLines(employeeSheet: string): string[] {
    return [
        `Isi sheet "${LIST_SHEET}": satu baris per penilai.`,
        `Kolom ${TEMPLATE_LIST_HEADERS.area} diisi HC Development, HC Comben atau HC Services (cukup di baris pertama PIC).`,
        `${TEMPLATE_LIST_HEADERS.pic} dan ${TEMPLATE_LIST_HEADERS.serviceFunction} cukup ditulis di baris pertama PIC; baris di bawahnya ikut PIC tersebut.`,
        `Salin nama PIC dan penilai dari sheet "${employeeSheet}" agar jabatan dan NIK terbaca otomatis.`,
        `Penilai berupa tim custom: tulis nama tim diawali "Tim" (mis. "Tim Rekrutmen") di kolom ${TEMPLATE_LIST_HEADERS.pic}.`,
        `Anggota tim custom diisi di sheet "${TEMPLATE_TEAM_SHEET}": ${TEMPLATE_TEAM_HEADERS.team}, ${TEMPLATE_TEAM_HEADERS.member}, ${TEMPLATE_TEAM_HEADERS.nik}.`,
        'Format matriks (sheet "List PIC" + "List Penilai") juga diterima.',
    ];
}

/**
 * Blank HC assignment workbook for one location: the list layout the importer reads (with the NIK Penilai column), an
 * empty team sheet, the location's active employees to copy names from, and a short how-to. Imports back as empty.
 */
export async function buildBlankTemplate(location: CsiTemplateLocation, employees: CsiBlankTemplateEmployee[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const employeeSheet = `${TEMPLATE_EMPLOYEE_SHEET_PREFIX} ${location.code}`;
    addStyledSheet(workbook, LIST_SHEET, LIST_COLUMNS, []);
    addStyledSheet(workbook, TEMPLATE_TEAM_SHEET, TEAM_COLUMNS, []);
    addStyledSheet(workbook, employeeSheet, TEMPLATE_EMPLOYEE_HEADERS.map((header, index) => ({ header, width: EMPLOYEE_WIDTHS[index] })),
        employees.map((employee) => [sanitizeCell(employee.fullName), sanitizeCell(employee.jobTitle), sanitizeCell(employee.employeeId)]));
    const guide = workbook.addWorksheet(TEMPLATE_GUIDE_SHEET);
    guide.getColumn(1).width = WIDTH.guide;
    guideLines(employeeSheet).forEach((line) => guide.addRow([line]));
    // exceljs returns its own Buffer type; the runtime value is a Node Buffer.
    return Buffer.from(await workbook.xlsx.writeBuffer());
}
