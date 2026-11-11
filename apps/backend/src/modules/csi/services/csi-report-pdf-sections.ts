import { Cell, Column, INK, Kpi, ReportCanvas, Tone } from '../../reports/generators/report-pdf-canvas';
import { CSI_RANK_MIN_RATERS, CsiRateeKind } from '../csi.constants';
import { cleanText } from './csi-format.util';
import { CsiCommentGroup, CsiReportModel } from './csi-report-model';
import { CsiRankRow, CsiServiceRanking, rankRowsOf } from './csi-report-ranking';
import { CsiScoreBand, CsiScoreBands, scoreBand } from './csi-score-bands';
import { scoreInk } from './csi-score-ink';

/** Shared pieces of the executive report PDF (HC and ICT): formatting, summary, SLA, ranking, comments, participation. */
export const DASH = '–';
export const text = (value: string | null | undefined) => cleanText(value ?? '').replace(/^'([=+\-@\t\r])/, '$1');
export const dec = (value: number | null | undefined, digits = 2) =>
    value === null || value === undefined || !Number.isFinite(value) ? DASH : value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const pct = (value: number | null | undefined, digits = 0) => (value === null || value === undefined ? DASH : `${dec(value, digits)}%`);
export const signed = (value: number | null | undefined) =>
    (value === null || value === undefined ? DASH : `${value > 0 ? '+' : value < 0 ? '-' : ''}${dec(Math.abs(value))}`);
export const deltaColor = (value: number | null | undefined) =>
    (value === null || value === undefined || value === 0 ? INK.secondary : value > 0 ? INK.green : INK.red);
const BAND_TONE: Record<CsiScoreBand, Tone> = { good: 'good', fair: 'warn', poor: 'bad' };
export const scoreTone = (value: number | null, bands: CsiScoreBands): Tone => {
    const band = scoreBand(value, bands);
    return band ? BAND_TONE[band] : 'neutral';
};
export const kindWord = (kind: CsiRateeKind) => (kind === CsiRateeKind.TEAM ? 'tim' : 'orang');
/** Score cell coloured by the survey bands. */
export const scoreCell = (value: number | null | undefined, bands: CsiScoreBands, bold = false): Cell =>
    ({ text: dec(value), color: scoreInk(value, bands), bold });
/** "Lalu" and "Selisih" columns: only when an earlier period exists. */
export const PREVIOUS_COLUMNS: Column[] = [{ header: 'Lalu', width: 36, align: 'right' }, { header: 'Selisih', width: 44, align: 'right' }];
export const SLA_MET = 'Memenuhi SLA';
/** Room kept below a section title that opens a table: note, table header and the first rows (no orphan title). */
export const TABLE_KEEP = 110;
export const slaStatusText = (sla: CsiReportModel['sla']) => (sla.met ? SLA_MET : `Belum memenuhi SLA — kurang ${sla.missing} jawaban`);

/**
 * Page 1: overall score + predikat (with an optional sentence on how it is averaged), Partisipasi & SLA, highlight
 * sentences (never a name) and the notes.
 */
export function summary(canvas: ReportCanvas, model: CsiReportModel, subjects: { value: number; note: string }, overallNote?: string) {
    const { overall } = model;
    const cards: Kpi[] = [{
        label: 'Nilai keseluruhan', value: `${dec(overall.average)} / 5`, tone: scoreTone(overall.average, model.bands),
        note: overall.word ? `${overall.word} · indeks ${pct(overall.indexPct, 1)}` : 'Belum ada nilai',
    }];
    if (model.hasPrevious) {
        cards.push({
            label: 'Dibanding periode lalu', value: signed(overall.delta), tone: overall.delta === null ? 'neutral' : overall.delta >= 0 ? 'good' : 'bad',
            note: overall.previous === null ? 'Periode lalu tanpa nilai' : `Periode lalu: ${dec(overall.previous)}`,
        });
    }
    cards.push({ label: 'Yang dinilai', value: String(subjects.value), note: subjects.note });
    canvas.kpis(cards);
    if (overallNote) canvas.note(overallNote);
    slaBlock(canvas, model);
    canvas.highlights(model.highlights);
    if (model.notes) canvas.highlights(model.notes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean), 'CATATAN & TINDAK LANJUT', 'amber');
}

/** "Partisipasi & SLA": answers vs basis, the target in people and the official status of the whole survey. */
function slaBlock(canvas: ReportCanvas, model: CsiReportModel) {
    const { sla } = model;
    const lines = [`${sla.submitted}/${sla.basis} sudah mengisi (${sla.pct}%)`, `Target ${sla.targetPct}% = ${sla.targetCount} orang`];
    const sites = model.sites.filter((site) => site.basis > 0);
    if (sites.length > 1) lines.push(`Per site: ${sites.map((site) => `${site.code ?? site.name} ${site.responses}/${site.basis} (${pct(site.respondenPct)})`).join('  ·  ')}`);
    const status = sla.basis > 0 ? { text: slaStatusText(sla), tone: (sla.met ? 'good' : 'bad') as Tone } : { text: 'Belum ada basis partisipasi', tone: 'neutral' as Tone };
    canvas.statusBlock('PARTISIPASI & SLA', lines, status);
}

type RankLayout = { detailHeader: string | null; numbered: boolean; hasPrevious: boolean; detail?: (value: string) => string };

function rankColumns({ detailHeader, numbered, hasPrevious }: RankLayout): Column[] {
    return [
        ...(numbered ? [{ header: '#', width: 26 }] : []), { header: 'Nama', width: 120 }, ...(detailHeader ? [{ header: detailHeader, width: 112 }] : []),
        { header: 'Penilai', width: 46, align: 'right' as const }, { header: 'Nilai', width: 40, align: 'right' as const }, { header: 'Predikat', width: 82 },
        ...(hasPrevious ? PREVIOUS_COLUMNS : []),
    ];
}

function rankCells(row: CsiRankRow, bands: CsiScoreBands, { detailHeader, numbered, hasPrevious, detail = (value) => value }: RankLayout): Cell[] {
    const detailText = text(row.detail);
    return [
        ...(numbered ? [{ text: String(row.rank) }] : []), { text: text(row.name), bold: true }, ...(detailHeader ? [{ text: detailText ? detail(detailText) : DASH }] : []),
        { text: String(row.raters) }, scoreCell(row.average, bands, true), { text: row.word ?? DASH, color: scoreInk(row.average, bands) },
        ...(hasPrevious ? [{ text: dec(row.previous) }, { text: signed(row.delta), color: deltaColor(row.delta) }] : []),
    ];
}

export const INSUFFICIENT_LABEL = `Belum cukup penilai (< ${CSI_RANK_MIN_RATERS})`;
export const NO_ANSWERS_LABEL = 'Belum ada penilaian';

/** An unnumbered list under its own sub-heading (skipped when empty). */
function unrankedTable(canvas: ReportCanvas, rows: CsiRankRow[], title: string, heading: string, layout: Omit<RankLayout, 'numbered'>, bands: CsiScoreBands) {
    if (!rows.length) return;
    canvas.subheading(title);
    canvas.table(rankColumns({ ...layout, numbered: false }), rows.map((row) => rankCells(row, bands, { ...layout, numbered: false })), undefined, `${heading} · ${title}`);
}

/**
 * One ranking group: ranked rows (min CSI_RANK_MIN_RATERS raters, ties share a rank), then the unranked ones with a
 * score, then everyone without a score yet (value "–"); the detail column (bagian / site) is left out when no row has one.
 */
function rankingGroup(canvas: ReportCanvas, group: CsiServiceRanking, heading: string, input: RankingInput, model: CsiReportModel) {
    const { bands, hasPrevious } = model;
    const hasDetail = rankRowsOf(group).some((row) => !!row.detail);
    const layout = { detailHeader: hasDetail ? input.detailHeader : null, hasPrevious, detail: input.detail };
    canvas.subheading(heading);
    canvas.table(rankColumns({ ...layout, numbered: true }), group.ranked.map((row) => rankCells(row, bands, { ...layout, numbered: true })),
        `Belum ada yang dinilai minimal ${CSI_RANK_MIN_RATERS} penilai.`, heading);
    unrankedTable(canvas, group.insufficient, INSUFFICIENT_LABEL, heading, layout, bands);
    unrankedTable(canvas, group.noAnswers, NO_ANSWERS_LABEL, heading, layout, bands);
}

/**
 * "Peringkat per layanan" (HC) / "Peringkat tim dan orang" (ICT): one reading sentence for the whole section, then
 * per group only its heading and table. No general cross-service ranking, no spotlight boxes.
 */
type RankingInput = {
    title: string; detailHeader: string; heading: (group: CsiServiceRanking) => string;
    /** Display form of the detail column (HC: bagian in title case like the recap); as stored when omitted. */
    detail?: (value: string) => string;
};

export function rankingSection(canvas: ReportCanvas, model: CsiReportModel, input: RankingInput) {
    canvas.section(input.title, undefined, TABLE_KEEP);
    canvas.note(`Urut dari nilai tertinggi; nilai sama = peringkat sama; nomor hanya untuk yang dinilai minimal ${CSI_RANK_MIN_RATERS} penilai${model.hasPrevious ? '; Lalu = periode sebelumnya' : ''}.`);
    if (!model.rankingByService.length) canvas.table(rankColumns({ detailHeader: input.detailHeader, numbered: true, hasPrevious: model.hasPrevious }), [], 'Belum ada yang dinilai.');
    model.rankingByService.forEach((group) => rankingGroup(canvas, group, input.heading(group), input, model));
}

/** FNV-1a: a stable pseudo-random comment order (not by date or department, so nobody can be traced). */
function hash(value: string): number {
    let result = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 0x01000193) >>> 0;
    return result;
}
/** Stable pseudo-random order of comment texts, shared by the PDF and the Excel "Komentar" sheet. */
export const commentOrder = (a: string, b: string) => hash(a) - hash(b) || a.localeCompare(b, 'id');
export const shuffledTexts = (comments: CsiCommentGroup['comments']) => comments.map((comment) => comment.text).sort(commentOrder);

/** Anonymous comments: one sentence for the section, per group a sub-heading and a plain list (no date, department, rater). */
export function commentsSection(canvas: ReportCanvas, title: string, groups: Array<{ heading: string; texts: string[] }>) {
    const total = groups.reduce((sum, group) => sum + group.texts.length, 0);
    canvas.section(title, undefined, TABLE_KEEP);
    canvas.note(total ? `${total} komentar tanpa nama, tanggal atau departemen penulis, dalam urutan acak tetap.` : 'Tidak ada komentar.');
    groups.filter((group) => group.texts.length).forEach((group) => {
        canvas.subheading(`${group.heading} (${group.texts.length})`);
        canvas.bulletList(group.texts.map(text));
    });
}

/** Basis raters per department, numbers only; small departments are already merged in the model. */
export function departmentsTable(canvas: ReportCanvas, model: CsiReportModel, title: string) {
    canvas.section(title, undefined, TABLE_KEEP);
    canvas.note(`Penilai per departemen tanpa nama (di bawah 3 orang digabung); Target ${model.targetPct}% hanya sebagai informasi.`);
    canvas.table([
        { header: 'Departemen', width: 52 }, { header: 'Sudah', width: 12, align: 'right' }, { header: 'Total', width: 12, align: 'right' },
        { header: '%', width: 10, align: 'right' }, { header: 'Target', width: 14 },
    ], model.departments.map((row) => [
        { text: text(row.name) }, { text: String(row.submitted) }, { text: String(row.total) }, { text: pct(row.pct) },
        { text: row.met ? 'Tercapai' : 'Belum', bold: true, color: row.met ? INK.green : INK.red },
    ]), 'Tidak ada basis partisipasi.');
}

/** Questions without a score: answers counted per option. */
export function choicesTable(canvas: ReportCanvas, model: CsiReportModel, title: string) {
    if (!model.choices.length) return;
    canvas.section(title, undefined, TABLE_KEEP);
    canvas.note('Pertanyaan tanpa nilai; angka = jumlah responden yang memilih jawaban itu.');
    canvas.table([{ header: 'Pertanyaan', width: 40 }, { header: 'Jawaban', width: 60 }],
        model.choices.map((choice) => [{ text: text(choice.label), bold: true }, { text: choice.counts.map((row) => `${text(row.option)}: ${row.count}`).join('  ·  ') }]));
}
