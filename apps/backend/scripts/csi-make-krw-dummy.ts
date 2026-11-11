/**
 * Generates a dummy HC assignment workbook for Karawang (list layout) to demo the template import locally.
 *
 *   npx ts-node scripts/csi-make-krw-dummy.ts [output.xlsx]
 *
 * Read-only against the database in .env: raters are real active KRW accounts picked by name, so the import shows
 * every rater status. Deliberate traps for the demo:
 * - PIC "NOVITASARI SITANGANG" is a typo of a KRW HC staff name (unresolved → rename suggestion);
 * - PIC "RINA KARTIKA DEWI" is new HC staff without directory entry or account (unresolved → "PIC baru");
 * - "Tim Payroll KRW" (HC Comben) is a custom team with three members on the "Tim" sheet;
 * - two rater names are misspelled (Belum punya akun, with account suggestions) and one is shared by several
 *   active accounts (Nama ganda).
 * The workbook is demo data: never commit it and never import it into production.
 */
import 'dotenv/config';
import * as ExcelJS from 'exceljs';
import { homedir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';

const SITE_CODE = 'KRW';
const DEFAULT_OUTPUT = join(homedir(), 'Downloads', 'CSI HC 2026 (karawang - dummy).xlsx');
const RATERS_PER_PIC = 8;
/** Raters whose NIK is written on the employee sheet, so they import as "Terkonfirmasi". */
const RATERS_WITH_NIK = 10;
const AMBIGUOUS_MIN_ACCOUNTS = 2;
const LIST_HEADERS = ['Area', 'Nama Lengkap Karyawan (HC)', 'Jabatan', 'Fungsi pelayanan', 'Nama Lengkap Penilai',
    'Jabatan (akan terisi otomatis)', 'NIK Penilai'];

type PicSpec = { area: string; name: string; jobTitle: string; serviceFunction: string; nik: string | null };
type Account = { fullName: string; jobTitle: string | null; employeeId: string | null };

/** Existing KRW HC staff (HCBP AREA KARAWANG in the directory) plus the two deliberate unresolved names. */
const PICS: PicSpec[] = [
    { area: 'HC Services', name: 'DODO SUKMANATA', jobTitle: 'HC SERVICES AREA ASST MANAGER', serviceFunction: 'General Affair · Security', nik: '00042041' },
    { area: 'HC Services', name: 'RINA KARTIKA DEWI', jobTitle: 'HC SERVICES STAFF', serviceFunction: 'Kantin · Transportasi', nik: null },
    { area: 'HC Development', name: 'VARRA VARIANSYAH', jobTitle: 'HC DEVELOPMENT AREA SUPERVISOR', serviceFunction: 'Training · Rekrutmen', nik: '00031126' },
    { area: 'HC Comben', name: 'NOVITASARI SITANGANG', jobTitle: 'COMPENSATION & BENEFIT SUPERVISOR', serviceFunction: 'Compensation & Benefit', nik: null },
    { area: 'HC Comben', name: 'Tim Payroll KRW', jobTitle: '', serviceFunction: 'Payroll · BPJS · Lembur', nik: null },
];
const TEAM = { name: 'Tim Payroll KRW', members: [
    { name: 'VINKA RIZQI AMALIA', nik: '00044015' }, { name: 'LYDIA MAULIA PUTRI', nik: '00056162' }, { name: 'ADELIA ANDRIANI', nik: '00056298' },
] };
const HC_NAMES = new Set([...PICS.map((pic) => pic.name.toUpperCase()), ...TEAM.members.map((member) => member.name), 'NOVITASARI SITANGGANG']);

/** Swaps two inner letters: a realistic typo that stays close enough for the account suggestions. */
function misspell(name: string): string {
    let index = Math.max(1, Math.floor(name.length / 2) - 1);
    // Never swap across a space: "NANANG EFEND IHIDAYAT" reads as a different word split, not a typo.
    while (index < name.length - 2 && (name[index] === ' ' || name[index + 1] === ' ')) index += 1;
    return name.slice(0, index) + name[index + 1] + name[index] + name.slice(index + 2);
}

async function loadAccounts(db: DataSource) {
    const unique: Account[] = await db.query(`
        SELECT MIN(u."fullName") AS "fullName", MIN(u."jobTitle") AS "jobTitle", MIN(u."employeeId") AS "employeeId"
        FROM users u JOIN sites s ON s.id = u."siteId"
        WHERE s.code = $1 AND u."isActive" AND u."jobTitle" IS NOT NULL AND u."employeeId" ~ '^[0-9]+$'
        GROUP BY UPPER(TRIM(u."fullName"))
        HAVING (SELECT COUNT(*) FROM users o WHERE o."isActive" AND UPPER(TRIM(o."fullName")) = UPPER(TRIM(MIN(u."fullName")))) = 1
        ORDER BY MIN(u."employeeId") LIMIT 200`, [SITE_CODE]);
    const [ambiguous] = await db.query(`
        SELECT UPPER(TRIM(u."fullName")) AS "fullName" FROM users u JOIN sites s ON s.id = u."siteId"
        WHERE s.code = $1 AND u."isActive" GROUP BY 1 HAVING COUNT(*) >= $2 ORDER BY COUNT(*) DESC, 1 LIMIT 1`, [SITE_CODE, AMBIGUOUS_MIN_ACCOUNTS]);
    return { unique: unique.filter((account) => !HC_NAMES.has(account.fullName.trim().toUpperCase())), ambiguous: ambiguous?.fullName as string | undefined };
}

/** Evenly spaced accounts across the list, so raters come from many departments rather than one NIK range. */
function pickRaters(accounts: Account[], count: number): Account[] {
    const step = Math.max(1, Math.floor(accounts.length / count));
    return Array.from({ length: count }, (_value, index) => accounts[(index * step) % accounts.length]);
}

function addSheet(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: Array<Array<string | null>>) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((column) => { column.width = 32; });
}

function listRows(raters: Account[], typos: string[], ambiguous: string | undefined): Array<Array<string | null>> {
    const pool = [...raters.map((rater) => rater.fullName), ...typos, ...(ambiguous ? [ambiguous] : [])];
    const rows: Array<Array<string | null>> = [];
    PICS.forEach((pic, picIndex) => {
        // The last PIC also gets the remainder, so every picked rater appears exactly once.
        const end = picIndex === PICS.length - 1 ? pool.length : (picIndex + 1) * RATERS_PER_PIC;
        pool.slice(picIndex * RATERS_PER_PIC, end).forEach((rater, index) => rows.push(index === 0
            ? [pic.area, pic.name, pic.jobTitle || null, pic.serviceFunction, rater, null, null]
            : [null, null, null, null, rater, null, null]));
    });
    return rows;
}

async function main() {
    const output = process.argv[2] ?? DEFAULT_OUTPUT;
    const db = new DataSource({
        type: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
    });
    await db.initialize();
    try {
        console.log(`Membaca akun ${SITE_CODE} dari ${process.env.DB_HOST}/${process.env.DB_DATABASE} (hanya baca)`);
        const { unique, ambiguous } = await loadAccounts(db);
        const raters = pickRaters(unique, PICS.length * RATERS_PER_PIC - 3);
        const typoSources = pickRaters(unique.filter((account) => !raters.includes(account)), 2);
        const typos = typoSources.map((account) => misspell(account.fullName.trim().toUpperCase()));
        const workbook = new ExcelJS.Workbook();
        addSheet(workbook, 'List Penilai 2026', LIST_HEADERS, listRows(raters, typos, ambiguous));
        addSheet(workbook, 'Tim', ['Nama Tim', 'Anggota', 'NIK'], TEAM.members.map((member, index) => [index === 0 ? TEAM.name : null, member.name, member.nik]));
        addSheet(workbook, `Karyawan ${SITE_CODE}`, ['Nama', 'Jabatan', 'NIK'], [
            ...PICS.filter((pic) => pic.nik).map((pic) => [pic.name, pic.jobTitle, pic.nik]),
            ...raters.map((rater, index) => [rater.fullName, rater.jobTitle, index < RATERS_WITH_NIK ? rater.employeeId : null]),
        ]);
        await workbook.xlsx.writeFile(output);
        console.log(`Tertulis: ${output}`);
        console.log(`PIC ${PICS.length} (termasuk tim), penilai ${raters.length + typos.length + (ambiguous ? 1 : 0)}`);
        console.log(`Salah ketik: ${typos.map((typo, index) => `${typo} (← ${typoSources[index].fullName})`).join(', ')}`);
        console.log(`Nama ganda: ${ambiguous ?? '(tidak ada di ' + SITE_CODE + ')'}`);
    } finally {
        await db.destroy();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
