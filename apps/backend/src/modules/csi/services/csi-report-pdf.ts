import { Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { Cell, Column, fmtDate, INK, Kpi, PAGE, ReportCanvas, Tone } from '../../reports/generators/report-pdf-canvas';
import { SignoffLayout } from '../../reports/generators/report-signoff';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { CsiRateeKind } from '../csi.constants';
import { cleanText } from './csi-format.util';
import { formatLongDate } from './csi-memo-page';
import { renderHcRecapPdf } from '../org/csi-hc-report.render';
import { CsiQuestionGrid, CsiReportModel, CsiReportRow } from './csi-report-model';
import { CsiScoreBand, CsiScoreBands, scoreBand } from './csi-score-bands';
import { scoreInk } from './csi-score-ink';

export type CsiReportPdfInput = { model: CsiReportModel; signoff: SignoffLayout; now: Date };

/** Question columns per grid table on A4 portrait (more questions continue in a second table). */
const GRID_COLUMNS = 7;
/** Short labels up to this length replace the P1..Pn codes as grid headers. */
const SHORT_HEADER_MAX = 16;
/** Score bars on page 1 up to this many questions; more move the "Aspek layanan" chart to page 2. */
const ASPECTS_ON_PAGE_ONE = 12;
const logger = new Logger('CsiReportPdf');

const DASH = '–';
const text = (value: string | null | undefined) => cleanText(value ?? '').replace(/^'([=+\-@\t\r])/, '$1');
const dec = (value: number | null | undefined, digits = 2) =>
    value === null || value === undefined || !Number.isFinite(value) ? DASH : value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (value: number | null | undefined, digits = 0) => (value === null || value === undefined ? DASH : `${dec(value, digits)}%`);
const signed = (value: number | null) => (value === null ? DASH : `${value > 0 ? '+' : value < 0 ? '-' : ''}${dec(Math.abs(value))}`);
const BAND_TONE: Record<CsiScoreBand, Tone> = { good: 'good', fair: 'warn', poor: 'bad' };
const scoreTone = (value: number | null, bands: CsiScoreBands): Tone => {
    const band = scoreBand(value, bands);
    return band ? BAND_TONE[band] : 'neutral';
};
const deltaColor = (value: number | null) => (value === null || value === 0 ? INK.secondary : value > 0 ? INK.green : INK.red);
const kindWord = (kind: CsiRateeKind) => (kind === CsiRateeKind.TEAM ? 'tim' : 'orang');

function summary(canvas: ReportCanvas, model: CsiReportModel) {
    const { overall, participation, counts } = model;
    const cards: Kpi[] = [
        { label: 'Nilai keseluruhan', value: `${dec(overall.average)} / 5`, note: overall.word ? `${overall.word} · indeks ${pct(overall.indexPct, 1)}` : 'Belum ada nilai', tone: scoreTone(overall.average, model.bands) },
        { label: 'Dibanding periode lalu', value: overall.delta === null ? DASH : signed(overall.delta), note: overall.previous === null ? 'Belum ada periode pembanding' : `Periode lalu: ${dec(overall.previous)}`, tone: overall.delta === null ? 'neutral' : overall.delta >= 0 ? 'good' : 'bad' },
        { label: participation.reached ? 'Partisipasi · target tercapai' : 'Partisipasi · target belum tercapai', value: pct(participation.respondenPct), note: `${participation.responses} dari ${participation.basis} · target ${model.targetPct}%`, tone: participation.reached ? 'good' : 'warn' },
        { label: 'Yang dinilai', value: String(counts.teams + counts.people), note: `${counts.teams} tim · ${counts.people} orang · ${counts.sites} site` },
    ];
    canvas.kpis(cards);
    canvas.highlights(model.highlights);
    if (model.notes) canvas.highlights(model.notes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean), 'CATATAN & TINDAK LANJUT', 'amber');
}

function siteAndAspects(canvas: ReportCanvas, model: CsiReportModel, aspectsHere: boolean) {
    // Sites without any basis or answer (e.g. not part of the rater list) are left out instead of showing 0/0.
    const siteRows = model.sites.filter((site) => site.basis > 0 || site.responses > 0).map((site) => ({
        label: `${site.code ?? ''} ${site.name ?? ''}`.trim(), value: site.respondenPct, color: site.reached ? INK.green : INK.amber,
        text: `${dec(site.average)} · ${site.responses}/${site.basis} (${pct(site.respondenPct)})`,
    }));
    const aspectRows = model.aspects.map((aspect) => ({ label: text(aspect.label), value: aspect.average, color: scoreInk(aspect.average, model.bands), text: dec(aspect.average) }));
    const groups: Parameters<ReportCanvas['scoreBars']>[0] = [{ title: `Per site · nilai dan partisipasi (garis = target ${model.targetPct}%)`, max: 100, target: model.targetPct, rows: siteRows }];
    if (aspectsHere) groups.push({ title: 'Aspek layanan · dari yang terlemah', max: 5, rows: aspectRows });
    canvas.section('Gambaran per site dan aspek layanan', 'Nilai rata-rata skala 1-5; partisipasi = responden dibanding basis site.');
    canvas.scoreBars(groups);
}

function rankingTable(canvas: ReportCanvas, rows: CsiReportRow[], kind: CsiRateeKind, bands: CsiScoreBands) {
    // Widths in points (scaled to the A4 content width); every cell has 16pt padding, so narrow columns stay >= 26.
    const columns: Column[] = [
        { header: '#', width: 32 }, { header: kind === CsiRateeKind.TEAM ? 'Tim' : 'Nama', width: 90 }, { header: 'Site', width: 34 },
        { header: 'Penilai', width: 44, align: 'right' }, { header: 'Nilai', width: 38, align: 'right' }, { header: 'Indeks', width: 44, align: 'right' },
        { header: 'Predikat', width: 92 }, { header: 'Lalu', width: 36, align: 'right' }, { header: 'Selisih', width: 44, align: 'right' },
        { header: 'Bintang', width: 62, align: 'right' },
    ];
    const body: Cell[][] = rows.map((row) => [
        { text: String(row.rank) }, { text: text(row.name), bold: true }, { text: row.siteCode ?? DASH }, { text: String(row.raters) },
        { text: dec(row.average), bold: true, color: scoreInk(row.average, bands) }, { text: pct(row.indexPct, 1) },
        { text: row.word ?? DASH, color: scoreInk(row.average, bands) }, { text: dec(row.previous) }, { text: signed(row.delta), color: deltaColor(row.delta) },
        { text: row.stars.join('/') },
    ]);
    canvas.table(columns, body, `Belum ada ${kindWord(kind)} yang dinilai.`);
}

function participation(canvas: ReportCanvas, model: CsiReportModel) {
    canvas.section('Partisipasi', `Basis = ${model.participation.basisLabel}. Target = ${model.targetPct}% dari basis. % Pengisi (SLA) = responden dibanding target, maks. 100%.`);
    const body: Cell[][] = model.sites.filter((site) => site.basis > 0 || site.responses > 0).map((site) => [
        { text: `${site.code ?? ''} ${site.name ?? ''}`.trim(), bold: true }, { text: String(site.basis) }, { text: String(site.target) },
        { text: String(site.responses) }, { text: pct(site.respondenPct) }, { text: pct(site.pengisiPct) },
        { text: site.reached ? 'Tercapai' : 'Belum', color: site.reached ? INK.green : INK.red, bold: true }, { text: dec(site.average), color: scoreInk(site.average, model.bands) },
    ]);
    const total = model.participation;
    body.push([
        { text: 'Total', bold: true }, { text: String(total.basis), bold: true }, { text: String(total.target), bold: true }, { text: String(total.responses), bold: true },
        { text: pct(total.respondenPct), bold: true }, { text: pct(total.pengisiPct), bold: true },
        { text: total.reached ? 'Tercapai' : 'Belum', color: total.reached ? INK.green : INK.red, bold: true }, { text: dec(model.overall.average), bold: true, color: scoreInk(model.overall.average, model.bands) },
    ]);
    canvas.table([
        { header: 'Site', width: 20 }, { header: 'Basis', width: 9, align: 'right' }, { header: 'Target', width: 9, align: 'right' },
        { header: 'Responden', width: 13, align: 'right' }, { header: '% Responden', width: 15, align: 'right' }, { header: '% Pengisi', width: 12, align: 'right' },
        { header: 'Status', width: 12 }, { header: 'Nilai', width: 10, align: 'right' },
    ], body);
}

/** Rows = teams/people, columns = question codes; wide grids continue in a second table with the names repeated. */
function questionGrid(canvas: ReportCanvas, grid: CsiQuestionGrid, title: string, bands: CsiScoreBands) {
    if (!grid.rows.length) return;
    canvas.section(title, 'Angka = RATA-RATA nilai (skala 1-5) dari semua responden yang menilai, jadi bisa desimal (mis. 3,50). Kosong (–) = pertanyaan tidak dipasang untuk yang dinilai itu.');
    // Short labels (e.g. the HC dimensions Knowledge … Tangible) are clear enough to be the column headers themselves.
    const named = grid.columns.every((column) => column.label !== column.full && column.label.length <= SHORT_HEADER_MAX);
    const header = (column: CsiQuestionGrid['columns'][number]) => (named ? text(column.label) : column.code);
    canvas.table([{ header: named ? 'Kolom' : 'Kode', width: 18 }, { header: 'Pertanyaan', width: 82 }],
        grid.columns.map((column) => [{ text: header(column), bold: true }, { text: text(column.full) }]));
    for (let start = 0; start < Math.max(1, grid.columns.length); start += GRID_COLUMNS) {
        const slice = grid.columns.slice(start, start + GRID_COLUMNS);
        const columns: Column[] = [{ header: 'Nama', width: 30 }, { header: 'Site', width: 8 }, ...slice.map((column) => ({ header: header(column), width: 62 / GRID_COLUMNS, align: 'right' as const }))];
        canvas.table(columns, grid.rows.map((row) => [
            { text: text(row.name), bold: true }, { text: row.siteCode ?? DASH },
            ...row.values.slice(start, start + GRID_COLUMNS).map((value) => ({ text: dec(value), color: scoreInk(value, bands), bold: value !== null })),
        ]));
    }
}

function appendix(canvas: ReportCanvas, model: CsiReportModel) {
    canvas.pageBreak();
    questionGrid(canvas, model.teamGrid, 'Lampiran A1 · Nilai per pertanyaan — Tim', model.bands);
    questionGrid(canvas, model.peopleGrid, 'Lampiran A2 · Nilai per pertanyaan — Orang', model.bands);
    if (model.choices.length) {
        canvas.section('Lampiran A3 · Jawaban pilihan', 'Pertanyaan tanpa nilai (jumlah jawaban per pilihan).');
        canvas.table([{ header: 'Pertanyaan', width: 40 }, { header: 'Jawaban', width: 60 }],
            model.choices.map((choice) => [{ text: text(choice.label), bold: true }, { text: choice.counts.map((row) => `${text(row.option)}: ${row.count}`).join('  ·  ') }]));
    }
    canvas.section('Lampiran B · Partisipasi per departemen', 'Penilai basis per departemen, tanpa nama. Departemen dengan kurang dari 3 penilai digabung.');
    canvas.table([{ header: 'Departemen', width: 52 }, { header: 'Sudah', width: 12, align: 'right' }, { header: 'Total', width: 12, align: 'right' }, { header: '%', width: 12, align: 'right' }, { header: 'Target', width: 12 }],
        model.departments.map((row) => [{ text: text(row.name) }, { text: String(row.submitted) }, { text: String(row.total) }, { text: pct(row.pct) }, { text: row.met ? 'Tercapai' : 'Belum', bold: true, color: row.met ? INK.green : INK.red }]),
        'Tidak ada basis partisipasi.');
    canvas.section('Lampiran C · Semua saran & komentar', `${model.counts.comments} komentar, dikelompokkan per tim/orang. Tanpa nama penilai.`);
    if (!model.comments.length) canvas.table([{ header: 'Komentar', width: 100 }], [], 'Tidak ada komentar.');
    model.comments.forEach((group) => {
        canvas.subheading(`${text(group.name)} (${kindWord(group.kind)})`, `${group.comments.length} komentar`);
        canvas.table([{ header: 'Komentar', width: 60 }, { header: 'Departemen', width: 25 }, { header: 'Tanggal', width: 15 }],
            group.comments.map((comment) => [{ text: text(comment.text) }, { text: text(comment.department) }, { text: fmtDate(comment.date) }]));
    });
}

/** Executive survey report (A4): page 1 summary, page 2+ analysis, then every detail as appendices and the sign-off. */
export function renderCsiReportPdf({ model, signoff, now }: CsiReportPdfInput): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: PAGE.margin, size: 'A4', bufferPages: true, info: { Title: text(model.title), Creator: 'iDesk CSI' } });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        try {
            const canvas = new ReportCanvas(doc, logger);
            canvas.header({
                title: `Laporan Kepuasan Layanan ${model.scopeLabel}`,
                period: `${text(model.title)} · ${formatLongDate(model.startDate)} - ${formatLongDate(model.endDate)}`,
                scope: `${text(model.siteLabel)} · Mode: ${model.modeLabel} · Target partisipasi ${model.targetPct}%`,
                docNo: model.docNo,
            });
            summary(canvas, model);
            const aspectsHere = model.aspects.length <= ASPECTS_ON_PAGE_ONE;
            siteAndAspects(canvas, model, aspectsHere);

            canvas.pageBreak();
            if (!aspectsHere) {
                canvas.section('Aspek layanan', 'Rata-rata per pertanyaan untuk semua yang dinilai, dari yang terlemah.');
                canvas.scoreBars([{ title: 'Nilai rata-rata (1-5)', max: 5, rows: model.aspects.map((aspect) => ({ label: text(aspect.label), value: aspect.average, color: scoreInk(aspect.average, model.bands), text: dec(aspect.average) })) }]);
            }
            canvas.section(`Peringkat tim · ${model.teams.length} tim`, 'Skala 1-5. Indeks = nilai/5 (%). Lalu = periode sebelumnya. Bintang = jumlah jawaban bintang 1/2/3/4/5.');
            rankingTable(canvas, model.teams, CsiRateeKind.TEAM, model.bands);
            canvas.section(`Peringkat orang · ${model.people.length} orang`, 'Urut dari nilai tertinggi, semua orang dicantumkan.');
            rankingTable(canvas, model.people, CsiRateeKind.PERSON, model.bands);
            participation(canvas, model);
            if (model.hcRecap?.services.length) renderHcRecapPdf(canvas, model.hcRecap, model.bands);

            appendix(canvas, model);
            canvas.section('Pengesahan', `Dicetak ${formatLongDate(localDateKey(now, DEFAULT_TIMEZONE))}`);
            canvas.signOff(signoff);
            canvas.finish();
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}
