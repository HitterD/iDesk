import { CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { buildReportModel, CsiReportModelInput } from './csi-report-model';

/** Test fixture of the executive report model: `people` persons, one team per site, `responses` answers. */
export function reportFixture({ people = 2, responses = 2, sites = 1, comments = 1 } = {}) {
    const siteRows = Array.from({ length: sites }, (_, i) => ({ id: `s${i}`, code: `S${i}`, name: `Site ${i}` }));
    const question = (name: string, average: number | null, type = 'STAR') => ({ name, shortLabel: null, description: `[${name}]`, type, average, count: responses, distribution: [] as Array<{ label: string; count: number }> });
    const choice = { ...question('Kanal', null, 'CHOICE'), distribution: [{ label: 'Email', count: 3 }, { label: 'WA', count: 2 }] };
    const score = (i: number) => Math.round((3 + ((i * 37) % 21) / 10) * 100) / 100;
    const ratees = [
        ...siteRows.map((site, i) => ({
            periodRateeId: `t${i}`, kind: CsiRateeKind.TEAM, displayName: `ICT ${site.name}`, siteId: site.id, respondentCount: responses,
            average: score(i + 3), indexPct: 88, starDistribution: [0, 1, 2, 3, 4],
            questions: [question('Kecepatan', score(i + 1)), question('Solusi', score(i + 2)), choice],
            comments: Array.from({ length: comments }, (_, c) => ({ text: `Komentar tim ${c}`, departmentName: 'Produksi', submittedAt: new Date(2026, 10, 1 + c) })),
        })),
        ...Array.from({ length: people }, (_, i) => ({
            periodRateeId: `p${i}`, kind: CsiRateeKind.PERSON, displayName: `Orang ${i}`, siteId: null, respondentCount: Math.max(1, responses - i),
            average: score(i), indexPct: 80, starDistribution: [1, 0, 2, 3, 4],
            questions: [question('Ramah', score(i)), question('Tuntas', i % 2 ? null : score(i + 5))],
            comments: i === 0 ? [{ text: 'Mantap sekali', departmentName: 'Gudang', submittedAt: new Date(2026, 10, 2) }] : [],
        })),
    ];
    const report: any = {
        period: { id: '0a1b2c3d-0000-4000-8000-000000000000', title: 'CSI ICT November', teamLabel: 'Tim IT Support', startDate: '2026-11-01', endDate: '2026-11-30', slaTargetPct: 80, sites: siteRows },
        overall: { average: 4.35, respondentCount: responses },
        previousAverage: 4.1,
        sla: { mode: CsiRespondentMode.OPEN, basis: responses + 10, target: Math.ceil((responses + 10) * 0.8), responses, pengisiPct: 90 },
        ratees,
    };
    const reporters = Array.from({ length: responses + 10 }, (_, i) => ({ email: `user${i}@x.id`, department: 'Produksi', fullName: `Basis ${i}`, userId: `u${i}` }));
    const input: CsiReportModelInput = {
        report,
        matrix: { subjects: [], rows: [{ responseId: 'a', respondentName: 'Rahasia Penilai', departmentName: 'Produksi', areaName: null, submittedAt: new Date(), scores: [], average: null }], totals: [] } as any,
        scopeLabel: 'ICT',
        previousBySubject: new Map([['PERSON:orang 0:', 4.9]]),
        siteBasis: siteRows.map((site, i) => ({ siteId: site.id, reporters: reporters.filter((_, r) => r % sites === i), responses: Math.floor(responses / sites), average: 4.2 })),
        answeredUserIds: new Set(reporters.slice(0, responses).map((row) => row.userId)),
        reporterUserIds: new Map(),
        departments: [{ name: 'Produksi', responses }, { name: 'Keuangan', responses: 0 }],
        comments: ratees.flatMap((ratee) => ratee.comments.map((comment) => ({ periodRateeId: ratee.periodRateeId, text: comment.text, department: comment.departmentName, date: comment.submittedAt }))),
        notes: 'Tindak lanjut: pelatihan\nReview bulan depan',
    };
    return { input, model: buildReportModel(input) };
}
