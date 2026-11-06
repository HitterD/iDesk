import { CsiRateeKind } from '../csi.constants';
import { answerColumns, answerRows, questionsOf } from './csi-export.answers';
import { formatLocation } from './csi-format.util';
import { cell, contentWidth, Doc, drawTable, MARGIN, MemoSurvey, scaleWidths, TableColumn, unquote } from './csi-memo-draw';
import { formatAverage } from './csi-memo-page';

const ANSWER_FONT = 6.5;
const HEADING_SIZE = 12;
const HEADING_GAP = 8;

export const LANDSCAPE = { size: 'A4', layout: 'landscape', margin: MARGIN } as const;

/** Landscape page(s) with the survey's answer table (team sheet when a TEAM ratee exists, else per person). */
export function drawAnswerPages(doc: Doc, survey: MemoSurvey): void {
    const { report, answers } = survey;
    const kind = report.ratees.some((ratee) => ratee.kind === CsiRateeKind.TEAM) ? CsiRateeKind.TEAM : CsiRateeKind.PERSON;
    const questions = questionsOf(report.ratees, kind);
    const specs = answerColumns(questions, kind === CsiRateeKind.PERSON);
    const lastIndex = specs.length - 1;
    const raw = answerRows(answers, kind, questions);
    const numeric = specs.map((_, i) => raw.length > 0 && raw.every((values) => values[i] === null || typeof values[i] === 'number'));
    const rows = raw
        .map((values) => values.map((value, i) => i === lastIndex && typeof value === 'number' ? formatAverage(value) : unquote(cell(value))));

    doc.addPage(LANDSCAPE);
    const widths = scaleWidths(specs.map((spec) => spec.width), contentWidth(doc));
    // Numeric columns (scores, points, average) are centred so the figures line up under their header.
    const columns: TableColumn[] = specs.map((spec, i) => ({ header: cell(spec.header), width: widths[i], align: numeric[i] ? 'center' : 'left' }));
    doc.font('Helvetica-Bold').fontSize(HEADING_SIZE).fillColor('#000000')
        .text(`${cell(formatLocation(report.period.sites))} — ${cell(report.period.title)}`, MARGIN, MARGIN, { width: contentWidth(doc) });
    drawTable(doc, columns, rows, doc.y + HEADING_GAP, ANSWER_FONT, () => {
        doc.addPage(LANDSCAPE);
        return MARGIN;
    });
}
