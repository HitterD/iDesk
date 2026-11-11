import type { CsiPeriod, CsiQuestionStat, CsiReport, CsiReportRatee } from '../../../../types';

export const BANDS = { fairMin: 4, goodMin: 4.5 };

export const question = (name: string, average: number | null, shortLabel: string | null = null): CsiQuestionStat =>
    ({ name, shortLabel, type: 'STAR', average, count: average === null ? 0 : 4, distribution: [] });

export const ratee = (over: Partial<CsiReportRatee> & Pick<CsiReportRatee, 'periodRateeId' | 'displayName'>): CsiReportRatee => ({
    kind: 'PERSON', jobTitle: null, siteId: 's1', photoUrl: null, respondentCount: 4, average: 4.5, indexPct: 90,
    starDistribution: [0, 0, 1, 1, 2], questions: [], comments: [], ...over,
});

export const PERIOD = {
    id: 'p1', scope: 'ICT', title: 'Survei Q4', intro: '', thankYou: '', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: 'LISTED', publishStatus: 'PUBLISHED', teamEnabled: true, teamLabel: 'Tim', individualEnabled: true,
    slaTargetPct: 90, scoreFairMin: 4, scoreGoodMin: 4.5, createdById: 'a1', createdAt: '', updatedAt: '',
    sites: [{ id: 's1', code: 'SPJ', name: 'Sepanjang' }, { id: 's2', code: 'KRW', name: 'Karawang' }],
} as CsiPeriod;

export const report = (over: Partial<CsiReport> = {}): CsiReport => ({
    period: PERIOD,
    scoreBands: BANDS,
    overall: { average: 4.65, respondentCount: 9 },
    previousAverage: 4.53,
    sla: { mode: 'LISTED', basis: 10, targetPct: 90, target: 9, responses: 9, pengisiPct: 100, reporters: [] },
    ratees: [
        ratee({ periodRateeId: 'r1', displayName: 'Dimas', average: 4.4, questions: [
            question('Seberapa cepat petugas merespon laporan Anda?', 4.2, 'Kecepatan respon'), question('Keramahan petugas', 4.6),
        ], comments: [{ text: 'Respon cepat', departmentName: 'Finance', submittedAt: '2026-10-29T03:00:00Z' }] }),
        ratee({ periodRateeId: 'r2', displayName: 'Nur', siteId: 's2', average: 4.9, questions: [
            question('Seberapa cepat petugas merespon laporan Anda?', 4.8, 'Kecepatan respon'), question('Keramahan petugas', 5),
        ] }),
    ],
    ...over,
});
