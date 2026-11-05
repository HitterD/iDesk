/** Reading rater lists (emails / NIKs) from pasted text or an uploaded Excel / CSV file. */

const SEPARATORS = /[\n\r,;\t]+/;
const HEADER = /^(e-?mail|nik|nip|employee ?id|no\.? ?induk)$/i;
export const RATER_IMPORT_MAX = 2000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const KEY_COLUMN = /^(e-?mail|nik|nip|employee ?id)$/i;

/** Distinct non-empty keys, header words ("Email", "NIK") dropped, quotes trimmed. */
export function parseRaterKeys(text: string): string[] {
    const keys = text.split(SEPARATORS).map((part) => part.trim().replace(/^["']|["']$/g, '')).filter((part) => part && !HEADER.test(part));
    return [...new Set(keys)].slice(0, RATER_IMPORT_MAX);
}

/**
 * Keys from a spreadsheet: the "Email"/"NIK" columns when a header row names them, otherwise the first column.
 * CSV/TXT files are read as text.
 */
export async function readRaterFile(file: File): Promise<string[]> {
    if (file.size > MAX_FILE_BYTES) throw new Error('File maksimal 5 MB');
    if (/\.(csv|txt)$/i.test(file.name)) return parseRaterKeys(await file.text());
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('File tidak berisi sheet');
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const header = (rows[0] ?? []).map((cell) => String(cell ?? '').trim());
    const columns = header.flatMap((cell, index) => (KEY_COLUMN.test(cell) ? [index] : []));
    const body = columns.length ? rows.slice(1) : rows;
    const picked = body.flatMap((row) => (columns.length ? columns : [0]).map((index) => String(row?.[index] ?? '')));
    const keys = parseRaterKeys(picked.join('\n'));
    if (!keys.length) throw new Error('Tidak ada email atau NIK yang terbaca di file ini');
    return keys;
}
