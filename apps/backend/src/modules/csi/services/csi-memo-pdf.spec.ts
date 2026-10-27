import * as fs from 'fs';
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
            'Lokasi', 'Nama', 'Average', '% Pengisi (SLA)', 'SJA Sepanjang & SJA Sukodono', 'SJA Karawang',
            'Budi Hartono', 'Dewi Lestari', '4,52', '100%', 'Hormat kami', 'Mengetahui', 'Budi Santoso', 'ICT Manager',
        ]) expect(text).toContain(expected);
        expect(text).toContain('Tim IT Support'); // survey 2 has no PERSON ratee: team label in Nama
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
        // Spec: % Responden = responden / pelapor (2 of 3 -> 67%), next to % Pengisi (SLA) = responden / target.
        expect(text).toMatch(/% Responden\s*67%/);
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
        expect(pages[holder]).toContain('% Pengisi (SLA)');
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
        expect(all).toMatch(/kata\d+(…|\.\.\.)/); // pdf-parse extracts the ellipsis glyph as three dots
        expect(all.replace(/\s/g, '')).not.toContain(long.replace(/\s/g, ''));
        expect(pages).toHaveLength(3); // memo, answers, SLA: the oversized row never spills onto an extra page
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
