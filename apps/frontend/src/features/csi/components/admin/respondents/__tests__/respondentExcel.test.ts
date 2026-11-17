import * as XLSX from 'xlsx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '../../../../lib/format';
import type { CsiSiteSummary } from '../../../../types';
import { buildRespondentsSheetData, exportRespondentsExcel, respondentsExportFilename, sanitizeExcelCell } from '../respondentExcel';
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

    it('builds Row-1 table headers and clean site/department columns without scores', () => {
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
                { userId: 'u1', fullName: '=Andi', department: 'Gudang', siteId: 's-skd' },
            ],
            totals: { submitted: 1, pending: 1 },
        });

        const table = buildRespondentsSheetData(rows, SITES);
        expect(table).toEqual([
            ['No', 'Nama', 'Site', 'Departemen', 'Status', 'Waktu Mengisi'],
            [1, "'=Andi", 'SKD', 'Gudang', 'Belum', ''],
            [2, 'Rina', 'SPJ', 'Finance', 'Sudah mengisi', formatDateTime('2026-10-20T05:00:00Z')],
        ]);
    });

    it('exports readable xlsx workbook blob and readable sheet via downloadBlob', async () => {
        const rows = personRows({
            mode: 'LISTED',
            submitted: [],
            pending: [{ userId: 'u1', fullName: 'Budi', department: 'IT', siteId: 's-spj' }],
            totals: { submitted: 0, pending: 1 },
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
        expect(workbook.SheetNames).toEqual(['Responden']);
        const parsed = XLSX.utils.sheet_to_json(workbook.Sheets.Responden, { header: 1 });
        expect(parsed).toEqual([
            ['No', 'Nama', 'Site', 'Departemen', 'Status', 'Waktu Mengisi'],
            [1, 'Budi', 'SPJ', 'IT', 'Belum', ''],
        ]);
    });

    it('builds safe fallback filenames when periodTitle is omitted', () => {
        expect(respondentsExportFilename('hc')).toMatch(/^responden-csi-hc-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });
});
