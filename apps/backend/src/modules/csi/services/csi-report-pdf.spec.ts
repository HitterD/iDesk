import { ReportCanvas } from '../../reports/generators/report-pdf-canvas';
import { CSI_SIMULATION_BANNER } from '../csi.constants';
import { buildReportModel, CsiReportModel } from './csi-report-model';
import { hcReportFixture, reportFixture } from './csi-report-model.fixture';
import { renderCsiReportPdf } from './csi-report-pdf';

const pdfParse = require('pdf-parse');
const signoff = { columns: 2, slots: [{ title: 'Disiapkan oleh', name: 'Admin ICT', role: 'Supervisor', align: 'left' as const, showDate: true }] };
const NOW = new Date('2026-11-04T03:00:00Z');
const pageCount = (buffer: Buffer) => (buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
const norm = (value: string) => value.replace(/\s+/g, ' ');

/** Text per page, whitespace-normalised (pdf.js extraction, as the memo spec). */
async function pagesOf(model: CsiReportModel): Promise<string[]> {
    const pages: string[] = [];
    await pdfParse(await renderCsiReportPdf({ model, signoff, now: NOW }), {
        pagerender: async (page: any) => {
            const content = await page.getTextContent();
            pages.push(norm(content.items.map((item: any) => item.str).join(' ')));
            return '';
        },
    });
    return pages;
}
const allText = async (model: CsiReportModel) => (await pagesOf(model)).join(' ');

/** Every column header the renderer passes to ReportCanvas.table. */
async function tableHeaders(model: CsiReportModel): Promise<string[]> {
    const spy = jest.spyOn(ReportCanvas.prototype, 'table');
    try {
        await renderCsiReportPdf({ model, signoff, now: NOW });
        return spy.mock.calls.flatMap(([columns]) => columns.map((column) => column.header));
    } finally {
        spy.mockRestore();
    }
}

describe('renderCsiReportPdf', () => {
    describe('ICT', () => {
        it('renders the executive A4 report (summary page, analysis, appendices) without Lampiran D', async () => {
            const { model } = reportFixture({ people: 3 });
            const buffer = await renderCsiReportPdf({ model, signoff, now: NOW });
            expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
            expect(pageCount(buffer)).toBeGreaterThanOrEqual(3);
            const text = await allText(model);
            expect(text).toContain('Peringkat tim dan orang');
            expect(text).toContain('Lampiran B · Partisipasi per departemen');
            expect(text).not.toMatch(/Lampiran D|Bintang|3 tertinggi|Perlu perhatian/);
        });

        it('no participant names or emails in pdf', async () => {
            const { model } = reportFixture({ people: 3 });
            const text = await allText(model);
            expect(text).not.toContain('Rahasia Penilai');
            expect(text).not.toMatch(/@/);
        });

        it('stays renderable at 100 respondents, 25 people, 3 sites and 90 comments', async () => {
            const { model } = reportFixture({ people: 25, responses: 100, sites: 3, comments: 30 });
            const buffer = await renderCsiReportPdf({ model, signoff, now: NOW });
            expect(pageCount(buffer)).toBeGreaterThan(4);
        });

        it('renders an empty survey without throwing', async () => {
            const { input } = reportFixture({ people: 0, responses: 0, comments: 0 });
            const model = buildReportModel({ ...input, report: { ...input.report, overall: { average: null, respondentCount: 0 }, previousAverage: null, ratees: [] }, comments: [], notes: '' });
            const buffer = await renderCsiReportPdf({ model, signoff, now: new Date() });
            expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
        });

        it('person ranking drops the Site column when no person has a site; team ranking keeps it', async () => {
            const spy = jest.spyOn(ReportCanvas.prototype, 'table');
            try {
                await renderCsiReportPdf({ model: reportFixture({ people: 6, responses: 8 }).model, signoff, now: NOW });
                const headers = spy.mock.calls.map(([columns]) => columns.map((column) => column.header).join('|'));
                expect(headers).toContain('#|Nama|Site|Penilai|Nilai|Predikat|Lalu|Selisih');
                expect(headers).toContain('#|Nama|Penilai|Nilai|Predikat|Lalu|Selisih');
            } finally {
                spy.mockRestore();
            }
        });

        it('comments have no date or department', async () => {
            const { model } = reportFixture({ people: 1, comments: 2 });
            const text = await allText(model);
            const comments = text.slice(text.indexOf('Lampiran C'), text.indexOf('Pengesahan'));
            expect(comments).toContain('Komentar tim 0');
            expect(comments).not.toMatch(/Produksi|Gudang|Departemen|Tanggal|\d{1,2} Nov 2026/);
        });
    });

    describe('HC', () => {
        it('follows the HC structure; HC has no Lampiran A2 and no spotlight', async () => {
            const { model } = hcReportFixture();
            const text = await allText(model);
            const order = ['Partisipasi & SLA', 'Nilai per layanan', 'Nilai per layanan, bagian & PIC', 'Peringkat per layanan',
                'Rekap responden per divisi & departemen', 'Komentar & saran', 'Lampiran A · Nilai per pertanyaan per layanan', 'Pengesahan'];
            const positions = order.map((title) => text.toUpperCase().indexOf(title.toUpperCase()));
            expect(positions.every((position) => position >= 0)).toBe(true);
            expect([...positions].sort((a, b) => a - b)).toEqual(positions);
            expect(text).not.toMatch(/Lampiran A2|Lampiran D|Peringkat orang|Peringkat tim|Bintang|3 tertinggi|Perlu perhatian|Per dimensi untuk setiap/);
            expect(text).toContain('Layanan tertinggi:');
            expect(text).toContain('Belum cukup penilai (< 5)');
        });

        it('no participant names or emails in pdf', async () => {
            const { model, ratings } = hcReportFixture();
            const text = await allText(model);
            new Set(ratings.map((rating) => rating.respondent.name)).forEach((name) => expect(text).not.toContain(name));
            expect(text).not.toMatch(/Rahasia|@/);
        });

        it('no previous hides delta columns', async () => {
            const without = await tableHeaders(hcReportFixture({ previous: false }).model);
            expect(without).not.toEqual(expect.arrayContaining(['Lalu']));
            expect(without).not.toContain('Selisih');
            const withPrevious = await tableHeaders(hcReportFixture({ previous: true }).model);
            expect(withPrevious).toEqual(expect.arrayContaining(['Lalu', 'Selisih']));
            expect((await allText(hcReportFixture({ previous: false }).model))).not.toContain('Dibanding periode lalu');
        });

        it('Selisih is a dash where the previous period has no value (only HCC, Anita and Bambang have one)', async () => {
            const spy = jest.spyOn(ReportCanvas.prototype, 'table');
            try {
                await renderCsiReportPdf({ model: hcReportFixture({ previous: true }).model, signoff, now: NOW });
                const rows = spy.mock.calls.filter(([columns]) => columns.some((column) => column.header === 'Selisih') && columns[0].header !== '#'
                    && columns.some((column) => column.header === 'Rata-rata'))
                    .flatMap(([, cells]) => cells.map((row) => [String(row[0].text).replace(/^•\s*/, ''), row[row.length - 1].text]));
                const selisih = (label: string) => rows.find(([name]) => name.startsWith(label))?.[1];
                expect(selisih('HCC')).not.toBe('–');
                expect(selisih('HCD')).toBe('–');
                expect(selisih('HCS')).toBe('–');
            } finally {
                spy.mockRestore();
            }
        });

        it('headers are not truncated: full dimension names and words are passed to the canvas', async () => {
            const headers = await tableHeaders(hcReportFixture({ previous: true }).model);
            expect(headers).toEqual(expect.arrayContaining(['Knowledge', 'Responsiveness', 'Courtesy', 'Communication', 'Tangible', 'Rata-rata', 'Penilai', 'Bagian / fungsi', 'Semua lokasi']));
            headers.forEach((header) => expect(header).not.toMatch(/\.\.\.|…/));
            expect(headers).not.toContain('Jml');
        });

        it('sla block text', async () => {
            const { model } = hcReportFixture({ respondents: 30 });
            // Basis 40, target 90% = 36, 30 answered: 6 missing.
            expect(model.sla).toMatchObject({ basis: 40, submitted: 30, targetCount: 36, missing: 6 });
            const first = (await pagesOf(model))[0];
            expect(first).toContain('30/40 sudah mengisi (75%)');
            expect(first).toContain('Target 90% = 36 orang');
            expect(first).toContain('Belum memenuhi SLA — kurang 6 jawaban');
            const met = hcReportFixture({ respondents: 30 }).model;
            const done = { ...met, sla: { ...met.sla, submitted: 36, met: true, missing: 0 } };
            expect((await pagesOf(done))[0]).toContain('Memenuhi SLA');
        });

        it('simulation banner on every page', async () => {
            const { model } = hcReportFixture({ title: 'SIMULASI – CSI HC 2026 (SMG + SPJ)' });
            expect(model.simulation).toBe(true);
            const pages = await pagesOf(model);
            expect(pages.length).toBeGreaterThan(2);
            // Banner at the top and the footer note: twice per page.
            pages.forEach((page) => expect(page.split(CSI_SIMULATION_BANNER).length - 1).toBe(2));
            const real = await pagesOf(hcReportFixture().model);
            real.forEach((page) => expect(page).not.toContain('SIMULASI'));
        });

        it('comments have no date or department, grouped per layanan (HCD, HCC, HCS) as a plain list', async () => {
            const { model } = hcReportFixture();
            const text = await allText(model);
            const comments = text.slice(text.indexOf('Komentar & saran'), text.indexOf('Lampiran A'));
            const order = ['HCD · HC Development', 'HCC · HC Compensation & Benefit', 'HCS · HC Services'].map((title) => comments.indexOf(title));
            expect(order.every((index) => index > 0)).toBe(true);
            expect([...order].sort((a, b) => a - b)).toEqual(order);
            expect(comments).not.toMatch(/PRODUKSI|\d{1,2} Nov 2026|Komentar Saran/);
            expect(await allText(model)).toBe(text);
        });

        it('one reading sentence per section: ranking and comment notes are not repeated per layanan', async () => {
            const notes: string[] = [];
            const spy = jest.spyOn(ReportCanvas.prototype, 'note').mockImplementation(function (this: ReportCanvas, line: string) { notes.push(line); });
            try {
                await renderCsiReportPdf({ model: hcReportFixture({ previous: true }).model, signoff, now: NOW });
            } finally {
                spy.mockRestore();
            }
            expect(new Set(notes).size).toBe(notes.length);
            expect(notes.filter((line) => /Urut dari nilai tertinggi/.test(line))).toHaveLength(1);
            expect(notes.filter((line) => /urutan acak/i.test(line))).toHaveLength(1);
        });

        it('layanan order is HCD, HCC, HCS in every per-layanan table', async () => {
            const { model } = hcReportFixture();
            const text = await allText(model);
            const section = (from: string, to: string) => text.slice(text.indexOf(from), text.indexOf(to, text.indexOf(from) + from.length));
            [section('Nilai per layanan', 'Nilai per layanan menurut'), section('Nilai per layanan, bagian & PIC', 'Peringkat per layanan'),
                section('Peringkat per layanan', 'Rekap responden')].forEach((part) => {
                const at = ['HCD ·', 'HCC ·', 'HCS ·'].map((code) => part.indexOf(code));
                expect(at.every((index) => index >= 0)).toBe(true);
                expect([...at].sort((a, b) => a - b)).toEqual(at);
            });
            const header = text.slice(text.indexOf('Lampiran A'));
            expect(header.indexOf('HCD')).toBeLessThan(header.indexOf('HCC'));
            expect(header.indexOf('HCC')).toBeLessThan(header.indexOf('HCS'));
        });

        it('respondent recap: divisions in caps, single-department division merged, no repeated single bagian', async () => {
            const { model } = hcReportFixture();
            const text = await allText(model);
            const recap = text.slice(text.indexOf('Rekap responden per divisi'), text.indexOf('Komentar & saran'));
            expect(recap).toContain('FINANCE · AKUNTANSI');
            expect(recap).not.toMatch(/• Akuntansi|• AKUNTANSI/);
            expect(recap).toContain('Produksi');
            expect(recap).toContain('• Line 1');
            expect(recap).toContain('kurang dari 3 responden atau tidak ada data');
        });

        it('respondent recap has no location columns: only Semua lokasi and Responden', async () => {
            const spy = jest.spyOn(ReportCanvas.prototype, 'table');
            try {
                await renderCsiReportPdf({ model: hcReportFixture().model, signoff, now: NOW });
                const recap = spy.mock.calls.find(([columns]) => columns[0].header === 'Divisi / Departemen / Bagian')!;
                expect(recap[0].map((column) => column.header)).toEqual(['Divisi / Departemen / Bagian', 'Semua lokasi', 'Responden']);
            } finally {
                spy.mockRestore();
            }
        });

        it('layanan × lokasi cells under 3 respondents print a dash', async () => {
            const { model } = hcReportFixture({ respondents: 10 });
            const service = model.hcRecap.services.find((row) => row.level === 'service' && Object.values(row.byLocation).some((cell) => cell.ratings > 0 && cell.average === null));
            expect(service).toBeDefined();
            const spy = jest.spyOn(ReportCanvas.prototype, 'table');
            try {
                await renderCsiReportPdf({ model, signoff, now: NOW });
                const table = spy.mock.calls.find(([columns]) => columns[0].header === 'Layanan' && columns.some((column) => column.header === 'Semua lokasi'))!;
                const row = table[1].find((cells) => cells[0].text === service!.label)!;
                model.hcRecap.locations.forEach((location, index) => {
                    const cell = service!.byLocation[location.code];
                    if (cell.average === null) expect(row[index + 1].text).toBe('–');
                });
            } finally {
                spy.mockRestore();
            }
        });
    });
});
