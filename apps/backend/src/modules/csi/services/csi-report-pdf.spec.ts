import { CsiRateeKind } from '../csi.constants';
import { renderCsiReportPdf } from './csi-report-pdf';

const question = (name: string, average: number | null) => ({ name, shortLabel: null, description: `[${name}]`, type: 'STAR', average, count: 2, distribution: [] });
const report: any = {
    period: { id: '0a1b2c3d-0000-4000-8000-000000000000', title: 'CSI ICT November', teamLabel: 'Tim IT Support', startDate: '2026-11-01', endDate: '2026-11-30', slaTargetPct: 80, sites: [{ id: 's1', code: 'SPJ', name: 'Sepanjang' }] },
    overall: { average: 4.35, respondentCount: 2 },
    previousAverage: 4.1,
    sla: { pengisiPct: 90 },
    ratees: [
        { periodRateeId: 't', kind: CsiRateeKind.TEAM, displayName: 'ICT Sepanjang', siteId: 's1', respondentCount: 2, average: 4.5, indexPct: 90, questions: [question('Kecepatan', 4.5)], comments: [{ text: 'Mantap', departmentName: 'Produksi', submittedAt: new Date() }] },
        { periodRateeId: 'r1', kind: CsiRateeKind.PERSON, displayName: 'Budi', siteId: 's1', respondentCount: 1, average: 3.2, indexPct: 64, questions: [question('Ramah', 3.2)], comments: [] },
    ],
};
const matrix = {
    subjects: [{ periodRateeId: 't', kind: CsiRateeKind.TEAM, displayName: 'ICT Sepanjang', siteId: 's1' }, { periodRateeId: 'r1', kind: CsiRateeKind.PERSON, displayName: 'Budi', siteId: 's1' }],
    rows: [{ responseId: 'a', respondentName: 'Rahasia Penilai', departmentName: 'Produksi', areaName: null, submittedAt: new Date(), scores: [4.5, 3.2], average: 3.85 }],
    totals: [{ raters: 2, average: 4.5 }, { raters: 1, average: 3.2 }],
};
const signoff = { columns: 2, slots: [{ title: 'Disiapkan oleh', name: 'Admin ICT', role: 'Supervisor', align: 'left' as const, showDate: true }] };

describe('renderCsiReportPdf', () => {
    it('renders a multi-section A4 PDF', async () => {
        const buffer = await renderCsiReportPdf({ report, matrix, scopeLabel: 'ICT', signoff, now: new Date('2026-11-04T03:00:00Z') });
        expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
        expect(buffer.length).toBeGreaterThan(2000);
    });

    it('never writes respondent names into the PDF', async () => {
        const buffer = await renderCsiReportPdf({ report, matrix, scopeLabel: 'ICT', signoff, now: new Date('2026-11-04T03:00:00Z') });
        expect(buffer.toString('latin1')).not.toContain('Rahasia Penilai');
    });

    it('renders an empty survey without throwing', async () => {
        const empty = { ...report, overall: { average: null, respondentCount: 0 }, previousAverage: null, sla: { pengisiPct: null }, ratees: [] };
        const buffer = await renderCsiReportPdf({ report: empty, matrix: { subjects: [], rows: [], totals: [] }, scopeLabel: 'HC', signoff, now: new Date() });
        expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    });
});
