import type { CsiQuestionStat, CsiReportRatee } from '../../../types';

const SCORE_MAX = 5;
const PERCENT = 100;

/** Report label of a question (spec "Pertanyaan"): the short label, else the full text. */
export const questionLabel = (question: Pick<CsiQuestionStat, 'name' | 'shortLabel'>) => question.shortLabel || question.name;

export interface QuestionColumn {
    /** Full question text (shared by every subject asked it). */
    name: string;
    label: string;
    /** Stable position for `questionTone` (first appearance order). */
    index: number;
    /** Mean of the subjects' averages for this question; null when nobody scored it. */
    average: number | null;
}

const mean = (values: number[]) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
const isScored = (question: CsiQuestionStat) => question.type === 'STAR' || question.type === 'SCALE';

/** Scored questions across subjects, in first-appearance order; CHOICE/TEXT (never averaged) are left out. */
export function questionColumns(ratees: readonly CsiReportRatee[]): QuestionColumn[] {
    const columns = new Map<string, { label: string; values: number[] }>();
    ratees.forEach((ratee) => ratee.questions.filter(isScored).forEach((question) => {
        const entry = columns.get(question.name) ?? { label: questionLabel(question), values: [] };
        columns.set(question.name, { ...entry, values: question.average === null ? entry.values : [...entry.values, question.average] });
    }));
    return [...columns].map(([name, { label, values }], index) => ({ name, label, index, average: mean(values) }));
}

/** Highest and lowest question by cross-subject average; `weakest` is null when fewer than two were scored. */
export function strongestAndWeakest(columns: readonly QuestionColumn[]) {
    const scored = columns.filter((column) => column.average !== null)
        .sort((a, b) => (b.average as number) - (a.average as number));
    return { strongest: scored[0] ?? null, weakest: scored.length > 1 ? scored[scored.length - 1] : null };
}

/** Subjects by average, highest first; subjects without a score go last. */
export const byAverageDesc = (ratees: readonly CsiReportRatee[]) =>
    [...ratees].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

export const scorePct = (average: number | null) => average === null ? 0 : (average / SCORE_MAX) * PERCENT;
export const ratioPct = (part: number, whole: number) => whole > 0 ? Math.round((part / whole) * PERCENT) : 0;
