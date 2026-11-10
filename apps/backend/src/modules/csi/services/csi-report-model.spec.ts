import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRateeKind } from '../csi.constants';
import { buildReportModel, indexPct, questionLabel } from './csi-report-model';
import { reportFixture } from './csi-report-model.fixture';

describe('csi-report-model', () => {
    it('legacy period keeps 4.0/4.5: predikat and colour band of every row', () => {
        const { model } = reportFixture({ people: 4 });
        expect(model.bands).toEqual({ fairMin: 4, goodMin: 4.5 });
        const word = (average: number | null) => (average === null ? null : average >= 4.5 ? 'Sangat puas' : average >= 4 ? 'Puas' : 'Perlu perbaikan');
        model.people.forEach((row) => expect(row.word).toBe(word(row.average)));
        expect(indexPct(4.35)).toBe(87);
    });

    it('custom bands 3.5/4.2 change predikat, colour band and the highlight threshold', () => {
        const { input } = reportFixture({ people: 4 });
        const period = { ...input.report.period, scoreFairMin: 3.5, scoreGoodMin: 4.2 };
        const model = buildReportModel({ ...input, report: { ...input.report, period, overall: { average: 4.3, respondentCount: 2 } } });
        expect(model.bands).toEqual({ fairMin: 3.5, goodMin: 4.2 });
        expect(model.overall).toMatchObject({ word: 'Sangat puas', band: 'good' });
        const row = (average: number) => model.people.find((item) => item.average === average)!;
        // Fixture people averages: 3, 4.6, 4.1, 3.6 (4.1 is "Puas" here, "Puas" with the defaults too; 3.6 would be poor by default).
        expect(row(3.6)).toMatchObject({ word: 'Puas', band: 'fair' });
        expect(row(4.1)).toMatchObject({ word: 'Puas', band: 'fair' });
        expect(row(3)).toMatchObject({ word: 'Perlu perbaikan', band: 'poor' });
        expect(row(4.6)).toMatchObject({ word: 'Sangat puas', band: 'good' });
        expect(model.highlights.join(' ')).toContain('di bawah 3,50 (Perlu perbaikan)');
    });

    it('question label: short label, else the bracketed description, else the text', () => {
        expect(questionLabel({ name: 'Q', shortLabel: 'Cepat' })).toBe('Cepat');
        expect(questionLabel({ name: 'Q', description: '[Kecepatan]' })).toBe('Kecepatan');
        expect(questionLabel({ name: 'Q', description: 'bebas' })).toBe('Q');
    });

    it('teams and people are ranked separately, best first, with the previous-period delta', () => {
        const { model } = reportFixture({ people: 4, sites: 2 });
        expect(model.teams.every((row) => row.kind === CsiRateeKind.TEAM)).toBe(true);
        expect(model.people.every((row) => row.kind === CsiRateeKind.PERSON)).toBe(true);
        expect(model.people.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
        const averages = model.people.map((row) => row.average!);
        expect([...averages].sort((a, b) => b - a)).toEqual(averages);
        const first = model.people.find((row) => row.name === 'Orang 0')!;
        expect(first.previous).toBe(4.9);
        expect(first.delta).toBe(Math.round((first.average! - 4.9) * 100) / 100);
    });

    it('keeps every parameter: all comments, every site, participation per department without names', () => {
        const { model } = reportFixture({ people: 25, responses: 100, sites: 3, comments: 30 });
        expect(model.people).toHaveLength(25);
        expect(model.counts.comments).toBe(3 * 30 + 1);
        expect(model.sites).toHaveLength(3);
        expect(model.sites.reduce((sum, site) => sum + site.basis, 0)).toBe(110);
        // 108 Produksi raters (100 answered) and 2 Keuangan raters merged into the small-department row.
        expect(model.departments).toEqual([
            { name: 'Departemen kecil (gabungan)', submitted: 0, total: 2, pct: 0, met: false },
            { name: 'Produksi', submitted: 100, total: 108, pct: 93, met: true },
        ]);
        expect(model).not.toHaveProperty('basis');
        expect(JSON.stringify(model.departments)).not.toMatch(/Keuangan|Basis \d/);
    });

    it('sla met/missing on the survey total', () => {
        expect(reportFixture({ responses: 2 }).model.sla).toEqual({ basis: 12, submitted: 2, pct: 17, targetPct: 80, targetCount: 10, met: false, missing: 8 });
        expect(reportFixture({ responses: 50 }).model.sla).toMatchObject({ basis: 60, submitted: 50, targetCount: 48, met: true, missing: 0 });
    });

    it('ranking per service: ICT keeps "Tim" and "Orang"; below 5 raters listed as insufficient', () => {
        const { model } = reportFixture({ people: 4, responses: 6, sites: 2 });
        expect(model.rankingByService.map((group) => group.serviceName)).toEqual(['Tim', 'Orang']);
        const [teams, people] = model.rankingByService;
        expect(teams.ranked.map((row) => row.detail)).toEqual(expect.arrayContaining(['S0', 'S1']));
        // Fixture raters per person: 6, 5, 4, 3.
        expect(people.ranked.map((row) => row.raters).sort()).toEqual([5, 6]);
        expect(people.insufficient.map((row) => [row.rank, row.raters])).toEqual([[null, 4], [null, 3]]);
        expect(model.serviceHighlight).toBeNull();
    });

    it('HC: ranking and highlight per layanan; highlight has no person names', () => {
        const { input } = reportFixture({ people: 4, responses: 6 });
        const codes = ['HCD', 'HCS', 'HCD', 'HCC'];
        const ratees = input.report.ratees.map((ratee: any) => (ratee.kind === CsiRateeKind.PERSON
            ? { ...ratee, serviceCode: codes[Number(ratee.periodRateeId.slice(1))], bagian: `Bagian ${ratee.periodRateeId}` } : ratee));
        const model = buildReportModel({
            ...input, scope: ServiceScope.HC, report: { ...input.report, ratees },
            serviceAverages: [{ serviceCode: 'HCD', average: 4.41 }, { serviceCode: 'HCS', average: 4.05 }, { serviceCode: 'HCC', average: 4.2 }],
        });
        expect(model.rankingByService.map((group) => group.serviceCode)).toEqual(['HCD', 'HCC', 'HCS', null]);
        expect(model.rankingByService[0].ranked.map((row) => row.detail)).toEqual(expect.arrayContaining(['Bagian p0']));
        expect(model.serviceHighlight).toMatchObject({ best: { code: 'HCD', average: 4.41 }, worst: { code: 'HCS', average: 4.05 } });
        const sentences = model.highlights.join(' ');
        expect(sentences).toContain('Layanan tertinggi: HCD 4,41 · terendah: HCS 4,05.');
        [...model.people, ...model.teams].forEach((row) => expect(sentences).not.toContain(row.name));
    });

    it('no previous → hasPrevious false', () => {
        const { input } = reportFixture();
        const model = buildReportModel({ ...input, hasPrevious: false, previousBySubject: new Map(), report: { ...input.report, previousAverage: null } });
        expect(model.hasPrevious).toBe(false);
        expect(model.overall.delta).toBeNull();
        expect(model.rankingByService.flatMap((group) => [...group.ranked, ...group.insufficient]).every((row) => row.previous === null && row.delta === null)).toBe(true);
        expect(reportFixture().model.hasPrevious).toBe(true);
    });

    it('question grids are transposed per kind with codes; an unassigned question is null', () => {
        const { model } = reportFixture({ people: 3 });
        expect(model.teamGrid.columns.map((column) => column.code)).toEqual(['T1', 'T2']);
        expect(model.peopleGrid.columns.map((column) => `${column.code}:${column.label}`)).toEqual(['P1:Ramah', 'P2:Tuntas']);
        expect(model.peopleGrid.rows.some((row) => row.values[1] === null)).toBe(true);
        expect(model.choices).toEqual([{ label: 'Kanal', counts: [{ option: 'Email', count: 3 }, { option: 'WA', count: 2 }] }]);
    });

    it('aspects are weakest first and highlights mention the weakest aspect and missed sites', () => {
        const { model } = reportFixture({ people: 3 });
        const values = model.aspects.map((aspect) => aspect.average ?? 99);
        expect([...values].sort((a, b) => a - b)).toEqual(values);
        expect(model.highlights.join(' ')).toMatch(/Aspek terlemah/);
        expect(model.notes).toBe('Tindak lanjut: pelatihan\nReview bulan depan');
    });

    it('an empty survey still builds a model', () => {
        const { input } = reportFixture({ people: 0, responses: 0, sites: 1, comments: 0 });
        const model = buildReportModel({ ...input, report: { ...input.report, overall: { average: null, respondentCount: 0 }, previousAverage: null, ratees: [] }, comments: [] });
        expect(model.highlights).toEqual(['Belum ada jawaban yang bernilai pada survei ini.']);
        expect(model.teams).toEqual([]);
    });
});
