import { Logger } from '@nestjs/common';
import {
    ReportCanvas,
    categoryRows,
    fmtDateTime,
    fmtMinutes,
    fmtPeriod,
    humanizeSentence,
    priorityRows,
    statusRows,
} from './report-pdf-canvas';
import { SignoffLayout } from './report-signoff';

describe('report PDF formatting', () => {
    it('shows enum values with the labels the app uses', () => {
        expect(statusRows({ WAITING_VENDOR: 2, TODO: 5 }).map((r) => r.label)).toEqual(['Open', 'Waiting Vendor']);
        expect(priorityRows({ MEDIUM: 9, CRITICAL: 1, HIGH: 3 }).map((r) => r.label)).toEqual(['Blocker', 'Urgent', 'Normal']);
        expect(categoryRows({ HARDWARE: 3 })[0].label).toBe('Hardware');
    });

    it('groups the long tail of categories as "Lainnya"', () => {
        const rows = categoryRows({ A: 9, B: 8, C: 7, D: 1, E: 1 }, 3);
        expect(rows.map((r) => r.label)).toEqual(['A', 'B', 'C', 'Lainnya']);
        expect(rows[3].value).toBe(2);
    });

    it('rewrites insight sentences for Indonesian readers without touching thousands', () => {
        expect(humanizeSentence('Kategori terbanyak "SOFTWARE_LICENSE" (32.0%) dari 1.234 tiket, rata-rata 6.4 jam.'))
            .toBe('Kategori terbanyak Software license (32,0%) dari 1.234 tiket, rata-rata 6,4 jam.');
    });

    it('prints times in WIB whatever the server timezone', () => {
        expect(fmtDateTime(new Date('2026-10-23T07:42:00Z'))).toMatch(/23 Okt 2026, 14[.:]42 WIB/);
    });

    it('reads a manager period string as a date range', () => {
        expect(fmtPeriod('2026-10-01 to 2026-10-31')).toBe('1 Okt 2026 - 31 Okt 2026');
        expect(fmtPeriod('bukan tanggal')).toBe('bukan tanggal');
    });

    it('formats durations in the unit a reader expects', () => {
        expect(fmtMinutes(14)).toBe('14 mnt');
        expect(fmtMinutes(95)).toBe('1,6 jam');
        expect(fmtMinutes(60 * 72)).toBe('3,0 hari');
    });

    describe('sign-off block', () => {
        const PDFDocument = require('pdfkit');
        const render = (layout: SignoffLayout) => {
            const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
            doc.on('data', () => undefined);
            const spy = jest.spyOn(doc, 'text');
            new ReportCanvas(doc, new Logger('test')).signOff(layout);
            const pages = doc.bufferedPageRange().count;
            doc.end();
            return { drawn: spy.mock.calls.map((call) => String(call[0])), pages };
        };
        const slot = (name: string, extra: Partial<SignoffLayout['slots'][number]> = {}) => ({ title: 'Disiapkan oleh', name, role: '', align: 'left' as const, showDate: true, ...extra });

        it('draws every signer, not just two', () => {
            const { drawn } = render({ columns: 3, slots: ['A', 'B', 'C', 'D', 'E'].map((n) => slot(n)) });
            expect(drawn).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', 'E']));
            expect(drawn.filter((t) => t === 'Tanggal:')).toHaveLength(5);
        });

        it('shows the role only when set and the date line only when asked', () => {
            const { drawn } = render({ columns: 2, slots: [slot('A', { role: 'Head of ICT', showDate: false }), slot('B')] });
            expect(drawn).toContain('Head of ICT');
            expect(drawn.filter((t) => t === 'Tanggal:')).toHaveLength(1);
        });

        it('draws nothing for an empty layout', () => {
            expect(render({ columns: 2, slots: [] }).drawn).toEqual([]);
        });

        it('keeps a twelve-signer block on a single page', () => {
            expect(render({ columns: 4, slots: Array.from({ length: 12 }, (_, i) => slot(`N${i}`)) }).pages).toBe(1);
        });
    });

    describe('table cells', () => {
        const PDFDocument = require('pdfkit');
        const columns = [
            { header: 'Teknisi', width: 3.2 }, { header: 'Tugas', width: 0.9, align: 'right' as const }, { header: 'Selesai', width: 0.95, align: 'right' as const },
            { header: '% Selesai', width: 1.1, align: 'right' as const }, { header: 'Respon', width: 1, align: 'right' as const },
            { header: 'Durasi', width: 1, align: 'right' as const }, { header: 'SLA', width: 0.9, align: 'right' as const },
        ];
        const drawnTexts = (nameCell: string): string[] => {
            const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
            doc.on('data', () => undefined);
            const spy = jest.spyOn(doc, 'text');
            const canvas = new ReportCanvas(doc, new Logger('test'));
            canvas.table(columns, [[{ text: nameCell, bold: true }, { text: '14' }, { text: '12' }, { text: '85,7%' }, { text: '14 mnt' }, { text: '1,6 jam' }, { text: '90,0%' }]]);
            doc.end();
            return spy.mock.calls.map((call) => String(call[0]));
        };

        it('keeps the cross-site marker and the eligible count whole in a multi-line name cell', () => {
            const drawn = drawnTexts('Hasby Tri Ananda · Sepanjang (lintas site)\n2 batal · 12 eligible');
            expect(drawn.some((t) => t.includes('...'))).toBe(false);
            expect(drawn.join(' ')).toContain('(lintas site)');
            expect(drawn).toContain('2 batal · 12 eligible');
        });

        it('keeps explicit lines whole when the name and site are on separate lines', () => {
            const drawn = drawnTexts('Hasby Tri Ananda\nSepanjang (lintas site)\n2 batal · 12 eligible');
            expect(drawn).toEqual(expect.arrayContaining(['Hasby Tri Ananda', 'Sepanjang (lintas site)', '2 batal · 12 eligible']));
            expect(drawn.some((t) => t.includes('...'))).toBe(false);
        });

        it('headers are not truncated: a long header in a narrow column wraps (hyphenated) instead of "..."', () => {
            const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
            doc.on('data', () => undefined);
            const spy = jest.spyOn(doc, 'text');
            new ReportCanvas(doc, new Logger('test')).table(
                [{ header: 'Layanan / Bagian / PIC', width: 30 }, ...['Knowledge', 'Responsiveness', 'Courtesy', 'Communication', 'Tangible', 'Rata-rata', 'Penilai'].map((header) => ({ header, width: 10 }))],
                [[{ text: 'HCC' }, ...Array.from({ length: 7 }, () => ({ text: '4,50' }))]],
            );
            doc.end();
            const drawn = spy.mock.calls.map((call) => String(call[0]));
            expect(drawn.some((t) => t.includes('...'))).toBe(false);
            expect(drawn.join('|').replace(/-\|/g, '')).toMatch(/Responsiveness/);
            expect(drawn.join('|').replace(/-\|/g, '')).toMatch(/Communication/);
        });
    });

    it('finish draws the banner at the top and the footer note on every page', () => {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
        doc.on('data', () => undefined);
        const canvas = new ReportCanvas(doc, new Logger('test'));
        canvas.pageBreak();
        canvas.pageBreak();
        const spy = jest.spyOn(doc, 'text');
        canvas.finish({ banner: 'BANNER X', footerNote: 'CATATAN Y' });
        doc.end();
        const drawn = spy.mock.calls.map((call) => String(call[0]));
        expect(drawn.filter((t) => t === 'BANNER X')).toHaveLength(3);
        expect(drawn.filter((t) => t === 'CATATAN Y')).toHaveLength(3);
    });
});
