import * as ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import { PDFGeneratorService } from './generators/pdf-generator.service';
import { ReportCanvas, fmtMinutes, fmtHours, fmtPct } from './generators/report-pdf-canvas';
import { DynamicScheduledReportsService } from './generators/dynamic-scheduled-reports.service';
import { ReportsService } from './reports.service';
import { EXCEL_COLORS } from './utils/excel-styles.util';
import { generateExecutiveInsights } from './utils/executive-insights.util';

const range = { startDate: new Date('2026-09-30T17:00:00Z'), endDate: new Date('2026-10-31T16:59:59Z') };
const agent = (name: string, eligible: number, resolved: number, evaluated: number, compliant: number) => ({
    agentId: name, agentName: name, agentSiteId: 'home', agentSiteName: 'Home',
    totalAssigned: eligible + 2, totalCancelled: 2, totalEligible: eligible, totalResolved: resolved,
    slaEvaluated: evaluated, slaCompliant: compliant, slaBreached: evaluated - compliant,
    responseSamples: 0, responseTotalMinutes: 0, resolutionSamples: 0, resolutionTotalMinutes: 0,
    resolutionRate: eligible ? resolved / eligible * 100 : null,
    slaComplianceRate: evaluated ? compliant / evaluated * 100 : null,
    avgResponseTimeMinutes: null, avgResolutionTimeMinutes: null, ticketsByPriority: {},
});
const agents = [agent('Small', 1, 1, 1, 1), agent('Large', 99, 49, 99, 49), agent('Unknown', 0, 0, 0, 0)];
const volume = { daily: [], byStatus: {}, byCategory: {}, byPriority: {}, summary: {
    totalCreated: 104, totalCancelled: 4, totalEligible: 100, totalResolved: 50, totalPending: 50,
    resolutionRate: 50, avgPerDay: 1, peakDay: '', peakCount: 0,
} };
async function cells(buffer: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const text: string[] = [];
    wb.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => text.push(String(cell.value ?? '')))));
    return text;
}

describe('active report consumers', () => {
    afterEach(() => jest.restoreAllMocks());
    it('formats missing rates and times honestly', () => {
        expect(fmtMinutes(null)).toBe('—');
        expect(fmtHours(null as any)).toBe('—');
        expect(fmtPct(null as any)).toBe('—');
        expect(fmtMinutes(0.5)).toBe('<1 menit');
    });
    it('does not infer active tickets or unsupported SLA severity', () => {
        const text = generateExecutiveInsights({ totalTickets: 10, resolvedTickets: 8, cancelledTickets: 2,
            eligibleTickets: 8, resolutionRate: 100, slaComplianceRate: null, topPerformer: { name: 'A', count: 8 } } as any).join(' ');
        expect(text).not.toContain('2 masih aktif');
        expect(text).not.toContain('SLA) mencapai 0.0%');
        expect(text).toContain('penyelesaian terbanyak');
        expect(generateExecutiveInsights({ totalTickets: 1, slaComplianceRate: 100 }).join(' ')).not.toContain('mayor');
    });
    it('renders PDF weighted ratios, ranked names, missing times and cohort', async () => {
        const kpis = jest.spyOn(ReportCanvas.prototype, 'kpis');
        const header = jest.spyOn(ReportCanvas.prototype, 'header');
        const table = jest.spyOn(ReportCanvas.prototype, 'table');
        const res: any = new PassThrough(); res.setHeader = jest.fn(); res.resume();
        await new PDFGeneratorService().generateAgentPerformancePDF(res, agents, { title: 'Test', siteId: 'selected' } as any);
        expect(JSON.stringify(kpis.mock.calls)).toContain('50,0%');
        expect(JSON.stringify(kpis.mock.calls)).toContain('Penyelesaian terbanyak');
        expect(JSON.stringify(table.mock.calls)).toContain('—');
        expect(JSON.stringify(table.mock.calls)).toContain('Home');
        expect(JSON.stringify(header.mock.calls)).toContain('Tiket dibuat dalam periode; status saat laporan diambil');
    });
    it.each(['buildPerformanceExcel', 'buildCombinedExcel', 'buildVolumeExcel'])('renders real scheduled workbook cells: %s', async method => {
        const service: any = new DynamicScheduledReportsService(null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
        const args = method === 'buildCombinedExcel' ? [volume, agents, range, 'Site S1 — Team'] : [method === 'buildVolumeExcel' ? volume : agents, range, 'Site S1 — Team'];
        const text = await cells(await service[method](...args));
        expect(text.join(' ')).toContain('Site S1 — Team');
        expect(text.join(' ')).toContain('Tiket dibuat dalam periode; status saat laporan diambil');
        expect(text.join(' ')).not.toContain('null%');
        expect(text.join(' ')).not.toContain('null m');
        expect(text.join(' ')).toContain('Dibatalkan');
        if (method !== 'buildVolumeExcel') {
            expect(text).toContain('—');
            expect(text.join(' ')).toContain('50,0%');
        }
    });
    it('renders monthly and comprehensive workbook cells with eligible denominator', async () => {
        const qb: any = { leftJoinAndSelect: () => qb, where: () => qb, orderBy: () => qb, andWhere: () => qb, getMany: async () => [] };
        const service: any = new ReportsService({ logAsync: jest.fn() } as any, { createQueryBuilder: () => qb } as any, null as any,
            { generate: async () => ({ data: agents }) } as any, { generate: async () => ({ data: volume }) } as any, null as any, null as any);
        service.scopeLabel = async () => 'Site S1 — Team';
        service.getMonthlyStats = async () => ({ month: 10, year: 2026, totalTickets: 10, resolvedTickets: 8,
            cancelledTickets: 2, eligibleTickets: 8, openTickets: 0, resolutionRate: 100, avgResolutionTimeHours: null });
        for (const monthly of [true, false]) {
            const res: any = new PassThrough(); res.setHeader = jest.fn();
            const chunks: Buffer[] = []; res.on('data', (chunk: Buffer) => chunks.push(chunk));
            const done = new Promise<void>(resolve => res.on('end', resolve));
            if (monthly) await service.generateExcelReport(res, 10, 2026);
            else await service.generateCustomRangeExcel(res, range.startDate, range.endDate);
            await done;
            const text = (await cells(Buffer.concat(chunks))).join(' ');
            expect(text).toContain('Dibatalkan');
            expect(text).toContain('Tiket dibuat dalam periode; status saat laporan diambil');
            expect(text).toContain(monthly ? '100,0%' : '50,0%');
            expect(text).toContain('—');
        }
    });
    describe('per-agent Excel reconciliation', () => {
        const crossAgents = [agent('Hasby', 12, 8, 10, 9), agent('Nobody', 0, 0, 0, 0)];
        const sheetRows = (wb: ExcelJS.Workbook, name: string) => {
            const rows: Record<string, unknown>[] = [];
            const sheet = wb.getWorksheet(name)!;
            let headers: string[] | null = null;
            sheet.eachRow(row => {
                const values = (row.values as unknown[]).slice(1).map(v => String(v ?? ''));
                if (!headers) { if (values.includes('Nama Teknisi')) headers = values; return; }
                rows.push(Object.fromEntries(headers.map((h, i) => [h, values[i]])));
            });
            return { rows, sheet };
        };
        const load = async (buffer: Buffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer as any); return wb; };

        it.each([['buildPerformanceExcel', 'Agent Performance'], ['buildCombinedExcel', 'Agent Performance']])(
            'scheduled %s lists cancelled, eligible and cross-site columns', async (method, sheetName) => {
                const service: any = new DynamicScheduledReportsService(null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
                const args = method === 'buildCombinedExcel' ? [volume, crossAgents, range, 'Site S1', 'selected'] : [crossAgents, range, 'Site S1', 'selected'];
                const { rows } = sheetRows(await load(await service[method](...args)), sheetName);
                const hasby = rows.find(r => r['Nama Teknisi'] === 'Hasby')!;
                expect(hasby).toMatchObject({ 'Site Asal': 'Home', 'Lintas Site': 'Ya', Ditugaskan: '14', Dibatalkan: '2', Eligible: '12', Selesai: '8' });
                expect(Number(hasby.Ditugaskan) - Number(hasby.Dibatalkan)).toBe(Number(hasby.Eligible));
            });

        it('marks an agent from the selected site as not cross-site', async () => {
            const service: any = new DynamicScheduledReportsService(null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
            const { rows } = sheetRows(await load(await service.buildPerformanceExcel(crossAgents, range, 'Site S1', 'home')), 'Agent Performance');
            expect(rows.find(r => r['Nama Teknisi'] === 'Hasby')!['Lintas Site']).toBe('Tidak');
        });

        it('interactive agent sheet has the same columns, uniform duration headers and no red for unevaluated SLA', async () => {
            const qb: any = { leftJoinAndSelect: () => qb, where: () => qb, orderBy: () => qb, andWhere: () => qb, getMany: async () => [] };
            const service: any = new ReportsService({ logAsync: jest.fn() } as any, { createQueryBuilder: () => qb } as any, null as any,
                { generate: async () => ({ data: crossAgents }) } as any, { generate: async () => ({ data: volume }) } as any, null as any, null as any);
            service.scopeLabel = async () => 'Site S1';
            const res: any = new PassThrough(); res.setHeader = jest.fn();
            const chunks: Buffer[] = []; res.on('data', (chunk: Buffer) => chunks.push(chunk));
            const done = new Promise<void>(resolve => res.on('end', resolve));
            await service.generateCustomRangeExcel(res, range.startDate, range.endDate, undefined, { siteId: 'selected' });
            await done;
            const wb = await load(Buffer.concat(chunks));
            const { rows, sheet } = sheetRows(wb, 'Kinerja Teknisi');
            expect(rows.find(r => r['Nama Teknisi'] === 'Hasby')).toMatchObject({ 'Site Asal': 'Home', 'Lintas Site': 'Ya', Dibatalkan: '2', Eligible: '12' });
            const headers = (sheet.getRow(1).values as unknown[]).join('|');
            expect(headers).not.toContain('(Menit)');
            const slaCol = (sheet.getRow(1).values as unknown[]).indexOf('Kepatuhan SLA (%)');
            const nobody = sheet.getRow(3);
            expect(nobody.getCell(slaCol).value).toBe('—');
            expect(nobody.getCell(slaCol).font?.color?.argb).not.toBe(EXCEL_COLORS.critical);
            expect(sheet.getRow(2).getCell(slaCol).font?.color?.argb).toBe(EXCEL_COLORS.positive);
            const daily = (wb.getWorksheet('Volume Harian')!.getRow(1).values as unknown[]).join('|');
            expect(daily).toContain('Dari tiket hari itu yang kini selesai');
            expect(daily).not.toContain('Tiket Selesai');
        });
    });
    describe('PDF cohort labels', () => {
        const COHORT = 'Tiket dibuat dalam periode; status saat laporan diambil';
        const open = () => { const res: any = new PassThrough(); res.setHeader = jest.fn(); res.resume(); return res; };

        it('keeps the Manager Report PDF on its original wording (separate resolvedAt contract)', async () => {
            const header = jest.spyOn(ReportCanvas.prototype, 'header');
            const kpis = jest.spyOn(ReportCanvas.prototype, 'kpis');
            await new PDFGeneratorService().generateManagerReportPDF(open(), {
                period: '2026-10-01 to 2026-10-31', sites: ['SPJ'], summary: { totalTickets: 10, resolvedTickets: 5, slaComplianceRate: 90, siteCount: 1, agentCount: 1 },
            } as any, { title: 'Manager' });
            expect(JSON.stringify(header.mock.calls)).not.toContain(COHORT);
            expect(JSON.stringify(kpis.mock.calls)).toContain('dari total');
            expect(JSON.stringify(kpis.mock.calls)).not.toContain('dari tiket eligible');
        });

        it('keeps the volume and monthly PDFs on the cohort header', async () => {
            const header = jest.spyOn(ReportCanvas.prototype, 'header');
            const service = new PDFGeneratorService();
            await service.generateTicketVolumePDF(open(), volume as any, { title: 'Volume', dateRange: range });
            await service.generateMonthlySummaryPDF(open(), { month: 10, year: 2026, totalTickets: 10, resolvedTickets: 8, openTickets: 0, avgResolutionTimeHours: null }, { title: 'Bulanan' });
            expect(header.mock.calls.filter(([info]) => info.period.includes(COHORT))).toHaveLength(2);
        });
    });
});
