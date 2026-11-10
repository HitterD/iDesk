import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { buildHcRecap, CsiHcPic, CsiHcRating, recapAverages } from '../org/csi-hc-report.calc';
import { CsiOrgLocation } from '../org/csi-org.constants';
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
    const basis = responses + 10;
    // Basis raters: Produksi holds everyone except two (Keuangan, merged as a small department).
    const raters = Array.from({ length: basis }, (_, i) => ({ department: i < 2 ? 'Keuangan' : 'Produksi', answered: i >= basis - responses }));
    const input: CsiReportModelInput = {
        report,
        matrix: { subjects: [], rows: [{ responseId: 'a', respondentName: 'Rahasia Penilai', departmentName: 'Produksi', areaName: null, submittedAt: new Date(), scores: [], average: null }], totals: [] } as any,
        scopeLabel: 'ICT',
        scope: ServiceScope.ICT,
        previousBySubject: new Map([['PERSON:orang 0:', 4.9]]),
        hasPrevious: true,
        siteBasis: siteRows.map((site, i) => ({ siteId: site.id, basis: Array.from({ length: basis }).filter((_, r) => r % sites === i).length, responses: Math.floor(responses / sites), average: 4.2 })),
        raters,
        serviceAverages: [],
        comments: ratees.flatMap((ratee) => ratee.comments.map((comment) => ({ periodRateeId: ratee.periodRateeId, text: comment.text, department: comment.departmentName, date: comment.submittedAt }))),
        notes: 'Tindak lanjut: pelatihan\nReview bulan depan',
    };
    return { input, model: buildReportModel(input) };
}

const HC_DIMENSIONS = [
    ['Knowledge', 'Pengetahuan/pemahaman PIC terkait jasa atau pelayanan'], ['Responsiveness', 'Kecepatan respon terhadap permintaan atau keluhan pelayanan'],
    ['Courtesy', 'Kesopanan / keramahan dalam melayani dan menerima keluhan'], ['Communication', 'Kemampuan menyampaikan informasi secara tepat'],
    ['Tangible', 'Terpenuhinya kebutuhan pelayanan'],
] as const;
const HC_PICS: CsiHcPic[] = [
    ['HCC', 'PAYROLL & BENEFIT', 'Anita Payroll'], ['HCC', 'PAYROLL & BENEFIT', 'Bambang Benefit'], ['HCC', 'HRIS', 'Citra Sistem'],
    ['HCD', 'TALENT ACQUISITION & ASSESSMENT', 'Dewi Rekrutmen'], ['HCD', 'TRAINING & DEVELOPMENT', 'Eko Pelatihan'], ['HCD', 'TRAINING & DEVELOPMENT', 'Fajar Mentor'],
    ['HCS', 'GA MANAGEMENT', 'Gita Umum'], ['HCS', 'GA MANAGEMENT', 'Hadi Kendaraan'], ['HCS', 'SECURITY', 'Indra Jaga'],
].map(([serviceCode, bagian, name], i) => ({ periodRateeId: `h${i}`, picId: `pic${i}`, name, jobTitle: 'Staff', serviceCode, bagian, serviceFunction: i === 0 ? 'Benefit, Payroll & HRIS' : null }));
const HC_UNITS = [
    ['OPERATION', 'PRODUKSI', 'LINE 1'], ['OPERATION', 'PRODUKSI', 'LINE 2'], ['OPERATION', 'GUDANG', 'GUDANG'],
    ['MARKETING', 'SALES', 'SALES AREA'], ['FINANCE', 'AKUNTANSI', 'AKUNTANSI'],
];
const HC_LOCATIONS = [CsiOrgLocation.SJA1, CsiOrgLocation.SJA2, CsiOrgLocation.SJA4, CsiOrgLocation.JKT];

/** Ratings of `respondents` HC respondents (each rates 3 PICs; the SECURITY PIC gets only 2 raters). */
function hcRatings(respondents: number): CsiHcRating[] {
    return Array.from({ length: respondents }, (_, r) => {
        const [division, department, bagian] = HC_UNITS[r % HC_UNITS.length];
        const respondent = { name: `Penilai Rahasia ${r}`, division, department, bagian };
        const pics = [r % 8, (r + 3) % 8, (r + 5) % 8].concat(r < 2 ? [8] : []);
        return [...new Set(pics)].map((p) => ({
            responseId: `resp${r}`, periodRateeId: `h${p}`, location: HC_LOCATIONS[r % 7 === 6 ? 3 : r % 3], respondent,
            scores: Object.fromEntries(HC_DIMENSIONS.map(([label], d) => [label, 3 + ((r + p * 2 + d) % 3)])),
        }));
    }).flat();
}

const avg = (values: number[]) => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null);

/** Report ratee of one HC PIC, aggregated from its ratings (as getReport would). */
function hcRatee(pic: CsiHcPic, ratings: CsiHcRating[], comments: number) {
    const own = ratings.filter((rating) => rating.periodRateeId === pic.periodRateeId);
    const average = avg(own.map((rating) => avg(Object.values(rating.scores))!));
    return {
        periodRateeId: pic.periodRateeId, kind: CsiRateeKind.PERSON, displayName: pic.name, siteId: null, respondentCount: own.length,
        average, indexPct: average === null ? null : Math.round(average * 200) / 10, starDistribution: [0, 0, 1, 2, 3],
        serviceCode: pic.serviceCode, bagian: pic.bagian, serviceFunction: pic.serviceFunction, picId: pic.picId ?? null,
        questions: HC_DIMENSIONS.map(([label, description]) => ({
            name: `${label} — ${description}`, shortLabel: label, description: null, type: 'STAR', count: own.length, distribution: [],
            average: avg(own.map((rating) => rating.scores[label])),
        })),
        comments: Array.from({ length: comments }, (_, c) => ({ text: `Saran untuk ${pic.serviceCode} nomor ${c}`, departmentName: 'PRODUKSI', submittedAt: new Date(2026, 10, 1 + c) })),
    };
}

/** HC executive model with the per-PIC recap (9 PICs over HCC/HCD/HCS, `respondents` respondents, 2 sites). */
export function hcReportFixture({ respondents = 30, previous = false, title = 'CSI HC November' } = {}) {
    const { input } = reportFixture({ people: 0, responses: respondents, sites: 2, comments: 0 });
    const ratings = hcRatings(respondents);
    const ratees = HC_PICS.map((pic, i) => hcRatee(pic, ratings, i % 3 === 0 ? 2 : 0));
    const recap = buildHcRecap({ pics: HC_PICS, ratings, dimensions: HC_DIMENSIONS.map(([label]) => label) });
    const sla = { ...input.report.sla, target: Math.ceil(input.report.sla.basis * 0.9) };
    const report: any = { ...input.report, period: { ...input.report.period, title, slaTargetPct: 90 }, sla, previousAverage: previous ? 4.1 : null, ratees };
    const hcInput: CsiReportModelInput = {
        ...input, report, scope: ServiceScope.HC, scopeLabel: 'HC', hasPrevious: previous,
        // Anita by master PIC (her name changed since), Bambang by name.
        previousBySubject: previous ? new Map([['PIC:pic0', 3.9], ['PERSON:bambang benefit:', 4.2]]) : new Map(),
        serviceAverages: recap.services.filter((row) => row.level === 'service').map((row) => ({ serviceCode: row.serviceCode, average: row.all.average })),
        comments: ratees.flatMap((ratee) => ratee.comments.map((comment) => ({ periodRateeId: ratee.periodRateeId, text: comment.text, department: comment.departmentName, date: comment.submittedAt }))),
    };
    const hcRecap = previous ? { ...recap, previous: { ...recapAverages(recap), 's:HCC': 4.0, 'pic:pic0': 3.9 } } : recap;
    return { input: hcInput, model: { ...buildReportModel(hcInput), hcRecap }, ratings };
}
