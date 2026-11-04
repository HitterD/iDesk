import { Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { Cell, INK, Kpi, PAGE, ReportCanvas, Tone } from '../../reports/generators/report-pdf-canvas';
import { SignoffLayout } from '../../reports/generators/report-signoff';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { CsiRateeKind } from '../csi.constants';
import { cleanText, formatLocation } from './csi-format.util';
import { formatAverage, formatLongDate, formatPercent } from './csi-memo-page';
import { CsiRaterMatrix } from './csi-rater-matrix.calc';
import { CsiReportService } from './csi-report.service';

export type CsiReportData = Awaited<ReturnType<CsiReportService['getReport']>>;
export type CsiReportPdfInput = {
    report: CsiReportData;
    matrix: CsiRaterMatrix;
    scopeLabel: string;
    signoff: SignoffLayout;
    now: Date;
};

const SCORE_MAX = 5;
const GOOD_SCORE = 4.2;
const WARN_SCORE = 3.5;
const COMMENTS_MAX = 40;
/** Columns of the coverage table before it is split into several tables (keeps text legible on A4 portrait). */
const SUBJECTS_PER_TABLE = 6;
const logger = new Logger('CsiReportPdf');

const text = (value: string | null | undefined) => cleanText(value ?? '').replace(/^'([=+\-@\t\r])/, '$1');
const scoreTone = (value: number | null): Tone => value === null ? 'neutral' : value >= GOOD_SCORE ? 'good' : value >= WARN_SCORE ? 'warn' : 'bad';
const scoreColor = (value: number | null) => ({ good: INK.green, warn: INK.amber, bad: INK.red, neutral: INK.secondary })[scoreTone(value)];
const kindLabel = (kind: CsiRateeKind) => (kind === CsiRateeKind.TEAM ? 'Tim' : 'Individu');
const nameOf = (report: CsiReportData, ratee: CsiReportData['ratees'][number]) =>
    text(ratee.kind === CsiRateeKind.TEAM ? ratee.displayName || report.period.teamLabel : ratee.displayName);
const questionLabel = (question: { name: string; shortLabel?: string | null; description?: string | null }) =>
    text(question.shortLabel?.trim() || question.description?.trim().match(/^\[([\s\S]+)\]$/)?.[1] || question.name);

function summary(canvas: ReportCanvas, report: CsiReportData, matrix: CsiRaterMatrix) {
    const average = report.overall.average;
    const ranked = [...report.ratees].filter((ratee) => ratee.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
    const kpis: Kpi[] = [
        { label: 'Nilai keseluruhan', value: `${formatAverage(average)} / ${SCORE_MAX}`, note: average === null ? 'Belum ada nilai' : `Indeks ${formatPercent(Math.round((average / SCORE_MAX) * 1000) / 10)}`, tone: scoreTone(average) },
        { label: 'Jawaban masuk', value: String(report.overall.respondentCount), note: `${matrix.subjects.length} subjek dinilai` },
        { label: '% Pengisi (SLA)', value: formatPercent(report.sla.pengisiPct), note: `Target ${report.period.slaTargetPct ?? '-'}%`, tone: report.sla.pengisiPct === null ? 'neutral' : report.sla.pengisiPct >= (report.period.slaTargetPct ?? 0) ? 'good' : 'warn' },
        { label: 'Nilai tertinggi', value: ranked[0] ? formatAverage(ranked[0].average) : '-', note: ranked[0] ? nameOf(report, ranked[0]) : undefined },
    ];
    canvas.kpis(kpis);
    const delta = average !== null && report.previousAverage !== null ? average - report.previousAverage : null;
    const lines = [
        average === null ? 'Belum ada jawaban yang bernilai pada survei ini.' : `Nilai rata-rata survei ${formatAverage(average)} dari ${SCORE_MAX}.`,
        delta === null ? '' : `${delta >= 0 ? 'Naik' : 'Turun'} ${formatAverage(Math.abs(delta))} dibanding periode sebelumnya (${formatAverage(report.previousAverage)}).`,
        ranked.length > 1 ? `Nilai terendah: ${nameOf(report, ranked[ranked.length - 1])} (${formatAverage(ranked[ranked.length - 1].average)}).` : '',
    ].filter(Boolean);
    canvas.highlights(lines);
}

function ranking(canvas: ReportCanvas, report: CsiReportData) {
    canvas.section('Peringkat per subjek', 'Rata-rata dari nilai setiap penilai, skala 1-5.');
    const rows: Cell[][] = [...report.ratees]
        .sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
        .map((ratee, index) => [
            { text: String(index + 1) },
            { text: nameOf(report, ratee), bold: true },
            { text: kindLabel(ratee.kind) },
            { text: String(ratee.respondentCount) },
            { text: formatAverage(ratee.average), bold: true, color: scoreColor(ratee.average) },
            { text: ratee.indexPct === null ? '-' : formatPercent(ratee.indexPct) },
        ]);
    canvas.table([
        { header: '#', width: 4 }, { header: 'Subjek', width: 34 }, { header: 'Jenis', width: 12 },
        { header: 'Penilai', width: 10, align: 'right' }, { header: 'Nilai', width: 10, align: 'right' }, { header: 'Indeks', width: 10, align: 'right' },
    ], rows, 'Belum ada subjek yang dinilai.');
}

function perQuestion(canvas: ReportCanvas, report: CsiReportData) {
    report.ratees.forEach((ratee) => {
        const scored = ratee.questions.filter((question) => question.average !== null);
        if (!scored.length) return;
        canvas.section(`Nilai per pertanyaan - ${nameOf(report, ratee)}`, `${ratee.respondentCount} penilai · rata-rata ${formatAverage(ratee.average)}`);
        canvas.table([{ header: 'Pertanyaan', width: 70 }, { header: 'Jawaban', width: 12, align: 'right' }, { header: 'Nilai', width: 12, align: 'right' }],
            scored.map((question) => [
                { text: questionLabel(question) }, { text: String(question.count) },
                { text: formatAverage(question.average), bold: true, color: scoreColor(question.average) },
            ]));
    });
}

/** Who rated whom, as counts per subject only: names stay out of the PDF (it is shared more widely than the Excel). */
function coverage(canvas: ReportCanvas, matrix: CsiRaterMatrix) {
    if (!matrix.subjects.length) return;
    canvas.section('Cakupan penilaian', 'Jumlah penilai dan nilai rata-rata per subjek. Nama penilai hanya tersedia di Excel untuk admin.');
    for (let start = 0; start < matrix.subjects.length; start += SUBJECTS_PER_TABLE) {
        const slice = matrix.subjects.slice(start, start + SUBJECTS_PER_TABLE);
        canvas.table([{ header: 'Subjek', width: 46 }, { header: 'Jenis', width: 14 }, { header: 'Penilai', width: 14, align: 'right' }, { header: 'Nilai', width: 14, align: 'right' }],
            slice.map((subject, offset) => {
                const total = matrix.totals[start + offset];
                return [{ text: text(subject.displayName), bold: true }, { text: kindLabel(subject.kind) }, { text: String(total.raters) },
                    { text: formatAverage(total.average), color: scoreColor(total.average) }];
            }));
    }
}

function comments(canvas: ReportCanvas, report: CsiReportData) {
    const rows: Cell[][] = report.ratees.flatMap((ratee) => ratee.comments.map((comment) => [
        { text: nameOf(report, ratee), bold: true }, { text: text(comment.text) }, { text: text(comment.departmentName) },
    ])).slice(0, COMMENTS_MAX);
    canvas.section('Saran & komentar', rows.length >= COMMENTS_MAX ? `${COMMENTS_MAX} komentar terbaru; selengkapnya di Excel.` : 'Tanpa nama penilai.');
    canvas.table([{ header: 'Untuk', width: 24 }, { header: 'Komentar', width: 56 }, { header: 'Departemen', width: 20 }], rows, 'Tidak ada komentar.');
}

/** Survey report PDF: summary, ranking, per-question scores, coverage, comments and the sign-off block. */
export function renderCsiReportPdf(input: CsiReportPdfInput): Promise<Buffer> {
    const { report, matrix, scopeLabel, signoff, now } = input;
    return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: PAGE.margin, size: 'A4', bufferPages: true, info: { Title: text(report.period.title), Creator: 'iDesk CSI' } });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        try {
            const canvas = new ReportCanvas(doc, logger);
            canvas.header({
                title: `Laporan ${text(report.period.title)}`,
                period: `${formatLongDate(report.period.startDate)} - ${formatLongDate(report.period.endDate)}`,
                scope: `CSI ${scopeLabel} · ${text(formatLocation(report.period.sites)) || 'Semua site'}`,
                docNo: `CSI-${scopeLabel}-${report.period.id.slice(0, 8).toUpperCase()}`,
            });
            summary(canvas, report, matrix);
            ranking(canvas, report);
            perQuestion(canvas, report);
            coverage(canvas, matrix);
            comments(canvas, report);
            canvas.section('Pengesahan', `Dicetak ${formatLongDate(localDateKey(now, DEFAULT_TIMEZONE))}`);
            canvas.signOff(signoff);
            canvas.finish();
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}
