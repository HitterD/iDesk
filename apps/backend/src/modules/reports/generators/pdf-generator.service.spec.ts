import { PDFGeneratorService } from './pdf-generator.service';
import { PassThrough } from 'stream';

describe('PDFGeneratorService', () => {
    let service: PDFGeneratorService;

    beforeEach(() => {
        service = new PDFGeneratorService();
    });

    it('should generate Manager Report PDF without throwing switchToPage error', async () => {
        const mockRes: any = new PassThrough();
        mockRes.setHeader = jest.fn();

        const reportData = {
            period: '2026-08-01 to 2026-08-27',
            reportType: 'COMBINED',
            sites: ['SPJ', 'KRW'],
            sections: ['summary', 'tickets', 'agents', 'sla', 'trends', 'critical', 'comparison'],
            summary: {
                totalTickets: 120,
                resolvedTickets: 110,
                slaComplianceRate: 92,
                siteCount: 2,
                agentCount: 5,
            },
            ticketStats: {
                total: 120,
                created: 120,
                resolved: 110,
                byPriority: { HIGH: 20, MEDIUM: 60, LOW: 40 },
                byStatus: { RESOLVED: 110, IN_PROGRESS: 10 },
            },
            agentPerformance: [
                { agentName: 'Agent Alpha', siteCode: 'SPJ', totalAssigned: 50, resolved: 48, avgResolutionHours: 2.5, slaCompliance: 96 },
                { agentName: 'Agent Beta', siteCode: 'KRW', totalAssigned: 70, resolved: 62, avgResolutionHours: 3.1, slaCompliance: 89 },
            ],
            slaMetrics: {
                totalTickets: 120,
                onTime: 110,
                breached: 10,
                complianceRate: 92,
                avgResponseTimeMinutes: 15,
                avgResolutionTimeHours: 2.8,
            },
            trends: [
                { date: '2026-08-01', created: 5, resolved: 4 },
                { date: '2026-08-02', created: 8, resolved: 7 },
            ],
            criticalTickets: [
                { id: 't1', ticketNumber: 'TICK-001', title: 'Server Down', status: 'RESOLVED', createdAt: new Date(), assignedToName: 'Agent Alpha' },
            ],
            siteComparison: [
                { siteCode: 'SPJ', siteName: 'Sepanjang', ticketStats: { total: 50, created: 50, resolved: 48 }, slaMetrics: { complianceRate: 96 } },
                { siteCode: 'KRW', siteName: 'Karawang', ticketStats: { total: 70, created: 70, resolved: 62 }, slaMetrics: { complianceRate: 89 } },
            ],
        };

        const chunks: Buffer[] = [];
        mockRes.on('data', (chunk: Buffer) => chunks.push(chunk));

        await expect(
            service.generateManagerReportPDF(mockRes, reportData, { title: 'Manager Report' })
        ).resolves.not.toThrow();

        // Wait for stream end
        await new Promise((resolve) => mockRes.on('end', resolve));
        const fullPdf = Buffer.concat(chunks);
        expect(fullPdf.length).toBeGreaterThan(0);
    });

    it('should generate Agent Performance PDF with buffered footer correctly', async () => {
        const mockRes: any = new PassThrough();
        mockRes.setHeader = jest.fn();

        const metrics = [
            {
                agentId: 'a1',
                agentName: 'Agent Alpha',
                totalAssigned: 30,
                totalResolved: 28,
                resolutionRate: 93.3,
                avgResponseTimeMinutes: 12,
                avgResolutionTimeMinutes: 108,
                ticketsByPriority: { HIGH: 5, MEDIUM: 15, LOW: 10 },
                slaComplianceRate: 95,
            },
        ];

        const chunks: Buffer[] = [];
        mockRes.on('data', (chunk: Buffer) => chunks.push(chunk));

        await expect(
            service.generateAgentPerformancePDF(mockRes, metrics, { title: 'Agent Performance' })
        ).resolves.not.toThrow();

        await new Promise((resolve) => mockRes.on('end', resolve));
        const fullPdf = Buffer.concat(chunks);
        expect(fullPdf.length).toBeGreaterThan(0);
    });

    it('should generate Monthly Summary PDF correctly without throwing', async () => {
        const mockRes: any = new PassThrough();
        mockRes.setHeader = jest.fn();

        const stats = {
            month: 11,
            year: 2024,
            totalTickets: 150,
            resolvedTickets: 142,
            openTickets: 8,
            avgResolutionTimeHours: 3.45,
        };

        const chunks: Buffer[] = [];
        mockRes.on('data', (chunk: Buffer) => chunks.push(chunk));

        await expect(
            service.generateMonthlySummaryPDF(mockRes, stats, { title: 'Monthly Summary' })
        ).resolves.not.toThrow();

        await new Promise((resolve) => mockRes.on('end', resolve));
        const fullPdf = Buffer.concat(chunks);
        expect(fullPdf.length).toBeGreaterThan(0);
    });

    it('should generate Ticket Volume PDF correctly without throwing', async () => {
        const mockRes: any = new PassThrough();
        mockRes.setHeader = jest.fn();

        const volumeData = {
            summary: {
                totalCreated: 120,
                totalResolved: 110,
                totalPending: 10,
                avgPerDay: 4.5,
                peakDay: '2024-11-15',
                peakCount: 12,
            },
            daily: [
                { date: '2024-11-01', created: 5, resolved: 4, pending: 1 },
                { date: '2024-11-02', created: 6, resolved: 5, pending: 2 },
            ],
            byPriority: { HIGH: 20, MEDIUM: 60, LOW: 40 },
            byCategory: { Hardware: 50, Software: 40, Network: 30 },
            byStatus: { RESOLVED: 110, OPEN: 10 },
        };

        const chunks: Buffer[] = [];
        mockRes.on('data', (chunk: Buffer) => chunks.push(chunk));

        await expect(
            service.generateTicketVolumePDF(mockRes, volumeData as any, { title: 'Ticket Volume' })
        ).resolves.not.toThrow();

        await new Promise((resolve) => mockRes.on('end', resolve));
        const fullPdf = Buffer.concat(chunks);
        expect(fullPdf.length).toBeGreaterThan(0);
    });
});
