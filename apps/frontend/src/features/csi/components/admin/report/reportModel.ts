import type { CsiQuestionStat, CsiReportRatee } from '../../../types';

const SCORE_MAX = 5;
const PERCENT = 100;

/** A description wholly wrapped in square brackets, e.g. "[Kecepatan respon IT Support]" (the CSI 2025 matrix rows). */
const BRACKETED = /^\[(.+)\]$/s;

/**
 * Report label of a question (spec "Pertanyaan"): the short label; else, when the description is a bracketed
 * aspect (the name being only a generic prefix such as "Tolong ungkapkan tingkat kepuasan ..."), that aspect;
 * else the full text. The single source for every report label (hero, pills, heatmap, detail sheet).
 */
export function questionDisplayLabel(question: { name: string; shortLabel?: string | null; description?: string | null }): string {
    const shortLabel = question.shortLabel?.trim();
    if (shortLabel) return shortLabel;
    const aspect = question.description?.trim().match(BRACKETED)?.[1].trim();
    return aspect || question.name;
}

type QuestionText = Pick<CsiQuestionStat, 'name' | 'description'>;

/** Full question text for tooltips: the name plus its description when there is one. */
export const questionFullText = (question: QuestionText) =>
    [question.name, question.description?.trim()].filter(Boolean).join(' ');

/** Identity of a question across subjects: several CSI 2025 rows share one generic name and differ only by description. */
export const questionKey = (question: QuestionText) => `${question.name}\u0000${question.description?.trim() ?? ''}`;

export interface QuestionColumn {
    /** `questionKey` of the question (shared by every subject asked it). */
    key: string;
    /** Full question text (`questionFullText`), for tooltips. */
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
    const columns = new Map<string, { name: string; label: string; values: number[] }>();
    ratees.forEach((ratee) => ratee.questions.filter(isScored).forEach((question) => {
        const key = questionKey(question);
        const entry = columns.get(key) ?? { name: questionFullText(question), label: questionDisplayLabel(question), values: [] };
        columns.set(key, { ...entry, values: question.average === null ? entry.values : [...entry.values, question.average] });
    }));
    return [...columns].map(([key, { name, label, values }], index) => ({ key, name, label, index, average: mean(values) }));
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
/** Share of the basis, never above 100% (more answers than the basis reads as complete). */
export const ratioPct = (part: number, whole: number) => whole > 0 ? Math.min(PERCENT, Math.round((part / whole) * PERCENT)) : 0;
