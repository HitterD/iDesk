import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CSI_ANON_MIN_GROUP, CsiRateeKind } from '../csi.constants';
import { ANSWER_IDENTITY_COLUMNS, answerColumns, answerRows, ExportQuestion, questionsOf } from './csi-export.answers';
import { CellValue } from './csi-export.sheet';
import { formatLocation } from './csi-format.util';
import { bottomOf, cell, contentWidth, Doc, drawTable, MARGIN, MemoSurvey, scaleWidths, TableColumn, unquote } from './csi-memo-draw';
import { formatAverage } from './csi-memo-page';

const ANSWER_FONT = 6.5;
const HEADING_SIZE = 12;
const HEADING_GAP = 8;
const ROW_NUMBER_COLUMN = { header: 'No.', width: 6 };
const HIDDEN_LINE_GAP = 4;
const hiddenLine = (name: string) => `${name}: jawaban disembunyikan (kurang dari ${CSI_ANON_MIN_GROUP} penilai)`;

export const LANDSCAPE = { size: 'A4', layout: 'landscape', margin: MARGIN } as const;

/**
 * Kinds that get an answer table. ICT: one table, the team sheet when a TEAM ratee exists, else per person.
 * HC: PIC (PERSON) answers and custom-team answers live side by side, so each kind present gets its own table.
 */
function answerKinds(survey: MemoSurvey): CsiRateeKind[] {
    const kinds = new Set(survey.report.ratees.map((ratee) => ratee.kind));
    if (survey.report.period.scope === ServiceScope.HC && kinds.size > 0) {
        return [CsiRateeKind.PERSON, CsiRateeKind.TEAM].filter((kind) => kinds.has(kind));
    }
    return [kinds.has(CsiRateeKind.TEAM) ? CsiRateeKind.TEAM : CsiRateeKind.PERSON];
}

/** HC memos never name a rater: answer rows are numbered instead of carrying timestamp, name, area and department. */
const isAnonymous = (survey: MemoSurvey) => survey.report.period.scope === ServiceScope.HC;

type AnonymousRows = { rows: CellValue[][]; hidden: string[] };
const lastNumber = (values: CellValue[]) => {
    const last = values[values.length - 1];
    return typeof last === 'number' ? last : -1;
};

/**
 * HC rows without identity and without any trace of who answered when: per subject (by name), highest average first,
 * ties by the answer content itself, so neither submit order nor one response's rows being adjacent survive. A subject
 * with fewer than CSI_ANON_MIN_GROUP raters gets no rows, only a "hidden" line.
 */
function anonymousRows(survey: MemoSurvey, kind: CsiRateeKind, questions: ExportQuestion[]): AnonymousRows {
    const groups = new Map<string, { name: string; rows: CellValue[][] }>();
    survey.answers.forEach((answer) => answer.ratees.filter((ratee) => ratee.kind === kind).forEach((ratee) => {
        const [values] = answerRows([{ ...answer, ratees: [ratee] }], kind, questions);
        const group = groups.get(ratee.periodRateeId) ?? { name: ratee.displayName, rows: [] };
        groups.set(ratee.periodRateeId, { ...group, rows: [...group.rows, values.slice(ANSWER_IDENTITY_COLUMNS)] });
    }));
    const byName = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
    const content = (values: CellValue[]) => JSON.stringify(values);
    const rows = byName.filter((group) => group.rows.length >= CSI_ANON_MIN_GROUP).flatMap((group) => [...group.rows]
        .sort((a, b) => lastNumber(b) - lastNumber(a) || content(b).localeCompare(content(a))));
    const hidden = byName.filter((group) => group.rows.length < CSI_ANON_MIN_GROUP).map((group) => hiddenLine(group.name));
    return { rows: rows.map((values, index) => [index + 1, ...values]), hidden };
}

function drawHiddenLines(doc: Doc, lines: string[], startY: number): void {
    let y = startY + HIDDEN_LINE_GAP;
    doc.font('Helvetica').fontSize(ANSWER_FONT + 1).fillColor('#000000');
    lines.forEach((line) => {
        const height = doc.heightOfString(line, { width: contentWidth(doc) });
        if (y + height > bottomOf(doc)) {
            doc.addPage(LANDSCAPE);
            y = MARGIN;
        }
        doc.text(cell(line), MARGIN, y, { width: contentWidth(doc) });
        y += height + HIDDEN_LINE_GAP;
    });
}

/** Landscape page(s) with the survey's answer table(s), see answerKinds. */
export function drawAnswerPages(doc: Doc, survey: MemoSurvey): void {
    answerKinds(survey).forEach((kind) => drawAnswerTable(doc, survey, kind));
}

function drawAnswerTable(doc: Doc, survey: MemoSurvey, kind: CsiRateeKind): void {
    const { report, answers } = survey;
    const questions = questionsOf(report.ratees, kind);
    const named = answerColumns(questions, kind === CsiRateeKind.PERSON);
    const anonymous = isAnonymous(survey) ? anonymousRows(survey, kind, questions) : null;
    const specs = anonymous ? [ROW_NUMBER_COLUMN, ...named.slice(ANSWER_IDENTITY_COLUMNS)] : named;
    const raw = anonymous ? anonymous.rows : answerRows(answers, kind, questions);
    const lastIndex = specs.length - 1;
    const numeric = specs.map((_, i) => raw.length > 0 && raw.every((values) => values[i] === null || typeof values[i] === 'number'));
    const rows = raw
        .map((values) => values.map((value, i) => i === lastIndex && typeof value === 'number' ? formatAverage(value) : unquote(cell(value))));

    doc.addPage(LANDSCAPE);
    const widths = scaleWidths(specs.map((spec) => spec.width), contentWidth(doc));
    // Numeric columns (scores, points, average) are centred so the figures line up under their header.
    const columns: TableColumn[] = specs.map((spec, i) => ({ header: cell(spec.header), width: widths[i], align: numeric[i] ? 'center' : 'left' }));
    doc.font('Helvetica-Bold').fontSize(HEADING_SIZE).fillColor('#000000')
        .text(`${cell(formatLocation(report.period.sites))} — ${cell(report.period.title)}`, MARGIN, MARGIN, { width: contentWidth(doc) });
    const end = drawTable(doc, columns, rows, doc.y + HEADING_GAP, ANSWER_FONT, () => {
        doc.addPage(LANDSCAPE);
        return MARGIN;
    });
    if (anonymous?.hidden.length) drawHiddenLines(doc, anonymous.hidden, end);
}
