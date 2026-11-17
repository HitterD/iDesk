import * as XLSX from 'xlsx';
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

    it('builds Rekap summary per site with totals and percentage cells', () => {
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

    it('exports multi-sheet xlsx workbook (Rekap, Semua Site, and per-site sheets) via downloadBlob', async () => {
        const rows = personRows({
            mode: 'LISTED',
            submitted: [],
            pending: [
                { userId: 'u1', fullName: 'Budi', department: 'IT', siteId: 's-spj' },
                { userId: 'u2', fullName: 'Citra', department: 'QA', siteId: 's-skd' },
            ],
            totals: { submitted: 0, pending: 2 },
        });

        const filename = await exportRespondentsExcel({
            rows,
            sites: SITES,
            scope: 'ict',
            periodTitle: 'Survei CSI - ICT',
            suffix: 'belum-SPJ',
        });

        expect(filename).toMatch(/^responden-survei-csi-ict-belum-spj-\d{4}-\d{2}-\d{2}\.xlsx$/);
        expect(fx.downloadBlob).toHaveBeenCalledTimes(1);
        const [blob, savedName] = fx.downloadBlob.mock.calls[0];
        expect(savedName).toBe(filename);
        expect(blob).toBeInstanceOf(Blob);

        const workbook = XLSX.read(await (blob as Blob).arrayBuffer(), { type: 'array' });
        expect(workbook.SheetNames).toEqual(['Rekap', 'Semua Site', 'SKD', 'SPJ']);
        const skdParsed = XLSX.utils.sheet_to_json(workbook.Sheets.SKD, { header: 1 });
        expect(skdParsed[0]).toEqual(['DAFTAR RESPONDEN SURVEI CSI - ICT — SITE SKD']);
        expect(skdParsed[4]).toEqual([1, 'Citra', 'SKD', 'QA', 'Belum', '-', 'idesk.santos.co.id']);
    });

    it('builds safe fallback filenames when periodTitle is omitted', () => {
        expect(respondentsExportFilename('hc')).toMatch(/^responden-csi-hc-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });
});
