import { CsiQuestionType, CsiRateeKind } from '../csi.constants';
import { CsiAnswer, CsiAnswerRatee, CsiAnswerScore } from './csi-report.service';
import { wibDate, XlValue } from './csi-excel-style';
import { AVERAGE_COLUMN, CellValue, ColumnSpec, sanitizeCell, WIDTH } from './csi-export.sheet';
import { formatTimestampWib } from './csi-format.util';
import { responseAverage } from './csi-score.util';

export type ExportQuestion = { name: string; type: CsiQuestionType };
type ReportRatee = { kind: CsiRateeKind; questions: ExportQuestion[] };

const isScored = (type: CsiQuestionType) => type === CsiQuestionType.STAR || type === CsiQuestionType.SCALE;

/** Questions of the given ratee kind in snapshot order, de-duplicated by name (people may share the same set). */
export function questionsOf(ratees: ReportRatee[], kind: CsiRateeKind): ExportQuestion[] {
    const seen = new Map<string, ExportQuestion>();
    ratees.filter((ratee) => ratee.kind === kind).forEach((ratee) => ratee.questions.forEach((question) => {
        if (!seen.has(question.name)) seen.set(question.name, { name: question.name, type: question.type });
    }));
    return [...seen.values()];
}

/** Leading respondent identity columns of answerColumns / answerRows (Timestamp, Nama, Area Kerja, Departemen). */
export const ANSWER_IDENTITY_COLUMNS = 4;

/** Columns: Timestamp, Nama, Area Kerja, Departemen, [Dinilai], then answer (+ "Point n" for scored) per question, Average. */
export function answerColumns(questions: ExportQuestion[], withRatee: boolean): ColumnSpec[] {
    let point = 0;
    const perQuestion = questions.flatMap((question): ColumnSpec[] => {
        const answer = { header: sanitizeCell(question.name), width: WIDTH.question };
        return isScored(question.type) ? [answer, { header: `Point ${++point}`, width: WIDTH.point, kind: 'count' }] : [answer];
    });
    return [
        { header: 'Timestamp', width: WIDTH.timestamp, kind: 'date' }, { header: 'Nama', width: WIDTH.name },
        { header: 'Area Kerja', width: WIDTH.area }, { header: 'Departemen', width: WIDTH.department },
        ...(withRatee ? [{ header: 'Dinilai', width: WIDTH.name }] : []),
        ...perQuestion, AVERAGE_COLUMN('Average'),
    ];
}

function answerCells(question: ExportQuestion, score: CsiAnswerScore | undefined): CellValue[] {
    const text = score?.answerText ?? score?.answerLabel ?? null;
    const shown: CellValue = text !== null ? sanitizeCell(text) : (score?.score ?? null);
    return isScored(question.type) ? [shown, score?.score ?? null] : [shown];
}

type Stamp = (date: Date) => XlValue;

function answerRow(answer: CsiAnswer, ratee: CsiAnswerRatee, questions: ExportQuestion[], withRatee: boolean, stamp: Stamp): XlValue[] {
    const byName = new Map(ratee.scores.map((score) => [score.dimension, score]));
    return [
        stamp(answer.submittedAt), sanitizeCell(answer.respondentName), sanitizeCell((answer.areaName ?? '').toUpperCase()),
        sanitizeCell(answer.departmentName),
        ...(withRatee ? [sanitizeCell(ratee.displayName)] : []),
        ...questions.flatMap((question) => answerCells(question, byName.get(question.name))),
        responseAverage(ratee.scores.map((score) => score.score)),
    ];
}

const rowsOf = (answers: CsiAnswer[], kind: CsiRateeKind, questions: ExportQuestion[], stamp: Stamp) =>
    answers.flatMap((answer) => answer.ratees.filter((ratee) => ratee.kind === kind)
        .map((ratee) => answerRow(answer, ratee, questions, kind === CsiRateeKind.PERSON, stamp)));

/** One row per (response, ratee) of the given kind; the timestamp as WIB text (memo PDF tables). */
export function answerRows(answers: CsiAnswer[], kind: CsiRateeKind, questions: ExportQuestion[]): CellValue[][] {
    return rowsOf(answers, kind, questions, formatTimestampWib) as CellValue[][];
}

/** answerRows for the raw-data workbook: the timestamp is a real Date (Jakarta time). */
export function answerSheetRows(answers: CsiAnswer[], kind: CsiRateeKind, questions: ExportQuestion[]): XlValue[][] {
    return rowsOf(answers, kind, questions, wibDate);
}
