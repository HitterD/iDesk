import * as fs from 'fs';
import * as PDFDocument from 'pdfkit';
import { renderMemoPdf } from './csi-memo-pdf';
import { memoHeader, memoSurvey } from './csi-memo.fixtures';

const pdfParse = require('pdf-parse');
const norm = (text: string) => text.replace(/\s+/g, ' ');

async function parse(surveys = [memoSurvey(1), memoSurvey(2, null)]) {
    const buffer = await renderMemoPdf(memoHeader(), surveys);
    const parsed = await pdfParse(buffer);
    return { buffer, text: norm(parsed.text), pages: parsed.numpages as number };
}

describe('renderMemoPdf', () => {
    it('memo pdf contains header labels, location names and 4,52-style averages', async () => {
        const { buffer, text } = await parse();
        expect(buffer.slice(0, 4).toString()).toBe('%PDF');
        for (const expected of [
            'Interoffice Memo', 'Kepada', 'CC', 'Nomor', 'Dari', 'Perihal', 'Tanggal', '28 November 2025', 'Dengan hormat',
            'Lokasi', 'Nama', 'Average', '% Sudah mengisi', 'SJA Sepanjang & SJA Sukodono', 'SJA Karawang',
            'Budi Hartono', 'Dewi Lestari', '4,52', '67%', 'Hormat kami', 'Mengetahui', 'Budi Santoso', 'ICT Manager',
        ]) expect(text).toContain(expected);
        expect(text).toContain('Tim IT Support'); // survey 2 has no PERSON ratee: team label in Nama
        // One SLA percentage, as the report: answers ÷ basis (2 of 3 = 67%), never answers ÷ target (100%).
        expect(text).not.toContain('Pengisi');
        expect(text).not.toContain('100%');
    });

    it('shows a dash when the average is unknown', async () => {
        const buffer = await renderMemoPdf(memoHeader(), [memoSurvey(2, null)]);
        const first = norm((await pdfParse(buffer, { max: 1 })).text);
        expect(first).toContain('Tim IT Support');
        expect(first).toMatch(/Tim IT Support\s*[—\-]/);
    });

    it('memo pdf has answer and SLA appendix pages', async () => {
        const surveys = [memoSurvey(1), memoSurvey(2)];
        const { text, pages } = await parse(surveys);
        expect(pages).toBeGreaterThanOrEqual(1 + 2 * surveys.length);
        for (const expected of [
            'SJA Sepanjang & SJA Sukodono — CSI Operational Support 1', 'Timestamp', 'titi yusliyanti', 'SEPANJANG',
            'Lampiran SLA — SJA Karawang', 'Total pelapor iDesk', 'Target 80%', 'Total responden CSI', 'Email', 'Departemen', 'a@sja.co.id',
        ]) expect(text).toContain(expected);
        // One SLA percentage: % Sudah mengisi = responden / basis (2 of 3 -> 67%), the same figure as the report SLA block.
        expect(text).toMatch(/% Sudah mengisi\s*67%/);
        expect(text).not.toMatch(/% Responden|Pengisi/);
    });

    it('colours the survey average by its score bands (custom bands 3.5/4.2 vs legacy 4.0/4.5)', async () => {
        const GREEN = '#1E7D46';
        const AMBER = '#B26A00';
        const spy = jest.spyOn((PDFDocument as any).prototype, 'fillColor');
        try {
            const custom = memoSurvey(1, 4.3);
            custom.report.period = { ...custom.report.period, scoreFairMin: 3.5, scoreGoodMin: 4.2 };
            await renderMemoPdf(memoHeader(), [custom]);
            expect(spy.mock.calls.map(([color]) => color)).toContain(GREEN);
            spy.mockClear();
            await renderMemoPdf(memoHeader(), [memoSurvey(1, 4.3)]);
            const colors = spy.mock.calls.map(([color]) => color);
            expect(colors).toContain(AMBER);
            expect(colors).not.toContain(GREEN);
        } finally {
            spy.mockRestore();
        }
    });

    it('no person spotlight: no top/attention boxes and no highlight sentence naming anyone', async () => {
        const { text } = await parse([memoSurvey(1), memoSurvey(2)]);
        expect(text).not.toMatch(/tertinggi|terendah|terbaik|Perlu perhatian|Poin utama|Peringkat/i);
    });

    it('strips control characters from user strings', async () => {
        const buffer = await renderMemoPdf(memoHeader({ to: 'Pak\u0000 Budi' }), [memoSurvey(1)]);
        expect(norm((await pdfParse(buffer)).text)).toContain('Pak Budi');
    });

    /** Text per page, whitespace-normalised. */
    async function pagesOf(buffer: Buffer): Promise<string[]> {
        const pages: string[] = [];
        await pdfParse(buffer, {
            pagerender: async (page: any) => {
                const content = await page.getTextContent();
                pages.push(norm(content.items.map((item: any) => item.str).join(' ')));
                return '';
            },
        });
        return pages;
    }

    it('a tall Lokasi stays in one block with its names on the same page', async () => {
        const survey = memoSurvey(1);
        survey.report.period.sites = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, code: `C${String(i).padStart(2, '0')}`, name: `SJA Site Nomor ${i}` }));
        const filler = [memoSurvey(2), memoSurvey(2), memoSurvey(2)];
        const pages = await pagesOf(await renderMemoPdf(memoHeader(), [...filler, survey]));
        const holder = pages.findIndex((page) => page.includes('SJA Site Nomor 0 '));
        expect(holder).toBeGreaterThanOrEqual(0);
        expect(pages[holder]).toContain('SJA Site Nomor 39');
        expect(pages[holder]).toContain('Budi Hartono');
        expect(pages[holder]).toContain('Dewi Lestari');
        // The memo page holding the block is the one with the recap header, not a stray overflow page.
        expect(pages[holder]).toContain('% Sudah mengisi');
        expect(pages[holder]).not.toContain('Timestamp');
    });

    it('truncates an oversized TEXT answer with an ellipsis and keeps the page count stable', async () => {
        const survey = memoSurvey(1);
        const long = Array.from({ length: 100 }, (_, i) => `kata${i}`).join(' ').padEnd(1000, 'x');
        survey.answers[0].ratees[0].scores.push({ dimension: 'Saran', type: 'TEXT', score: null, answerLabel: null, answerText: long } as any);
        // Many questions make each column narrow (about 15 columns in real surveys), so the answer wraps to a very tall cell.
        const extra = Array.from({ length: 9 }, (_, i) => ({ name: `Q${i}`, type: 'STAR', average: null, count: 0, distribution: [] }));
        survey.report.ratees[0].questions.push(...extra, { name: 'Saran', type: 'TEXT', average: null, count: 0, distribution: [] });
        const buffer = await renderMemoPdf(memoHeader(), [survey]);
        const pages = await pagesOf(buffer);
        const all = pages.join(' ');
        // The cut may fall inside a word ("kata36 k..."), depending on the column widths.
        expect(all).toMatch(/kata\d+(\s+\S*?)?(…|\.\.\.)/); // pdf-parse extracts the ellipsis glyph as three dots
        expect(all.replace(/\s/g, '')).not.toContain(long.replace(/\s/g, ''));
        expect(pages).toHaveLength(3); // memo, answers, SLA: the oversized row never spills onto an extra page
    });

    it('HC survey with PIC and a custom team renders both answer tables', async () => {
        const survey = memoSurvey(1);
        survey.report.period.scope = 'HC';
        const pages = await pagesOf(await renderMemoPdf(memoHeader(), [survey]));
        const answerPages = pages.filter((page) => page.includes('Average') && page.includes('No.'));
        expect(answerPages).toHaveLength(2);
        expect(answerPages[0]).toContain('Dinilai');
        expect(answerPages[0]).toContain('Budi Hartono');
        expect(answerPages[1]).not.toContain('Dinilai');
        expect(answerPages[1]).toContain('Kecepatan');
    });

    it('HC memo carries no rater name or email: anonymous answer rows and participation per department only', async () => {
        const survey = memoSurvey(1);
        survey.report.period.scope = 'HC';
        survey.departments = [
            { name: 'Finance', submitted: 2, total: 3, pct: 67, met: false },
            { name: 'Departemen kecil (gabungan)', submitted: 1, total: 2, pct: 50, met: false },
        ];
        const pages = await pagesOf(await renderMemoPdf(memoHeader(), [survey]));
        const all = pages.join(' ');
        for (const identity of ['titi yusliyanti', 'Keuangan', 'SEPANJANG', 'Andi', 'Bela', 'Citra', 'a@sja.co.id', 'b@sja.co.id', 'Timestamp', 'Area Kerja']) {
            expect(all).not.toContain(identity);
        }
        const answerPages = pages.filter((page) => page.includes('Kecepatan') && page.includes('Average'));
        expect(answerPages.length).toBeGreaterThanOrEqual(1);
        expect(answerPages[0]).toContain('No.');
        // No reporter table (Email | Departemen | Nama); "Email" may only appear as the CHOICE answer of the fixture.
        expect(all).not.toMatch(/Email\s+Departemen\s+Nama/);
        const sla = pages.find((page) => page.includes('Lampiran SLA'))!;
        for (const expected of ['Departemen', 'Sudah', 'Total', 'Finance', 'Departemen kecil (gabungan)', '67%', 'Belum']) expect(sla).toContain(expected);
    });

    /** HC survey: Budi rated by 4 responses (different times and stars), Dewi by 2, the team by all 4. */
    function hcSurveyWithAnswers(order: 'asc' | 'desc') {
        const survey = memoSurvey(1);
        survey.report.period.scope = 'HC';
        const stars = [3, 5, 1, 4];
        const answers = stars.map((star, index) => ({
            responseId: `resp${index}`, respondentName: `Penilai ${index}`, accountName: 'akun', areaName: 'Sepanjang', departmentName: 'Keuangan',
            submittedAt: new Date(Date.UTC(2025, 10, 3 + index)),
            ratees: [
                { periodRateeId: 't', kind: 'TEAM', displayName: 'Tim IT Support', jobTitle: null, comment: null, scores: [{ dimension: 'Kecepatan', type: 'STAR', score: star, answerLabel: null, answerText: null }] },
                { periodRateeId: 'r1', kind: 'PERSON', displayName: 'Budi Hartono', jobTitle: null, comment: null,
                    scores: [{ dimension: 'Ramah', type: 'STAR', score: star, answerLabel: null, answerText: null }, { dimension: 'Channel', type: 'CHOICE', score: null, answerLabel: `Opsi${star}`, answerText: null }] },
                ...(index < 2 ? [{ periodRateeId: 'r2', kind: 'PERSON', displayName: 'Dewi Lestari', jobTitle: null, comment: null,
                    scores: [{ dimension: 'Ramah', type: 'STAR', score: 2, answerLabel: null, answerText: null }, { dimension: 'Channel', type: 'CHOICE', score: null, answerLabel: `Rahasia${index}`, answerText: null }] }] : []),
            ],
        }));
        survey.answers = (order === 'asc' ? answers : [...answers].reverse()) as any;
        return survey;
    }

    it('HC memo answer rows never follow answer time: sorted by subject, then score, the same whatever the submit order', async () => {
        const answerText = async (order: 'asc' | 'desc') => (await pagesOf(await renderMemoPdf(memoHeader(), [hcSurveyWithAnswers(order)])))
            .filter((page) => page.includes('No.')).join(' ');
        const asc = await answerText('asc');
        expect(await answerText('desc')).toBe(asc);
        // Budi's rows by score, highest first (submit order was 3, 5, 1, 4).
        const budi = [...asc.matchAll(/Budi Hartono (\d) \d Opsi\d/g)].map((match) => Number(match[1]));
        expect(budi).toEqual([5, 4, 3, 1]);
    });

    it('HC memo hides the answer rows of a subject with fewer than 3 raters', async () => {
        const all = (await pagesOf(await renderMemoPdf(memoHeader(), [hcSurveyWithAnswers('asc')]))).join(' ');
        expect(all).toContain('Dewi Lestari: jawaban disembunyikan (kurang dari 3 penilai)');
        expect(all).not.toMatch(/Rahasia\d/);
        expect(all).toContain('Opsi5');
    });

    it('ICT memo keeps answer rows in submit order, one row per response and subject', async () => {
        const survey = hcSurveyWithAnswers('asc');
        survey.report.period.scope = 'ICT';
        const all = (await pagesOf(await renderMemoPdf(memoHeader(), [survey]))).join(' ');
        expect([...all.matchAll(/Penilai (\d)/g)].map((match) => Number(match[1]))).toEqual([0, 1, 2, 3]);
    });

    it('ICT memo still lists the respondents and reporters by name and email', async () => {
        const all = (await pagesOf(await renderMemoPdf(memoHeader(), [memoSurvey(1)]))).join(' ');
        for (const expected of ['Timestamp', 'titi yusliyanti', 'Email', 'a@sja.co.id', 'Andi']) expect(all).toContain(expected);
    });

    it('ICT survey with team and people keeps the single team table', async () => {
        const pages = await pagesOf(await renderMemoPdf(memoHeader(), [memoSurvey(1)]));
        const answerPages = pages.filter((page) => page.includes('Timestamp'));
        expect(answerPages).toHaveLength(1);
        expect(answerPages[0]).not.toContain('Dinilai');
    });

    it('a long signer title does not add a page', async () => {
        const title = 'Kepala Bagian Teknologi Informasi dan Operasional '.repeat(12);
        const buffer = await renderMemoPdf(memoHeader({ signerRight: { name: 'Siti Aminah', title } }), [memoSurvey(1)]);
        expect(await pagesOf(buffer)).toHaveLength(3);
    });

    (process.env.CSI_MEMO_SAMPLE ? it : it.skip)('writes a sample pdf', async () => {
        fs.writeFileSync(process.env.CSI_MEMO_SAMPLE as string, await renderMemoPdf(memoHeader(), [memoSurvey(1), memoSurvey(2)]));
    });
});
