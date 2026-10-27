import { Logger } from '@nestjs/common';
import { resolveSantosLogoPath } from '../../../shared/core/utils/brand-logo.util';

/*
 * Drawing kit for the executive report PDFs (pdfkit, built-in Helvetica).
 * Layout rules: A4 portrait, 40 pt margins, body text never below 8 pt, numbers right-aligned,
 * every date and time in WIB, enum values shown with the same labels the app uses.
 * Helvetica is WinAnsi: no arrows or emoji in any string drawn here.
 */

const WIB = 'Asia/Jakarta';

export const PAGE = { width: 595.28, height: 841.89, margin: 40 } as const;
const CONTENT_W = PAGE.width - PAGE.margin * 2;
const FOOTER_Y = PAGE.height - 34;
/** Lowest y content may reach before a new page starts (leaves room for the footer). */
const CONTENT_BOTTOM = FOOTER_Y - 10;

export const INK = {
    text: '#1D1D1F',
    secondary: '#5F5F66',
    tertiary: '#8A8A90',
    line: '#E3E3E8',
    fill: '#F4F5F8',
    brand: '#2D4A8C',
    brandSoft: '#E8EDF7',
    green: '#1E7D46',
    amber: '#B26A00',
    red: '#C0392B',
    sky: '#2F7FD1',
    gray: '#8A8A90',
} as const;

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';
const TONE_COLOR: Record<Tone, string> = { good: INK.green, warn: INK.amber, bad: INK.red, neutral: INK.brand };

// ─── Labels (match the app) ──────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    TODO: 'Open', OPEN: 'Open', IN_PROGRESS: 'In Progress', WAITING_VENDOR: 'Waiting Vendor',
    RESOLVED: 'Resolved', CLOSED: 'Closed', CANCELLED: 'Dibatalkan',
};
const STATUS_COLOR: Record<string, string> = {
    TODO: INK.sky, OPEN: INK.sky, IN_PROGRESS: INK.brand, WAITING_VENDOR: INK.amber,
    RESOLVED: INK.green, CLOSED: INK.gray, CANCELLED: INK.red,
};
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Low', MEDIUM: 'Normal', HIGH: 'Urgent', URGENT: 'Urgent', CRITICAL: 'Blocker' };
const PRIORITY_COLOR: Record<string, string> = { LOW: INK.gray, MEDIUM: INK.brand, HIGH: INK.amber, URGENT: INK.amber, CRITICAL: INK.red };
const PRIORITY_ORDER = ['CRITICAL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'];

/** "WAITING_VENDOR" -> "Waiting vendor"; already readable text is kept. */
export const humanize = (key: string): string =>
    /^[A-Z0-9_]+$/.test(key) ? key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ') : key;
export const statusLabel = (key: string) => STATUS_LABEL[key] ?? humanize(key);
export const priorityLabel = (key: string) => PRIORITY_LABEL[key] ?? humanize(key);

export interface BarRow { label: string; value: number; color?: string }

export function statusRows(data?: Record<string, number>): BarRow[] {
    return Object.entries(data ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ label: statusLabel(key), value, color: STATUS_COLOR[key] }));
}
export function priorityRows(data?: Record<string, number>): BarRow[] {
    const rank = (key: string) => (PRIORITY_ORDER.indexOf(key) + 1) || 99;
    return Object.entries(data ?? {})
        .sort((a, b) => rank(a[0]) - rank(b[0]))
        .map(([key, value]) => ({ label: priorityLabel(key), value, color: PRIORITY_COLOR[key] }));
}
export function categoryRows(data?: Record<string, number>, limit = 6): BarRow[] {
    const sorted = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
    const rows = sorted.slice(0, limit).map(([key, value]) => ({ label: humanize(key), value }));
    const rest = sorted.slice(limit).reduce((sum, [, value]) => sum + value, 0);
    return rest > 0 ? [...rows, { label: 'Lainnya', value: rest, color: INK.gray }] : rows;
}

/**
 * Insight sentences as an Indonesian reader expects them: quoted enum values become labels ("HARDWARE" -> Hardware)
 * and one-digit decimals use a comma (89.0% -> 89,0%). Thousands ("1.234") have three digits and are left alone.
 */
export const humanizeSentence = (text: string): string =>
    text.replace(/"([A-Z0-9_]+)"/g, (_m, key: string) => humanize(key)).replace(/(\d)\.(\d)(?!\d)/g, '$1,$2');

// ─── Number, date and time formatting (Indonesian, WIB) ──────

export const fmtInt = (n: number) => Math.round(Number(n) || 0).toLocaleString('id-ID');
export const fmtDec = (n: number, digits = 1) =>
    (Number(n) || 0).toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const REPORT_COHORT = 'Tiket dibuat dalam periode; status saat laporan diambil';
/** Daily trend labels: "resolved" per day counts tickets created that day which are done now, not tickets finished that day. */
export const DAILY_CREATED_LABEL = 'Dibuat';
export const DAILY_DONE_LABEL = 'Kini selesai';
export const DAILY_DONE_LONG_LABEL = 'Dari tiket hari itu yang kini selesai';
export const DAILY_TREND_CAPTION = 'Tiket dibuat per hari, dan dari tiket hari itu berapa yang kini selesai.';
export const fmtPct = (n: number | null | undefined, digits = 1) => n == null || !Number.isFinite(n) ? '—' : `${fmtDec(n, digits)}%`;

/** 14 -> "14 mnt", 95 -> "1,6 jam", 3000 -> "2,1 hari". */
export function fmtMinutes(minutes: number | null): string {
    if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '—';
    const m = minutes;
    if (m < 1) return '<1 menit';
    if (m < 60) return `${fmtInt(m)} mnt`;
    if (m < 60 * 48) return `${fmtDec(m / 60)} jam`;
    return `${fmtDec(m / 60 / 24)} hari`;
}
export const fmtHours = (hours: number | null | undefined) => fmtMinutes(hours == null ? null : hours * 60);

const DATE_FMT = new Intl.DateTimeFormat('id-ID', { timeZone: WIB, day: 'numeric', month: 'short', year: 'numeric' });
const DATE_SHORT_FMT = new Intl.DateTimeFormat('id-ID', { timeZone: WIB, day: 'numeric', month: 'short' });
const TIME_FMT = new Intl.DateTimeFormat('id-ID', { timeZone: WIB, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const fmtDate = (d: Date) => DATE_FMT.format(d);
export const fmtDateShort = (d: Date) => DATE_SHORT_FMT.format(d);
export const fmtDateTime = (d: Date) => `${DATE_FMT.format(d)}, ${TIME_FMT.format(d)} WIB`;

/** "1 Okt 2026 - 31 Okt 2026" for a range; accepts Date objects or "YYYY-MM-DD to YYYY-MM-DD". */
export function fmtPeriod(range?: { startDate: Date; endDate: Date } | string): string {
    if (!range) return `Per ${fmtDate(new Date())}`;
    if (typeof range === 'string') {
        const [from, to] = range.split(/\s+to\s+/);
        const start = new Date(`${from}T00:00:00+07:00`);
        const end = to ? new Date(`${to}T00:00:00+07:00`) : start;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return range;
        return fmtPeriod({ startDate: start, endDate: end });
    }
    return `${fmtDate(range.startDate)} - ${fmtDate(range.endDate)}`;
}

export const toneForRate = (rate: number | null, good = 90, warn = 75): Tone =>
    rate == null ? 'neutral' : rate >= good ? 'good' : rate >= warn ? 'warn' : 'bad';

// ─── Canvas ──────────────────────────────────────────────────

export interface HeaderInfo { title: string; period: string; scope: string; docNo: string }
export interface Kpi { label: string; value: string; note?: string; tone?: Tone }
export interface Column { header: string; width: number; align?: 'left' | 'right' | 'center' }
export interface Cell { text: string; color?: string; bold?: boolean }
export interface MiniStat { label: string; value: string; tone?: Tone }

/** One report document: tracks the write position and starts new pages when content would overflow. */
export class ReportCanvas {
    private y: number = PAGE.margin;

    constructor(private readonly doc: any, private readonly logger: Logger) {}

    /** Starts a new page when `height` more points would not fit. */
    ensure(height: number): void {
        if (this.y + height <= CONTENT_BOTTOM) return;
        this.doc.addPage();
        this.y = PAGE.margin;
    }

    gap(points: number): void {
        this.y += points;
    }

    /** One line of text in the current font, shortened with "..." to fit (pdfkit's ellipsis needs a fixed height). */
    private line(text: string, x: number, y: number, width: number, align: 'left' | 'right' | 'center' = 'left'): void {
        const { doc } = this;
        let fitted = text;
        if (doc.widthOfString(fitted) > width) {
            while (fitted.length > 1 && doc.widthOfString(`${fitted}...`) > width) fitted = fitted.slice(0, -1);
            fitted = `${fitted.trimEnd()}...`;
        }
        doc.text(fitted, x, y, { width, align, lineBreak: false });
    }

    /**
     * Splits text at explicit newlines, then wraps each line at word boundaries so it fits `width` in the current font.
     * A single word wider than `width` stays whole here; line() shortens it.
     */
    private wrap(text: string, width: number): string[] {
        const { doc } = this;
        return text.split('\n').flatMap((paragraph) => {
            const lines: string[] = [];
            let current = '';
            paragraph.split(' ').forEach((word) => {
                const candidate = current ? `${current} ${word}` : word;
                if (current && doc.widthOfString(candidate) > width) {
                    lines.push(current);
                    current = word;
                } else {
                    current = candidate;
                }
            });
            lines.push(current);
            return lines;
        });
    }

    private font(bold: boolean, size: number, color: string): void {
        this.doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
    }

    header(info: HeaderInfo): void {
        const { doc } = this;
        const x = PAGE.margin;
        const top = 34;
        const logoPath = resolveSantosLogoPath();
        try {
            if (!logoPath) throw new Error('santos-logo.png not found');
            doc.image(logoPath, x, top, { fit: [28, 28] });
        } catch (err) {
            // The report is still valid without the logo.
            this.logger.warn(`PDF header rendered without logo: ${(err as Error).message}`);
        }
        this.font(true, 9.5, INK.text);
        this.line('PT SANTOS JAYA ABADI', x + 36, top + 3, 220);
        this.font(false, 8, INK.secondary);
        this.line('iDesk  |  IT Helpdesk', x + 36, top + 16, 220);

        const metaW = 210;
        const metaX = PAGE.width - PAGE.margin - metaW;
        this.font(false, 8, INK.secondary);
        this.line(`No. ${info.docNo}`, metaX, top + 1, metaW, 'right');
        this.line(`Dicetak ${fmtDateTime(new Date())}`, metaX, top + 12, metaW, 'right');
        this.font(true, 7.5, INK.red);
        this.line('INTERNAL', metaX, top + 23, metaW, 'right');

        doc.moveTo(x, top + 40).lineTo(x + CONTENT_W, top + 40).lineWidth(0.6).strokeColor(INK.line).stroke();

        let y = top + 54;
        this.font(true, 20, INK.text);
        doc.text(info.title, x, y, { width: CONTENT_W });
        y += doc.heightOfString(info.title, { width: CONTENT_W }) + 4;
        this.font(true, 11, INK.brand);
        this.line(info.period, x, y, CONTENT_W);
        y += 16;
        this.font(false, 9, INK.secondary);
        this.line(`Cakupan: ${info.scope}`, x, y, CONTENT_W);
        this.y = y + 26;
    }

    section(title: string, caption?: string): void {
        this.ensure(caption ? 44 : 32);
        this.font(true, 12, INK.text);
        this.line(title, PAGE.margin, this.y, CONTENT_W);
        this.y += 16;
        if (caption) {
            this.font(false, 8.5, INK.secondary);
            this.line(caption, PAGE.margin, this.y, CONTENT_W);
            this.y += 13;
        }
        this.y += 6;
    }

    kpis(cards: Kpi[]): void {
        const { doc } = this;
        const gap = 10;
        const h = 68;
        const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
        this.ensure(h + 16);
        cards.forEach((card, i) => {
            const x = PAGE.margin + i * (w + gap);
            doc.roundedRect(x, this.y, w, h, 8).fill(INK.fill);
            this.font(false, 8.5, INK.secondary);
            this.line(card.label, x + 12, this.y + 11, w - 24);
            // Long values (a name) step down in size before they would be cut.
            let size = 20;
            this.font(true, size, INK.text);
            while (size > 13 && doc.widthOfString(card.value) > w - 24) this.font(true, --size, INK.text);
            this.line(card.value, x + 12, this.y + 24 + (20 - size) / 2, w - 24);
            if (card.note) {
                const color = card.tone ? TONE_COLOR[card.tone] : INK.secondary;
                let noteX = x + 12;
                if (card.tone) {
                    doc.circle(noteX + 2.5, this.y + 54.5, 2.5).fill(color);
                    noteX += 9;
                }
                this.font(false, 8, color);
                this.line(card.note, noteX, this.y + 51, w - (noteX - x) - 10);
            }
        });
        this.y += h + 18;
    }

    /** "Poin utama": the sentences an executive reads first. */
    highlights(lines: string[]): void {
        if (lines.length === 0) return;
        const { doc } = this;
        const pad = 14;
        const textW = CONTENT_W - pad * 2 - 12;
        const texts = lines.map(humanizeSentence);
        this.font(false, 9.5, INK.text);
        const heights = texts.map((t) => doc.heightOfString(t, { width: textW, lineGap: 2 }));
        const h = pad * 2 + 16 + heights.reduce((a, b) => a + b, 0) + (texts.length - 1) * 6;
        this.ensure(h + 16);

        doc.roundedRect(PAGE.margin, this.y, CONTENT_W, h, 8).fill(INK.brandSoft);
        this.font(true, 8.5, INK.brand);
        doc.text('POIN UTAMA', PAGE.margin + pad, this.y + pad, { characterSpacing: 0.6, lineBreak: false });
        let y = this.y + pad + 16;
        texts.forEach((text, i) => {
            doc.circle(PAGE.margin + pad + 2.5, y + 5.5, 2.5).fill(INK.brand);
            this.font(false, 9.5, INK.text);
            doc.text(text, PAGE.margin + pad + 12, y, { width: textW, lineGap: 2 });
            y += heights[i] + 6;
        });
        this.y += h + 22;
    }

    /** Side-by-side lists of labelled bars ("Kategori", "Prioritas", "Status"), each scaled to its own total. */
    barGroups(groups: { title: string; rows: BarRow[] }[]): void {
        const { doc } = this;
        const gap = 18;
        const w = (CONTENT_W - gap * (groups.length - 1)) / groups.length;
        const rowH = 25;
        const tallest = Math.max(1, ...groups.map((g) => g.rows.length));
        this.ensure(18 + tallest * rowH + 10);

        groups.forEach((group, gi) => {
            const x = PAGE.margin + gi * (w + gap);
            this.font(true, 9, INK.secondary);
            this.line(group.title, x, this.y, w);
            const total = group.rows.reduce((sum, r) => sum + r.value, 0);
            if (group.rows.length === 0 || total === 0) {
                this.font(false, 9, INK.tertiary);
                this.line('Tidak ada data', x, this.y + 18, w);
                return;
            }
            group.rows.forEach((row, ri) => {
                const ry = this.y + 18 + ri * rowH;
                const pct = (row.value / total) * 100;
                this.font(false, 9, INK.text);
                this.line(row.label, x, ry, w - 66);
                this.font(true, 9, INK.text);
                this.line(fmtInt(row.value), x + w - 64, ry, 32, 'right');
                this.font(false, 8, INK.tertiary);
                this.line(`${Math.round(pct)}%`, x + w - 30, ry + 0.5, 30, 'right');
                doc.roundedRect(x, ry + 13, w, 5, 2.5).fill(INK.fill);
                if (row.value > 0) doc.roundedRect(x, ry + 13, Math.max(5, (w * pct) / 100), 5, 2.5).fill(row.color ?? INK.brand);
            });
        });
        this.y += 18 + tallest * rowH + 10;
    }

    /** Rows of small outlined figures (SLA details and the like). */
    miniStats(stats: MiniStat[], perRow = 3): void {
        const { doc } = this;
        const gap = 10;
        const h = 46;
        const w = (CONTENT_W - gap * (perRow - 1)) / perRow;
        for (let i = 0; i < stats.length; i += perRow) {
            this.ensure(h + gap);
            stats.slice(i, i + perRow).forEach((stat, j) => {
                const x = PAGE.margin + j * (w + gap);
                doc.roundedRect(x, this.y, w, h, 7).lineWidth(0.7).strokeColor(INK.line).stroke();
                this.font(false, 8.5, INK.secondary);
                this.line(stat.label, x + 11, this.y + 9, w - 22);
                this.font(true, 13, stat.tone ? TONE_COLOR[stat.tone] : INK.text);
                this.line(stat.value, x + 11, this.y + 23, w - 22);
            });
            this.y += h + gap;
        }
        this.y += 8;
    }

    /** Table with a light header row that repeats on every page it spans. Column widths are relative. */
    table(columns: Column[], rows: Cell[][], emptyText = 'Tidak ada data pada periode ini.'): void {
        const { doc } = this;
        const totalW = columns.reduce((sum, c) => sum + c.width, 0);
        const cols = columns.map((c) => ({ ...c, width: (c.width * CONTENT_W) / totalW }));
        const headH = 22;
        const minRowH = 22;
        const lineH = 11;
        const rowPad = 11;

        const drawHead = () => {
            doc.roundedRect(PAGE.margin, this.y, CONTENT_W, headH, 5).fill(INK.fill);
            let x = PAGE.margin;
            this.font(true, 8.5, INK.secondary);
            cols.forEach((c) => {
                this.line(c.header, x + 8, this.y + 7, c.width - 16, c.align);
                x += c.width;
            });
            this.y += headH;
        };

        this.ensure(headH + minRowH * Math.min(rows.length || 1, 3));
        drawHead();
        if (rows.length === 0) {
            this.font(false, 9, INK.tertiary);
            this.line(emptyText, PAGE.margin + 8, this.y + 7, CONTENT_W - 16);
            this.y += minRowH + 12;
            return;
        }
        rows.forEach((row) => {
            // Cells wrap onto extra lines instead of being cut; the row grows to the tallest cell.
            const cellLines = row.map((cell, ci) => {
                this.font(Boolean(cell.bold), 9, cell.color ?? INK.text);
                return this.wrap(cell.text, cols[ci].width - 16);
            });
            const rowH = Math.max(minRowH, rowPad + Math.max(...cellLines.map((l) => l.length)) * lineH);
            if (this.y + rowH > CONTENT_BOTTOM) {
                doc.addPage();
                this.y = PAGE.margin;
                drawHead();
            }
            let x = PAGE.margin;
            row.forEach((cell, ci) => {
                const c = cols[ci];
                this.font(Boolean(cell.bold), 9, cell.color ?? INK.text);
                cellLines[ci].forEach((text, li) => this.line(text, x + 8, this.y + 7 + li * lineH, c.width - 16, c.align));
                x += c.width;
            });
            doc.moveTo(PAGE.margin, this.y + rowH).lineTo(PAGE.margin + CONTENT_W, this.y + rowH).lineWidth(0.5).strokeColor(INK.line).stroke();
            this.y += rowH;
        });
        this.y += 16;
    }

    /** Created per day vs how many of that day's tickets are done now, with a value axis and day-of-month labels. */
    dailyChart(daily: { date: string; created: number; resolved: number }[]): void {
        if (daily.length === 0) return;
        const { doc } = this;
        const days = daily.slice(-31);
        const plotH = 96;
        const axisW = 26;
        this.ensure(16 + plotH + 30);

        const legend = (x: number, color: string, label: string) => {
            doc.roundedRect(x, this.y + 1.5, 8, 8, 2).fill(color);
            this.font(false, 8.5, INK.secondary);
            this.line(label, x + 12, this.y + 1, 80);
        };
        legend(PAGE.margin + CONTENT_W - 190, INK.brand, DAILY_CREATED_LABEL);
        legend(PAGE.margin + CONTENT_W - 95, INK.green, DAILY_DONE_LABEL);

        const top = this.y + 18;
        const plotX = PAGE.margin + axisW;
        const plotW = CONTENT_W - axisW;
        const max = Math.max(1, ...days.map((d) => Math.max(d.created || 0, d.resolved || 0)));
        const step = Math.max(1, Math.ceil(max / 4));
        const axisMax = step * 4;
        for (let t = 0; t <= 4; t++) {
            const gy = top + plotH - (plotH * t) / 4;
            doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).lineWidth(0.5).strokeColor(INK.line).stroke();
            this.font(false, 7.5, INK.tertiary);
            this.line(String(step * t), PAGE.margin, gy - 3.5, axisW - 6, 'right');
        }
        const slot = plotW / days.length;
        const barW = Math.min(7, slot * 0.36);
        days.forEach((d, i) => {
            const cx = plotX + slot * i + slot / 2;
            const ch = ((d.created || 0) / axisMax) * plotH;
            const rh = ((d.resolved || 0) / axisMax) * plotH;
            if (ch > 0) doc.rect(cx - barW - 0.5, top + plotH - ch, barW, ch).fill(INK.brand);
            if (rh > 0) doc.rect(cx + 0.5, top + plotH - rh, barW, rh).fill(INK.green);
            const day = Number(String(d.date).slice(8, 10));
            if (i === 0 || i === days.length - 1 || (day > 0 && day % 5 === 0)) {
                this.font(false, 7.5, INK.tertiary);
                this.line(day > 0 ? String(day) : String(d.date), cx - 12, top + plotH + 5, 24, 'center');
            }
        });
        this.y = top + plotH + 26;
    }

    signOff(preparedBy: string, approvedBy: string): void {
        const { doc } = this;
        const h = 74;
        this.ensure(h);
        this.y += 4;
        const w = (CONTENT_W - 30) / 2;
        [
            { title: 'Disiapkan oleh', name: preparedBy, x: PAGE.margin },
            { title: 'Diketahui / disetujui oleh', name: approvedBy, x: PAGE.margin + w + 30 },
        ].forEach((col) => {
            this.font(false, 8.5, INK.secondary);
            this.line(col.title, col.x, this.y, w);
            doc.moveTo(col.x, this.y + 44).lineTo(col.x + w * 0.75, this.y + 44).lineWidth(0.7).strokeColor(INK.tertiary).stroke();
            this.font(true, 9.5, INK.text);
            this.line(col.name, col.x, this.y + 50, w);
            this.font(false, 8, INK.tertiary);
            this.line('Tanggal:', col.x, this.y + 63, w);
        });
        this.y += h;
    }

    /** Page footers; call once, after all content. */
    finish(): void {
        const { doc } = this;
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            const savedBottom = doc.page.margins.bottom;
            doc.page.margins.bottom = 0; // the footer sits in the margin; never trigger an automatic page break
            doc.moveTo(PAGE.margin, FOOTER_Y).lineTo(PAGE.width - PAGE.margin, FOOTER_Y).lineWidth(0.5).strokeColor(INK.line).stroke();
            this.font(false, 7.5, INK.tertiary);
            this.line('PT Santos Jaya Abadi  |  iDesk IT Helpdesk  |  Dokumen internal', PAGE.margin, FOOTER_Y + 7, CONTENT_W - 130);
            this.line(`Halaman ${i + 1} dari ${range.count}`, PAGE.width - PAGE.margin - 120, FOOTER_Y + 7, 120, 'right');
            doc.page.margins.bottom = savedBottom;
        }
    }
}
