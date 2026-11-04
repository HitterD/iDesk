import { CsiQuestionType, CsiRateeKind } from '../csi.constants';
import { raterMatrix } from './csi-rater-matrix.calc';

const score = (value: number | null) => ({ dimension: 'Q', type: CsiQuestionType.STAR, score: value, answerLabel: null, answerText: null });
const ratee = (periodRateeId: string, values: Array<number | null>) => ({
    periodRateeId, kind: CsiRateeKind.PERSON, displayName: periodRateeId, jobTitle: null, comment: null, scores: values.map(score),
});
const answer = (responseId: string, ratees: ReturnType<typeof ratee>[]) => ({
    responseId, respondentName: `Nama ${responseId}`, accountName: 'akun', areaName: 'Sepanjang', departmentName: 'Produksi',
    submittedAt: new Date('2026-11-01T03:00:00Z'), ratees,
});
const subjects = [
    { periodRateeId: 'team', kind: CsiRateeKind.TEAM, displayName: 'ICT Sepanjang', siteId: 's1' },
    { periodRateeId: 'budi', kind: CsiRateeKind.PERSON, displayName: 'Budi', siteId: 's1' },
];

describe('raterMatrix', () => {
    it('gives each respondent row the average per subject, null where the subject was not rated', () => {
        const matrix = raterMatrix(subjects, [
            answer('a', [ratee('team', [5, 4]), ratee('budi', [3])]),
            answer('b', [ratee('team', [2])]),
        ]);
        expect(matrix.rows.map((row) => [row.respondentName, row.scores, row.average])).toEqual([
            ['Nama a', [4.5, 3], 3.75],
            ['Nama b', [2, null], 2],
        ]);
        expect(matrix.totals).toEqual([{ raters: 2, average: 3.25 }, { raters: 1, average: 3 }]);
    });

    it('a subject with only unscored answers counts the rater but has no average', () => {
        const matrix = raterMatrix(subjects, [answer('a', [ratee('budi', [null])])]);
        expect(matrix.rows[0].scores).toEqual([null, null]);
        expect(matrix.totals[1]).toEqual({ raters: 1, average: null });
    });
});
