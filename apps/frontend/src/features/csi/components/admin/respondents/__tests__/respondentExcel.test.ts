import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '../../../../lib/format';
import type { CsiSiteSummary } from '../../../../types';
import {
    buildRekapSheetData,
    buildRespondentsSheetData,
    exportRespondentsExcel,
    respondentsExportFilename,
    sanitizeExcelCell,
} from '../respondentExcel';
import { personRows } from '../respondentModel';

const fx = vi.hoisted(() => ({
    downloadBlob: vi.fn(),
}));
vi.mock('../../../../lib/csiAdmin', () => ({ downloadBlob: fx.downloadBlob }));

const SITES: CsiSiteSummary[] = [
    { id: 's-spj', code: 'SPJ', name: 'Sepanjang', handledBySiteId: null },
    { id: 's-skd', code: 'SKD', name: 'Sukodono', handledBySiteId: 's-spj' },
];

describe('respondentExcel', () => {
    afterEach(() => vi.clearAllMocks());

    it('sanitizes formula-like cell prefixes', () => {
        expect(sanitizeExcelCell('=CMD()')).toBe("'=CMD()");
        expect(sanitizeExcelCell('+123')).toBe("'+123");
        expect(sanitizeExcelCell('-123')).toBe("'-123");
        expect(sanitizeExcelCell('@SUM(A1)')).toBe("'@SUM(A1)");
        expect(sanitizeExcelCell('Budi Santoso')).toBe('Budi Santoso');
    });

    it('builds Ringkasan summary per site with totals and percentage cells', () => {
        const rows = personRows({
            mode: 'LISTED',
            submitted: [{
                responseId: 'r1',
                userId: 'u9',
                respondentName: 'Rina',
                accountName: 'rina@sja.com',
                departmentName: 'Finance',
                siteId: 's-spj',
                submittedAt: '2026-10-20T05:00:00Z',
            }],
            pending: [
                { userId: 'u1', fullName: 'Andi', department: 'Gudang', siteId: 's-skd' },
                { userId: 'u2', fullName: 'Budi', department: 'IT', siteId: 's-spj' },
            ],
            totals: { submitted: 1, pending: 2 },
        });

        const rekap = buildRekapSheetData(rows, SITES, {
            scope: 'ict',
            periodTitle: 'Survei CSI ICT',
            now: new Date('2026-11-17T08:00:00Z'),
            link: 'idesk.santos.co.id',
        });

        expect(rekap[0]).toEqual(['REKAPITULASI PROGRES PENGISIAN SURVEI CSI ICT']);
        expect(rekap[2]).toEqual(['Link Pengisian Survei:', 'idesk.santos.co.id']);
        expect(rekap[4]).toEqual(['Site', 'Total Responden', 'Sudah Mengisi', 'Belum Mengisi', 'Persentase Selesai', 'Link Pengisian']);
        expect(rekap[5]).toEqual(['SKD', 1, 0, 1, { t: 'n', v: 0, z: '0.0%' }, 'idesk.santos.co.id']);
        expect(rekap[6]).toEqual(['SPJ', 2, 1, 1, { t: 'n', v: 0.5, z: '0.0%' }, 'idesk.santos.co.id']);
        expect(rekap[7]).toEqual(['TOTAL', 3, 1, 2, { t: 'n', v: 1 / 3, z: '0.0%' }, 'idesk.santos.co.id']);
    });

    it('sorts respondents by site, pending-first, then name and preserves formula sanitization', () => {
        const rows = personRows({
            mode: 'LISTED',
            submitted: [{
                responseId: 'r1',
                userId: 'u9',
                respondentName: 'Rina',
                accountName: 'rina@sja.com',
                departmentName: 'Finance',
                siteId: 's-spj',
                submittedAt: '2026-10-20T05:00:00Z',
            }],
            pending: [
                { userId: 'u2', fullName: 'Zaki', department: 'IT', siteId: 's-spj' },
                { userId: 'u1', fullName: '=Andi', department: 'Gudang', siteId: 's-skd' },
            ],
            totals: { submitted: 1, pending: 2 },
        });

        const table = buildRespondentsSheetData(rows, SITES, {
            scope: 'ict',
            periodTitle: 'Survei CSI ICT',
            link: 'idesk.santos.co.id',
        });
        expect(table[0]).toEqual(['DAFTAR RESPONDEN SURVEI CSI ICT — SEMUA SITE (TERURUT PER SITE)']);
        expect(table[1]).toEqual(['Link Pengisian:', 'idesk.santos.co.id', '', '', 'Total: 3 | Sudah: 1 | Belum: 2']);
        expect(table[3]).toEqual(['No', 'Nama Responden', 'Site', 'Departemen', 'Status', 'Waktu Mengisi', 'Link Pengisian']);
        expect(table.slice(4)).toEqual([
            [1, "'=Andi", 'SKD', 'Gudang', 'Belum', '-', 'idesk.santos.co.id'],
            [2, 'Zaki', 'SPJ', 'IT', 'Belum', '-', 'idesk.santos.co.id'],
            [3, 'Rina', 'SPJ', 'Finance', 'Sudah mengisi', formatDateTime('2026-10-20T05:00:00Z'), 'idesk.santos.co.id'],
        ]);
    });

    it('exports styled multi-sheet workbook matching the reference palette, tab names, freezes, filters, and formulas', async () => {
        const submittedIso = '2026-11-17T01:36:00Z';
        const rows = personRows({
            mode: 'LISTED',
            submitted: [
                {
                    responseId: 'r1',
                    userId: 'u3',
                    respondentName: 'Rina',
                    accountName: 'rina@sja.com',
                    departmentName: 'Finance',
                    siteId: 's-spj',
                    submittedAt: submittedIso,
                },
            ],
            pending: [
                { userId: 'u1', fullName: 'Budi', department: 'IT', siteId: 's-spj' },
                { userId: 'u2', fullName: 'Citra', department: 'QA', siteId: 's-skd' },
            ],
            totals: { submitted: 1, pending: 2 },
        });

        const filename = await exportRespondentsExcel({
            rows,
            sites: SITES,
            scope: 'ict',
            periodTitle: 'Survei CSI - ICT',
            suffix: 'belum-SPJ',
            now: new Date('2026-11-17T08:00:00Z'),
        });

        expect(filename).toMatch(/^responden-survei-csi-ict-belum-spj-\d{4}-\d{2}-\d{2}\.xlsx$/);
        expect(fx.downloadBlob).toHaveBeenCalledTimes(1);
        const [blob, savedName] = fx.downloadBlob.mock.calls[0];
        expect(savedName).toBe(filename);
        expect(blob).toBeInstanceOf(Blob);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await (blob as Blob).arrayBuffer());

        expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
            'Ringkasan',
            'Semua Responden',
            'Site SKD',
            'Site SPJ',
        ]);

        const ringkasan = workbook.getWorksheet('Ringkasan')!;
        expect(ringkasan.getCell('A1').value).toBe('REKAPITULASI PROGRES PENGISIAN SURVEI CSI - ICT');
        expect(ringkasan.getCell('A1').font?.size).toBe(14);
        expect(ringkasan.getCell('A1').font?.color?.argb).toBe('FF1B365D');
        expect(ringkasan.getCell('A5').fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } });
        expect(ringkasan.getCell('A5').font?.color?.argb).toBe('FFFFFFFF');
        expect(ringkasan.getCell('B6').value).toMatchObject({
            formula: "COUNTIF('Semua Responden'!$C$5:$C$7, A6)",
            result: 1,
        });
        expect(ringkasan.getCell('E7').numFmt).toBe('0.0%');
        expect(ringkasan.getCell('A8').value).toBe('TOTAL');
        expect(ringkasan.getCell('A8').fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } });
        expect(ringkasan.getCell('A8').border?.bottom?.style).toBe('double');

        const spjSheet = workbook.getWorksheet('Site SPJ')!;
        expect(spjSheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
        expect(spjSheet.autoFilter).toBe('A4:G6');
        expect(spjSheet.getCell('A1').value).toBe('DAFTAR RESPONDEN SURVEI CSI - ICT — SITE SPJ');
        expect(spjSheet.getCell('E2').value).toBe('Total Site SPJ: 2 | Sudah: 1 | Belum: 1');
        expect(spjSheet.getCell('E5').value).toBe('Belum');
        expect(spjSheet.getCell('E5').fill).toMatchObject({ fgColor: { argb: 'FFFDE8E8' } });
        expect(spjSheet.getCell('E5').font?.color?.argb).toBe('FF9B1C1C');
        expect(spjSheet.getCell('E6').value).toBe('Sudah mengisi');
        expect(spjSheet.getCell('E6').fill).toMatchObject({ fgColor: { argb: 'FFDEF7EC' } });
        expect(spjSheet.getCell('E6').font?.color?.argb).toBe('FF03543F');
        expect(spjSheet.getCell('B6').fill).toMatchObject({ fgColor: { argb: 'FFF4F7FA' } });
        expect(spjSheet.getCell('G5').value).toEqual({
            text: 'idesk.santos.co.id',
            hyperlink: 'https://idesk.santos.co.id',
        });
    });

    it('builds safe fallback filenames when periodTitle is omitted', () => {
        expect(respondentsExportFilename('hc')).toMatch(/^responden-csi-hc-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });
});
