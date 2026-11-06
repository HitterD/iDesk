import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { CSI_ORG_SHEET, collapse, normalizeNik } from './csi-org.constants';

export type CsiOrgRow = {
    nik: string; fullName: string; division: string | null; department: string | null; bagian: string | null;
    jobTitle: string | null; jobLevel: string | null; workLocation: string | null;
};

/** Header names of the sheet (matched case/space-insensitively, so column moves do not break the import). */
const HEADERS = {
    nik: 'NIK', fullName: 'Nama Karyawan', division: 'Division', department: 'Department', bagian: 'Bagian',
    jobTitle: 'Nama Jabatan', jobLevel: 'Level Jabatan', workLocation: 'Work Location',
} as const;
type Field = keyof typeof HEADERS;
const FIELD_MAX: Record<Field, number> = {
    nik: 20, fullName: 150, division: 100, department: 100, bagian: 150, jobTitle: 150, jobLevel: 50, workLocation: 50,
};

const headerKey = (value: unknown) => collapse(String(value ?? '')).toLowerCase();

/** Rich text / formula / shared-string cells → plain text. */
function cellText(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        if ('richText' in value) return value.richText.map((part) => part.text).join('');
        if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
        if ('text' in value) return String(value.text);
        if (value instanceof Date) return value.toISOString();
        return '';
    }
    return String(value);
}

const text = (value: ExcelJS.CellValue, max: number) => collapse(cellText(value)).slice(0, max) || null;

/**
 * Streams the "4. ALL DATA_SJA" sheet (the workbook is ~4.5 MB and 18 sheets, so it is never loaded whole) and returns
 * one row per NIK (the last row wins). Rows without NIK or name are skipped and counted.
 */
export async function readOrgWorkbook(buffer: Buffer): Promise<{ rows: CsiOrgRow[]; skipped: number }> {
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(buffer), {
        sharedStrings: 'cache', worksheets: 'emit', hyperlinks: 'ignore', styles: 'ignore', entries: 'emit',
    });
    const byNik = new Map<string, CsiOrgRow>();
    let skipped = 0;
    let found = false;
    for await (const sheet of reader) {
        const name = (sheet as unknown as { name?: string }).name;
        let columns: Partial<Record<Field, number>> | null = null;
        for await (const row of sheet as AsyncIterable<ExcelJS.Row>) {
            if (name !== CSI_ORG_SHEET) continue;
            const values = row.values as ExcelJS.CellValue[];
            if (!columns) {
                columns = headerColumns(values);
                continue;
            }
            const read = (field: Field) => (columns![field] ? text(values[columns![field]!], FIELD_MAX[field]) : null);
            const nik = normalizeNik(cellText(values[columns.nik ?? 0]));
            const fullName = read('fullName');
            if (!nik || !fullName) { skipped += 1; continue; }
            byNik.set(nik, {
                nik, fullName, division: read('division'), department: read('department'), bagian: read('bagian'),
                jobTitle: read('jobTitle'), jobLevel: read('jobLevel'), workLocation: read('workLocation'),
            });
        }
        if (name === CSI_ORG_SHEET) found = true;
    }
    if (!found) throw new Error(`Sheet "${CSI_ORG_SHEET}" tidak ditemukan`);
    return { rows: [...byNik.values()], skipped };
}

function headerColumns(values: ExcelJS.CellValue[]): Partial<Record<Field, number>> {
    const index = new Map<string, number>();
    values.forEach((value, position) => {
        const key = headerKey(cellText(value));
        if (key && !index.has(key)) index.set(key, position);
    });
    const columns = Object.fromEntries((Object.keys(HEADERS) as Field[])
        .map((field) => [field, index.get(headerKey(HEADERS[field]))])
        .filter(([, position]) => position !== undefined)) as Partial<Record<Field, number>>;
    if (!columns.nik || !columns.fullName) throw new Error('Kolom "NIK" dan "Nama Karyawan" wajib ada di baris pertama');
    return columns;
}
