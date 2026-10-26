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
    });

    it('strips control characters from user strings', async () => {
        const buffer = await renderMemoPdf(memoHeader({ to: 'Pak\u0000 Budi' }), [memoSurvey(1)]);
        expect(norm((await pdfParse(buffer)).text)).toContain('Pak Budi');
    });

    (process.env.CSI_MEMO_SAMPLE ? it : it.skip)('writes a sample pdf', async () => {
        fs.writeFileSync(process.env.CSI_MEMO_SAMPLE as string, await renderMemoPdf(memoHeader(), [memoSurvey(1), memoSurvey(2)]));
    });
});
