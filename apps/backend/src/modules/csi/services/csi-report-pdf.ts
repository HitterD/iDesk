import { Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { Cell, Column, INK, PAGE, ReportCanvas } from '../../reports/generators/report-pdf-canvas';
import { SignoffLayout } from '../../reports/generators/report-signoff';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { CSI_SIMULATION_BANNER } from '../csi.constants';
import { renderHcReportPdf } from '../org/csi-hc-report.pdf';
import { formatLongDate } from './csi-memo-page';
import { CsiQuestionGrid, CsiReportModel } from './csi-report-model';
import {
    choicesTable, commentsSection, dec, departmentsTable, DASH, kindWord, pct, rankingSection, shuffledTexts, summary, TABLE_KEEP, text,
} from './csi-report-pdf-sections';
import { CsiScoreBands } from './csi-score-bands';
import { scoreInk } from './csi-score-ink';

export type CsiReportPdfInput = { model: CsiReportModel; signoff: SignoffLayout; now: Date };

/** Question columns per grid table on A4 portrait (more questions continue in a second table). */
const GRID_COLUMNS = 7;
/** Short labels up to this length replace the P1..Pn codes as grid headers. */
const SHORT_HEADER_MAX = 16;
/** Score bars on page 1 up to this many questions; more move the "Aspek layanan" chart to page 2. */
const ASPECTS_ON_PAGE_ONE = 12;
const logger = new Logger('CsiReportPdf');

function siteAndAspects(canvas: ReportCanvas, model: CsiReportModel, aspectsHere: boolean) {
    // Keep every period site (even 0/0) so selected branches such as Sukodono stay visible.
    const siteRows = model.sites.map((site) => ({
        label: `${site.code ?? ''} ${site.name ?? ''}`.trim(), value: site.respondenPct, color: site.reached ? INK.green : INK.amber,
        text: `${dec(site.average)} · ${site.responses}/${site.basis} (${pct(site.respondenPct)})`,
    }));
    const aspectRows = model.aspects.map((aspect) => ({ label: text(aspect.label), value: aspect.average, color: scoreInk(aspect.average, model.bands), text: dec(aspect.average) }));
    const groups: Parameters<ReportCanvas['scoreBars']>[0] = [{ title: `Per site · nilai dan partisipasi (garis = target ${model.targetPct}%)`, max: 100, target: model.targetPct, rows: siteRows }];
    if (aspectsHere) groups.push({ title: 'Aspek layanan · dari yang terlemah', max: 5, rows: aspectRows });
    canvas.section('Gambaran per site dan aspek layanan', 'Nilai rata-rata skala 1-5; partisipasi = responden dibanding basis site.');
    canvas.scoreBars(groups);
}

function participation(canvas: ReportCanvas, model: CsiReportModel) {
    canvas.section('Partisipasi per site', undefined, TABLE_KEEP);
    canvas.note(`Basis = ${model.participation.basisLabel}; % sudah mengisi = jawaban dibanding basis; Tercapai bila mencapai target ${model.targetPct}%.`);
    const body: Cell[][] = model.sites.map((site) => [
        { text: `${site.code ?? ''} ${site.name ?? ''}`.trim(), bold: true }, { text: String(site.basis) }, { text: String(site.target) },
        { text: String(site.responses) }, { text: pct(site.respondenPct) },
        { text: site.reached ? 'Tercapai' : 'Belum', color: site.reached ? INK.green : INK.red, bold: true }, { text: dec(site.average), color: scoreInk(site.average, model.bands) },
    ]);
    const total = model.participation;
    body.push([
        { text: 'Total', bold: true }, { text: String(total.basis), bold: true }, { text: String(total.target), bold: true }, { text: String(total.responses), bold: true },
        { text: pct(total.respondenPct), bold: true },
        { text: total.reached ? 'Tercapai' : 'Belum', color: total.reached ? INK.green : INK.red, bold: true }, { text: dec(model.overall.average), bold: true, color: scoreInk(model.overall.average, model.bands) },
    ]);
    canvas.table([
        { header: 'Site', width: 22 }, { header: 'Basis', width: 9, align: 'right' }, { header: 'Target', width: 9, align: 'right' },
        { header: 'Sudah mengisi', width: 17, align: 'right' }, { header: '% Sudah mengisi', width: 19, align: 'right' },
        { header: 'Status', width: 14 }, { header: 'Nilai', width: 10, align: 'right' },
    ], body);
}

/** Rows = teams/people, columns = question codes; wide grids continue in a second table with the names repeated. */
function questionGrid(canvas: ReportCanvas, grid: CsiQuestionGrid, title: string, bands: CsiScoreBands) {
    if (!grid.rows.length) return;
    canvas.section(title, undefined, TABLE_KEEP);
    canvas.note('Rata-rata nilai (1-5) per pertanyaan (kode di tabel pertama); – = pertanyaan tidak dipasang untuk yang dinilai itu.');
    // Short labels (e.g. the HC dimensions Knowledge … Tangible) are clear enough to be the column headers themselves.
    const named = grid.columns.every((column) => column.label !== column.full && column.label.length <= SHORT_HEADER_MAX);
    const header = (column: CsiQuestionGrid['columns'][number]) => (named ? text(column.label) : column.code);
    canvas.table([{ header: named ? 'Kolom' : 'Kode', width: 18 }, { header: 'Pertanyaan', width: 82 }],
        grid.columns.map((column) => [{ text: header(column), bold: true }, { text: text(column.full) }]));
    for (let start = 0; start < Math.max(1, grid.columns.length); start += GRID_COLUMNS) {
        const slice = grid.columns.slice(start, start + GRID_COLUMNS);
        // The Site column only when some row has a site (ICT people usually have none).
        const withSite = grid.rows.some((row) => !!row.siteCode);
        const columns: Column[] = [{ header: 'Nama', width: withSite ? 30 : 38 }, ...(withSite ? [{ header: 'Site', width: 8 }] : []),
            ...slice.map((column) => ({ header: header(column), width: 62 / GRID_COLUMNS, align: 'right' as const }))];
        canvas.table(columns, grid.rows.map((row) => [
            { text: text(row.name), bold: true }, ...(withSite ? [{ text: row.siteCode ?? DASH }] : []),
            ...row.values.slice(start, start + GRID_COLUMNS).map((value) => ({ text: dec(value), color: scoreInk(value, bands), bold: value !== null })),
        ]));
    }
}

/** ICT appendices: question grids, choices, participation per department (numbers only) and every comment. */
function appendix(canvas: ReportCanvas, model: CsiReportModel) {
    canvas.pageBreak();
    questionGrid(canvas, model.teamGrid, 'Lampiran A1 · Nilai per pertanyaan — Tim', model.bands);
    questionGrid(canvas, model.peopleGrid, 'Lampiran A2 · Nilai per pertanyaan — Orang', model.bands);
    choicesTable(canvas, model, 'Lampiran A3 · Jawaban pilihan');
    departmentsTable(canvas, model, 'Lampiran B · Partisipasi per departemen');
    commentsSection(canvas, 'Lampiran C · Semua saran & komentar', model.comments.map((group) => ({
        heading: `${text(group.name)} · ${kindWord(group.kind)}`, texts: shuffledTexts(group.comments),
    })));
}

/** ICT (and any survey without HC PICs): summary, site/aspects, ranking Tim/Orang, participation, appendices. */
function renderGeneralPdf(canvas: ReportCanvas, model: CsiReportModel) {
    const { counts } = model;
    summary(canvas, model, { value: counts.teams + counts.people, note: `${counts.teams} tim · ${counts.people} orang · ${counts.sites} site` });
    const aspectsHere = model.aspects.length <= ASPECTS_ON_PAGE_ONE;
    siteAndAspects(canvas, model, aspectsHere);
    canvas.pageBreak();
    if (!aspectsHere) {
        canvas.section('Aspek layanan', 'Rata-rata per pertanyaan untuk semua yang dinilai, dari yang terlemah.');
        canvas.scoreBars([{ title: 'Nilai rata-rata (1-5)', max: 5, rows: model.aspects.map((aspect) => ({ label: text(aspect.label), value: aspect.average, color: scoreInk(aspect.average, model.bands), text: dec(aspect.average) })) }]);
    }
    rankingSection(canvas, model, { title: 'Peringkat tim dan orang', detailHeader: 'Site', heading: (group) => `Peringkat ${group.serviceName.toLowerCase()}` });
    participation(canvas, model);
    appendix(canvas, model);
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
            if (model.hcRecap?.services.length) renderHcReportPdf(canvas, { ...model, hcRecap: model.hcRecap });
            else renderGeneralPdf(canvas, model);
            canvas.section('Pengesahan', `Dicetak ${formatLongDate(localDateKey(now, DEFAULT_TIMEZONE))}`);
            canvas.signOff(signoff);
            canvas.finish(model.simulation ? { banner: CSI_SIMULATION_BANNER, footerNote: CSI_SIMULATION_BANNER } : {});
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}
