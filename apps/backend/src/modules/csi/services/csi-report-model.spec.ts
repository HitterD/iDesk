import { CsiRateeKind } from '../csi.constants';
import { buildReportModel, indexPct, questionLabel, scoreWord } from './csi-report-model';
import { reportFixture } from './csi-report-model.fixture';

describe('csi-report-model', () => {
    it('predikat uses the app thresholds (4.5 / 4.0)', () => {
        expect(scoreWord(4.5)).toBe('Sangat puas');
        expect(scoreWord(4.49)).toBe('Puas');
        expect(scoreWord(4)).toBe('Puas');
        expect(scoreWord(3.99)).toBe('Perlu perbaikan');
        expect(scoreWord(null)).toBeNull();
        expect(indexPct(4.35)).toBe(87);
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

    it('keeps every parameter: 0-answer departments, all comments, every basis person (not answered first)', () => {
        const { model } = reportFixture({ people: 25, responses: 100, sites: 3, comments: 30 });
        expect(model.people).toHaveLength(25);
        expect(model.departments.map((row) => row.name)).toEqual(['Produksi', 'Keuangan']);
        expect(model.counts.comments).toBe(3 * 30 + 1);
        expect(model.basis).toHaveLength(110);
        const firstSite = model.basis.filter((person) => person.siteCode === 'S0');
        expect(firstSite[0].answered).toBe(false);
        expect(firstSite[firstSite.length - 1].answered).toBe(true);
        expect(model.sites).toHaveLength(3);
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
