import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CSI_SIMULATION_BANNER, CsiRateeKind } from '../csi.constants';
import {
    addHcNestedSheet, addHcQuestionSheet, addHcRespondentSheet, addHcServiceSheet, HC_SHEETS, HcSheetContext,
} from '../org/csi-hc-report.render';
import { CsiHcRecap, ratedHcServices } from '../org/csi-hc-report.calc';
import { serviceName } from '../org/csi-org.constants';
import { HC_OVERALL_NOTE } from '../org/csi-hc-report.pdf';
import {
    addTable, fraction, kvRows, paragraphRow, sectionRow, sheetLink, startReportSheet, XlColumn, XlKv, XlTab, XlValue,
} from './csi-excel-style';
import { sanitizeCell } from './csi-export.sheet';
import { cleanText } from './csi-format.util';
import { CsiQuestionGrid, CsiReportModel } from './csi-report-model';
import { commentOrder, INSUFFICIENT_LABEL, NO_ANSWERS_LABEL, slaStatusText, templateRatersNote } from './csi-report-pdf-sections';
import { compareServiceCodes, CsiRankRow, CsiServiceRanking, rankRowsOf } from './csi-report-ranking';
import { CsiScoreBand, CsiScoreWord } from './csi-score-bands';

/** Sheets of the main (anonymous) report, before numbering; HC-only sheets are left out for ICT. */
export const EXECUTIVE_SHEETS = {
    summary: 'Ringkasan', services: HC_SHEETS.services, nested: HC_SHEETS.recap, ranking: 'Peringkat', participation: 'Partisipasi & SLA',
    respondents: HC_SHEETS.respondents, questions: HC_SHEETS.questions, comments: 'Komentar',
} as const;

const SUMMARY_WIDTH = { label: 34, value: 20, note: 72 } as const;
const SUMMARY_SPAN = 3;
const TEMPLATE_RATERS_LABEL = 'Penilai template tanpa akun';
const OTHER_SERVICE = 'Lainnya';
const MET = 'Tercapai';
const NOT_MET = 'Belum';
const text = (value: string | null | undefined) => sanitizeCell(value ?? '');
const isHc = (model: CsiReportModel) => model.scopeLabel === ServiceScope.HC;
/** A bulleted line: the bullet already keeps it from starting a formula, so the text itself is not quoted. */
const bullet = (line: string) => `•  ${cleanText(line)}`;
/** "HCD · HC Development"; a group without a layanan (ICT Tim / Orang, HC Lainnya) keeps its own name. */
const groupLabel = (code: string | null, fallback: string) => (code ? `${code} · ${serviceName(code) ?? fallback}` : fallback);
const metTone = (value: XlValue): CsiScoreBand | null => (value === MET ? 'good' : value === NOT_MET ? 'poor' : null);
const DATE = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
const longDate = (date: string) => DATE.format(new Date(`${date}T12:00:00+07:00`));

type HcModel = CsiReportModel & { hcRecap: CsiHcRecap };
type SheetPlan = { key: keyof typeof EXECUTIVE_SHEETS; tab: XlTab; about: string; name: string };
type Ctx = { model: CsiReportModel; surveyLine: string; simulation: string | null; plan: SheetPlan[] };

/** "SIMULASI – CSI HC 2026 · 1 Oktober 2026 – 16 Oktober 2026 · Semarang, Sepanjang" (title-block subtitle). */
export const surveyLineOf = (model: Pick<CsiReportModel, 'title' | 'startDate' | 'endDate' | 'siteLabel'>) =>
    `${text(model.title)} · ${longDate(model.startDate)} – ${longDate(model.endDate)} · ${text(model.siteLabel)}`;

/** Numbered sheet plan: HC gets the per-layanan sheets, ICT only the shared ones (numbers stay consecutive). */
function planOf(model: CsiReportModel): SheetPlan[] {
    const hc = isHc(model) && !!model.hcRecap;
    const rows: Array<Omit<SheetPlan, 'name'> & { hcOnly?: boolean }> = [
        { key: 'summary', tab: 'summary', about: 'Nilai keseluruhan, partisipasi & SLA, poin utama, catatan' },
        { key: 'services', tab: 'analysis', about: 'Rata-rata per dimensi per layanan dan per lokasi responden', hcOnly: true },
        { key: 'nested', tab: 'analysis', about: 'Layanan → bagian → PIC / tim, per dimensi dan lokasi', hcOnly: true },
        { key: 'ranking', tab: 'analysis', about: 'Peringkat per layanan; belum cukup penilai dan belum ada penilaian' },
        { key: 'participation', tab: 'participation', about: 'Partisipasi per site (dengan total) dan per departemen' },
        { key: 'respondents', tab: 'analysis', about: 'Nilai yang diberikan per divisi / departemen responden', hcOnly: true },
        { key: 'questions', tab: 'analysis', about: hc ? 'Nilai per pertanyaan per layanan' : 'Nilai per pertanyaan per tim / orang' },
        { key: 'comments', tab: 'comments', about: 'Komentar & saran tanpa nama penilai' },
    ];
    return rows.filter((row) => hc || !row.hcOnly)
        .map(({ hcOnly: _hcOnly, ...row }, index) => ({ ...row, name: `${index + 1} ${EXECUTIVE_SHEETS[row.key]}` }));
}

const nameOf = (ctx: Ctx, key: SheetPlan['key']) => ctx.plan.find((row) => row.key === key)!.name;
const start = (workbook: ExcelJS.Workbook, ctx: Ctx, key: SheetPlan['key'], title: string, span: number) => {
    const plan = ctx.plan.find((row) => row.key === key)!;
    return startReportSheet(workbook, { name: plan.name, tab: plan.tab, title, subtitle: ctx.surveyLine, simulation: ctx.simulation, span });
};

function scoreItems(model: CsiReportModel): XlKv[] {
    const { overall, counts } = model;
    const ratedHc = model.hcRecap ? ratedHcServices(model.hcRecap) : null;
    const rated = ratedHc ? ratedHc.filter((row) => row.level === 'pic').length : counts.teams + counts.people;
    const ratedNote = ratedHc ? `PIC / tim di ${ratedHc.filter((row) => row.level === 'service').length} layanan`
        : `${counts.teams} tim · ${counts.people} orang · ${counts.sites} site`;
    return [
        { label: 'Nilai keseluruhan (1-5)', value: overall.average, kind: 'score', band: true, note: isHc(model) ? HC_OVERALL_NOTE : 'Rata-rata semua respons' },
        { label: 'Predikat', value: overall.word ?? '-', tone: overall.band },
        { label: 'Indeks', value: fraction(overall.indexPct), kind: 'percent1', note: 'Nilai keseluruhan ÷ 5' },
        ...(model.hasPrevious ? [
            { label: 'Nilai periode lalu', value: overall.previous, kind: 'score' as const, band: true },
            { label: 'Δ vs periode lalu', value: overall.delta, kind: 'delta' as const },
        ] : []),
        { label: 'Yang dinilai', value: rated, kind: 'count', note: ratedNote },
        { label: 'Jumlah komentar', value: counts.comments, kind: 'count' },
    ];
}

/** The SLA block of the PDF (one percentage: answers ÷ basis) with real numbers and percent cells. */
function slaItems(model: CsiReportModel): XlKv[] {
    const { sla, participation } = model;
    const note = templateRatersNote(model);
    return [
        { label: 'Sudah mengisi', value: sla.submitted, kind: 'count', note: `dari basis ${sla.basis} (${participation.basisLabel})` },
        { label: 'Basis partisipasi', value: sla.basis, kind: 'count' },
        { label: 'SLA % sudah mengisi', value: fraction(sla.pct), kind: 'percent', note: 'Sudah mengisi ÷ basis' },
        { label: 'Target SLA (%)', value: fraction(sla.targetPct), kind: 'percent' },
        { label: 'Target SLA (orang)', value: sla.targetCount, kind: 'count' },
        sla.basis > 0 ? { label: 'Status SLA', value: slaStatusText(sla), tone: sla.met ? 'good' : 'poor' } : { label: 'Status SLA', value: 'Belum ada basis partisipasi' },
        ...(note ? [{ label: TEMPLATE_RATERS_LABEL, value: model.templateRatersWithoutAccount, kind: 'count' as const, note }] : []),
    ];
}

function identityItems(model: CsiReportModel): XlKv[] {
    return [
        { label: 'Survei', value: text(model.title) }, { label: 'Lingkup', value: model.scopeLabel },
        { label: 'Periode', value: `${longDate(model.startDate)} – ${longDate(model.endDate)}` }, { label: 'Site', value: text(model.siteLabel) },
        { label: 'Mode responden', value: model.modeLabel }, { label: 'No. dokumen', value: model.docNo },
    ];
}

/** The question without its leading "<label> — " (the label is already in column A). */
const questionText = (aspect: { label: string; full: string }) => {
    const prefix = `${aspect.label} — `;
    return aspect.full.startsWith(prefix) ? aspect.full.slice(prefix.length) : aspect.full;
};

/** Highlight sentences, the best / weakest layanan (HC) and the weakest aspects. */
function insightRows(sheet: ExcelJS.Worksheet, row: number, model: CsiReportModel): number {
    let next = sectionRow(sheet, row, 'Poin utama', SUMMARY_SPAN);
    const width = SUMMARY_WIDTH.label + SUMMARY_WIDTH.value + SUMMARY_WIDTH.note;
    (model.highlights.length ? model.highlights : ['-']).forEach((line) => { next = paragraphRow(sheet, next, bullet(line), SUMMARY_SPAN, width); });
    const best = model.serviceHighlight;
    if (best) {
        next = kvRows(sheet, next + 1, [
            { label: 'Layanan tertinggi', value: best.best.average, kind: 'score', band: true, note: `${best.best.code} · ${best.best.name}` },
            { label: 'Layanan terendah', value: best.worst.average, kind: 'score', band: true, note: `${best.worst.code} · ${best.worst.name}` },
        ], model.bands);
    }
    if (model.aspects.length) {
        next = sectionRow(sheet, next + 1, 'Aspek layanan (terlemah dulu)', SUMMARY_SPAN);
        next = kvRows(sheet, next, model.aspects.map((aspect) => ({
            label: text(aspect.label), value: aspect.average, kind: 'score' as const, band: true, note: `${aspect.answers} jawaban · ${text(questionText(aspect))}`,
        })), model.bands);
    }
    return next;
}

function tocRows(sheet: ExcelJS.Worksheet, row: number, ctx: Ctx): number {
    const next = sectionRow(sheet, row, 'Daftar isi', SUMMARY_SPAN);
    return kvRows(sheet, next, ctx.plan.filter((plan) => plan.key !== 'summary').map((plan) => ({
        label: plan.name, value: sheetLink(plan.name, 'Buka sheet →'), note: plan.about,
    })));
}

/** "1 Ringkasan": title, survey identity, scores, SLA, insights, notes and the linked table of contents. */
function summarySheet(workbook: ExcelJS.Workbook, ctx: Ctx) {
    const { model } = ctx;
    const { sheet, row } = start(workbook, ctx, 'summary', `Laporan Kepuasan Layanan ${model.scopeLabel}`, SUMMARY_SPAN);
    [SUMMARY_WIDTH.label, SUMMARY_WIDTH.value, SUMMARY_WIDTH.note].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    let next = kvRows(sheet, sectionRow(sheet, row, 'Hasil', SUMMARY_SPAN), scoreItems(model), model.bands);
    next = kvRows(sheet, sectionRow(sheet, next + 1, 'Partisipasi & SLA', SUMMARY_SPAN), slaItems(model), model.bands);
    next = insightRows(sheet, next + 1, model);
    next = sectionRow(sheet, next + 1, 'Catatan & tindak lanjut', SUMMARY_SPAN);
    const notes = model.notes ? model.notes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : ['-'];
    const width = SUMMARY_WIDTH.label + SUMMARY_WIDTH.value + SUMMARY_WIDTH.note;
    notes.forEach((line) => { next = paragraphRow(sheet, next, bullet(line), SUMMARY_SPAN, width); });
    next = kvRows(sheet, sectionRow(sheet, next + 1, 'Identitas survei', SUMMARY_SPAN), identityItems(model));
    tocRows(sheet, next + 1, ctx);
    sheet.pageSetup.orientation = 'portrait';
}

/** Keterangan of an unranked row: no score yet, or a score from fewer than CSI_RANK_MIN_RATERS raters. */
const rankNote = (group: CsiServiceRanking, row: CsiRankRow) =>
    (row.rank !== null ? null : group.noAnswers.includes(row) ? NO_ANSWERS_LABEL : INSUFFICIENT_LABEL);

/** Ranking: one filterable table, one block per layanan (HC) or Tim / Orang (ICT); unranked rows muted with a note. */
function rankingSheet(workbook: ExcelJS.Workbook, ctx: Ctx) {
    const { model } = ctx;
    const hc = isHc(model);
    const columns: XlColumn[] = [
        { header: hc ? 'Layanan' : 'Kelompok' }, { header: '#', kind: 'count' }, { header: 'Nama' }, { header: hc ? 'Bagian' : 'Site' },
        { header: 'Penilai', kind: 'count' }, { header: 'Nilai', kind: 'score', band: true },
        { header: 'Predikat', tone: wordTone },
        ...(model.hasPrevious ? [{ header: 'Lalu', kind: 'score' as const }, { header: 'Δ', kind: 'delta' as const }] : []),
        { header: 'Keterangan' },
    ];
    const entries = model.rankingByService.flatMap((group) => rankRowsOf(group).map((row, index) => ({ group, row, first: index === 0 })));
    const { sheet, row } = start(workbook, ctx, 'ranking', hc ? 'Peringkat per layanan' : 'Peringkat tim & orang', columns.length);
    const header = sectionRow(sheet, row, `Nilai seri = peringkat sama; kurang dari 5 penilai tidak diberi peringkat`, columns.length);
    addTable(sheet, columns, entries.map(({ group, row: rank }) => [
        text(groupLabel(group.serviceCode, group.serviceName)), rank.rank, text(rank.name), text(rank.detail), rank.raters, rank.average, rank.word,
        ...(model.hasPrevious ? [rank.previous, rank.delta] : []), rankNote(group, rank),
    ]), {
        bands: model.bands, headerRow: header, freeze: { columns: 1 }, emptyText: 'Belum ada yang dinilai.',
        rowStyle: (index) => ({ muted: entries[index].row.rank === null, topRule: index > 0 && entries[index].first }),
    });
}

/** A predikat cell takes the fill of its own band (the word is derived from the same survey bands). */
const WORD_BAND: Record<CsiScoreWord, CsiScoreBand> = { 'Sangat puas': 'good', Puas: 'fair', 'Perlu perbaikan': 'poor' };
const wordTone = (value: XlValue): CsiScoreBand | null => (typeof value === 'string' ? WORD_BAND[value as CsiScoreWord] ?? null : null);

/** Participation per site (totals row outside the filter) and per department (anonymous, small ones merged). */
function participationSheet(workbook: ExcelJS.Workbook, ctx: Ctx) {
    const { model } = ctx;
    const total = model.participation;
    const status: XlColumn = { header: 'Status', tone: metTone };
    const siteColumns: XlColumn[] = [
        { header: 'Site' }, { header: 'Basis', kind: 'count' }, { header: 'Target', kind: 'count' }, { header: 'Sudah mengisi', kind: 'count' },
        { header: '% Sudah mengisi', kind: 'percent' }, status, { header: 'Nilai', kind: 'score', band: true },
    ];
    const { sheet, row } = start(workbook, ctx, 'participation', 'Partisipasi & SLA', siteColumns.length);
    const sites = addTable(sheet, siteColumns, model.sites.map((site) => [
        text(`${site.code ?? ''} ${site.name ?? ''}`.trim()), site.basis, site.target, site.responses, fraction(site.respondenPct), site.reached ? MET : NOT_MET, site.average,
    ]), {
        bands: model.bands, headerRow: sectionRow(sheet, row, 'Per site', siteColumns.length), filter: false, emptyText: 'Belum ada site.',
        totals: [['Total', total.basis, total.target, total.responses, fraction(total.respondenPct), total.reached ? MET : NOT_MET, model.overall.average]],
    });
    const header = sectionRow(sheet, sites.end + 2, `Per departemen penilai (tanpa nama; di bawah 3 orang digabung; target ${model.targetPct}% sebagai informasi)`, siteColumns.length);
    addTable(sheet, [{ header: 'Departemen' }, { header: 'Sudah', kind: 'count' }, { header: 'Total', kind: 'count' }, { header: '%', kind: 'percent' }, { header: 'Target', tone: metTone }],
        model.departments.map((department) => [text(department.name), department.submitted, department.total, fraction(department.pct), department.met ? MET : NOT_MET]),
        { headerRow: header, emptyText: 'Tidak ada basis partisipasi.' });
}

/** ICT question grid: rows = subjects, one column per question (empty = question not assigned). */
function gridTable(sheet: ExcelJS.Worksheet, row: number, title: string, grid: CsiQuestionGrid, ctx: Ctx): number {
    if (!grid.rows.length) return row;
    const columns: XlColumn[] = [{ header: 'Nama' }, { header: 'Site' }, ...grid.columns.map((column): XlColumn => ({
        header: text(`${column.code} · ${column.label}`), kind: 'score', band: true, width: 16,
    }))];
    const header = sectionRow(sheet, row, title, Math.min(columns.length, 8));
    return addTable(sheet, columns, grid.rows.map((cells) => [text(cells.name), cells.siteCode, ...cells.values]),
        { bands: ctx.model.bands, headerRow: header, filter: false }).end + 2;
}

function choiceTable(sheet: ExcelJS.Worksheet, row: number, model: CsiReportModel) {
    if (!model.choices.length) return;
    const header = sectionRow(sheet, row, 'Jawaban pilihan (jumlah responden per jawaban)', 3);
    addTable(sheet, [{ header: 'Pertanyaan' }, { header: 'Jawaban' }, { header: 'Jumlah', kind: 'count' }],
        model.choices.flatMap((choice) => choice.counts.map((option, index) => [index ? '' : text(choice.label), text(option.option), option.count])),
        { headerRow: header, filter: false });
}

function questionSheet(workbook: ExcelJS.Workbook, ctx: Ctx) {
    const { model } = ctx;
    if (isHc(model) && model.hcRecap) {
        const fullOf = new Map(model.peopleGrid.columns.map((column) => [column.label, column.full]));
        const sheet = addHcQuestionSheet(workbook, nameOf(ctx, 'questions'), hcContext(ctx, model as HcModel), fullOf);
        choiceTable(sheet, sheet.rowCount + 2, model);
        return;
    }
    const { sheet, row } = start(workbook, ctx, 'questions', 'Nilai per pertanyaan', 8);
    let next = gridTable(sheet, row, 'Tim', model.teamGrid, ctx);
    next = gridTable(sheet, next, 'Orang', model.peopleGrid, ctx);
    choiceTable(sheet, next, model);
}

/** Anonymous comments like the PDF: per layanan (HCD, HCC, HCS), inside a layanan in the PDF's stable shuffled order. */
function commentsSheet(workbook: ExcelJS.Workbook, ctx: Ctx) {
    const { model } = ctx;
    const rows = model.comments.flatMap((group, index) => group.comments.map((comment) => ({ group, index, text: comment.text })))
        .sort((a, b) => compareServiceCodes(a.group.serviceCode, b.group.serviceCode)
            || (a.group.serviceCode ? 0 : a.index - b.index) || commentOrder(a.text, b.text));
    const columns: XlColumn[] = [{ header: 'Layanan' }, { header: 'Dinilai' }, { header: 'Jenis' }, { header: 'Komentar', kind: 'longText' }];
    const { sheet, row } = start(workbook, ctx, 'comments', 'Komentar & saran', columns.length);
    addTable(sheet, columns, rows.map(({ group, text: comment }): XlValue[] => [
        text(groupLabel(group.serviceCode, isHc(model) ? OTHER_SERVICE : '')), text(group.name),
        group.kind === CsiRateeKind.TEAM ? 'Tim' : 'Orang', text(comment),
    ]), { headerRow: sectionRow(sheet, row, 'Tanpa nama, tanggal atau departemen penilai', columns.length), freeze: true, emptyText: 'Belum ada komentar.' });
}

const hcContext = (ctx: Ctx, model: HcModel): HcSheetContext => ({
    recap: model.hcRecap, bands: model.bands, hasPrevious: model.hasPrevious, surveyLine: ctx.surveyLine, simulation: ctx.simulation,
});

/** The main report workbook (anonymous: no rater name or e-mail anywhere), sheets numbered per planOf. */
export function addExecutiveSheets(workbook: ExcelJS.Workbook, model: CsiReportModel) {
    const ctx: Ctx = { model, surveyLine: surveyLineOf(model), simulation: model.simulation ? CSI_SIMULATION_BANNER : null, plan: planOf(model) };
    const hc = isHc(model) && model.hcRecap ? hcContext(ctx, model as HcModel) : null;
    summarySheet(workbook, ctx);
    if (hc) addHcServiceSheet(workbook, nameOf(ctx, 'services'), hc);
    if (hc) addHcNestedSheet(workbook, nameOf(ctx, 'nested'), hc);
    rankingSheet(workbook, ctx);
    participationSheet(workbook, ctx);
    if (hc) addHcRespondentSheet(workbook, nameOf(ctx, 'respondents'), hc);
    questionSheet(workbook, ctx);
    commentsSheet(workbook, ctx);
}
