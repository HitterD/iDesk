import { CsiRateeKind } from '../csi.constants';
import { CsiAnswer } from './csi-report.service';
import { averageOfAverages, responseAverage } from './csi-score.util';

/** One column of the matrix: a subject (team or person) in report order. */
export type CsiMatrixSubject = { periodRateeId: string; kind: CsiRateeKind; displayName: string; siteId: string | null };
/** One row: a respondent and the average they gave each subject (null = did not rate it / no scored answer). */
export type CsiMatrixRow = {
    responseId: string; respondentName: string; departmentName: string; areaName: string | null; submittedAt: Date;
    scores: Array<number | null>;
    /** Mean of this respondent's subject averages. */
    average: number | null;
};
export type CsiRaterMatrix = {
    subjects: CsiMatrixSubject[];
    rows: CsiMatrixRow[];
    /** Per subject: how many respondents rated it and the mean of their averages (same order as `subjects`). */
    totals: Array<{ raters: number; average: number | null }>;
};

/**
 * "Siapa menilai siapa": respondents × subjects with the average each respondent gave each subject.
 * Built from the answers already loaded for the export, so it always matches the Excel sheets.
 */
export function raterMatrix(subjects: CsiMatrixSubject[], answers: CsiAnswer[]): CsiRaterMatrix {
    const rows = answers.map((answer): CsiMatrixRow => {
        const byRatee = new Map(answer.ratees.map((ratee) => [ratee.periodRateeId, ratee]));
        const scores = subjects.map((subject) => {
            const rated = byRatee.get(subject.periodRateeId);
            return rated ? responseAverage(rated.scores.map((score) => score.score)) : null;
        });
        return {
            responseId: answer.responseId, respondentName: answer.respondentName, departmentName: answer.departmentName,
            areaName: answer.areaName, submittedAt: answer.submittedAt, scores, average: averageOfAverages(scores),
        };
    });
    const totals = subjects.map((subject, index) => {
        const raters = answers.filter((answer) => answer.ratees.some((ratee) => ratee.periodRateeId === subject.periodRateeId)).length;
        return { raters, average: averageOfAverages(rows.map((row) => row.scores[index])) };
    });
    return { subjects, rows, totals };
}
