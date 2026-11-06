import { buildReportModel } from './csi-report-model';
import { reportFixture } from './csi-report-model.fixture';
import { renderCsiReportPdf } from './csi-report-pdf';

const signoff = { columns: 2, slots: [{ title: 'Disiapkan oleh', name: 'Admin ICT', role: 'Supervisor', align: 'left' as const, showDate: true }] };
const NOW = new Date('2026-11-04T03:00:00Z');
const pageCount = (buffer: Buffer) => (buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

describe('renderCsiReportPdf', () => {
    it('renders the executive A4 report (summary page, analysis, appendices)', async () => {
        const { model } = reportFixture({ people: 3 });
        const buffer = await renderCsiReportPdf({ model, signoff, now: NOW });
        expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
        expect(pageCount(buffer)).toBeGreaterThanOrEqual(3);
    });

    it('never writes respondent names into the PDF', async () => {
        const { model } = reportFixture({ people: 3 });
        const buffer = await renderCsiReportPdf({ model, signoff, now: NOW });
        expect(buffer.toString('latin1')).not.toContain('Rahasia Penilai');
    });

    it('stays renderable at 100 respondents, 25 people, 3 sites and 90 comments', async () => {
        const { model } = reportFixture({ people: 25, responses: 100, sites: 3, comments: 30 });
        const buffer = await renderCsiReportPdf({ model, signoff, now: NOW });
        expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
        expect(pageCount(buffer)).toBeGreaterThan(4);
    });

    it('renders an empty survey without throwing', async () => {
        const { input } = reportFixture({ people: 0, responses: 0, comments: 0 });
        const model = buildReportModel({ ...input, report: { ...input.report, overall: { average: null, respondentCount: 0 }, previousAverage: null, ratees: [] }, comments: [], notes: '' });
        const buffer = await renderCsiReportPdf({ model, signoff, now: new Date() });
        expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    });
});
