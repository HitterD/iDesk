import { CsiTemplateDraft, CsiTemplateSeedPic } from './csi-template-excel';
import { buildNameIndex } from './csi-name-match';
import { ClassifyContext, classifyPics } from './csi-template-identity';

const pic = (picName = 'ERNAWATI', nik: string | null = null): CsiTemplateSeedPic => ({
    picName, nik, area: 'HC SERVICES', serviceCode: 'HCS', jobTitle: 'STAFF', serviceFunction: 'Administrasi',
    raters: [{ name: 'BUDI', nik: null, jobTitle: null }],
});
const draftOf = (...pics: CsiTemplateSeedPic[]): CsiTemplateDraft => ({ format: 'list', pics, teams: [], problems: [] });
const context = (overrides: Partial<ClassifyContext> = {}): ClassifyContext => ({
    findPic: () => null, findPerson: () => null, teamsOfSite: [], resolutions: {}, suggestionPool: [], ...overrides,
});

// These cases detect changes to priority, master-creation flags, and suggestion filtering independently.
describe('classifyPics', () => {
    it('matches PIC master before sheet teams, site teams, and prefixes', () => {
        const draft = { ...draftOf(pic('TIM ADMIN')), teams: [{ name: 'Tim Admin', members: [] }] };
        expect(classifyPics(draft, context({ findPic: () => 'found', teamsOfSite: [{ id: 'team', name: 'Tim Admin' }] })).pics)
            .toEqual([{ ...draft.pics[0], kind: 'pic', existingTeamId: null, newMasterPic: false }]);
    });

    it('matches directory people and marks missing PIC masters for creation', () => {
        expect(classifyPics(draftOf(pic()), context({ findPerson: () => 'found' })).pics[0])
            .toMatchObject({ kind: 'pic', newMasterPic: true });
    });

    it.each(['findPic', 'findPerson'] as const)('keeps %s ambiguity as PIC without creating a master or problem', (lookup) => {
        const draft = draftOf(pic('TEAM ADMIN'));
        expect(classifyPics(draft, context({ [lookup]: () => 'ambiguous' }))).toEqual({
            pics: [{ ...draft.pics[0], kind: 'pic', existingTeamId: null, newMasterPic: false }], unresolved: [],
        });
        expect(draft.problems).toEqual([]);
    });

    it('matches existing site teams using normalized names', () => {
        expect(classifyPics(draftOf(pic('ADMIN HC')), context({ teamsOfSite: [{ id: 'existing', name: ' Admin., HC ' }] })).pics[0])
            .toMatchObject({ kind: 'team', existingTeamId: 'existing', newMasterPic: false });
    });

    it.each(['TIM ADMIN', 'TEAM ADMIN'])('classifies the %s prefix as a new team', (name) => {
        expect(classifyPics(draftOf(pic(name)), context()).pics[0])
            .toMatchObject({ kind: 'team', existingTeamId: null, newMasterPic: false });
    });

    it('does not treat TIM or TEAM without a space as team prefixes', () => {
        expect(classifyPics(draftOf(pic('TIMUR'), pic('TEAMWORK')), context()).pics).toEqual([]);
    });

    it.each([null, 'existing'])('applies team resolution before person lookup (team ID %s)', (id) => {
        const ctx = context({ findPic: () => 'found', resolutions: { ERNAWATI: { as: 'team' } },
            teamsOfSite: id ? [{ id, name: ' Ernawati. ' }] : [] });
        expect(classifyPics(draftOf(pic()), ctx).pics[0])
            .toMatchObject({ kind: 'team', existingTeamId: id, newMasterPic: false });
    });

    it.each([true, false])('applies PIC resolution before a team match (master exists %s)', (exists) => {
        const ctx = context({ findPic: () => exists ? 'found' : null, resolutions: { ERNAWATI: { as: 'pic' } },
            teamsOfSite: [{ id: 'team', name: 'ERNAWATI' }] });
        expect(classifyPics(draftOf(pic()), ctx).pics[0])
            .toMatchObject({ kind: 'pic', existingTeamId: null, newMasterPic: !exists });
    });

    it.each([true, false])('resolution rename maps to existing pic or creates a master (exists %s)', (exists) => {
        const ctx = context({ findPic: (name) => exists && name === 'ERNA WATI' ? 'found' : null,
            resolutions: { ERNAWATI: { as: 'rename', picName: ' Erna., Wati ' } } });
        expect(classifyPics(draftOf(pic()), ctx).pics[0])
            .toEqual({ ...pic('ERNA WATI'), kind: 'pic', existingTeamId: null, newMasterPic: !exists });
    });

    it('PIC resolution never creates a master when the master name is ambiguous', () => {
        const ctx = context({ findPic: () => 'ambiguous', resolutions: { ERNAWATI: { as: 'pic' } } });
        expect(classifyPics(draftOf(pic()), ctx).pics[0])
            .toMatchObject({ picName: 'ERNAWATI', kind: 'pic', newMasterPic: false });
    });

    it('rename resolution never creates a master when the renamed master is ambiguous', () => {
        const ctx = context({ findPic: (name) => name === 'ERNA WATI' ? 'ambiguous' : null,
            resolutions: { ERNAWATI: { as: 'rename', picName: ' Erna., Wati ' } } });
        expect(classifyPics(draftOf(pic()), ctx).pics[0])
            .toMatchObject({ picName: 'ERNA WATI', kind: 'pic', newMasterPic: false });
    });

    it('Tim sheet name forces team and reuses an existing site team if available', () => {
        const draft = { ...draftOf(pic('ADMIN HC')), teams: [{ name: 'Admin., HC', members: [] }] };
        expect(classifyPics(draft, context()).pics[0]).toMatchObject({ kind: 'team', existingTeamId: null });
        expect(classifyPics(draft, context({ teamsOfSite: [{ id: 'existing', name: 'Admin HC' }] })).pics[0])
            .toMatchObject({ kind: 'team', existingTeamId: 'existing' });
    });

    it('NIK hit wins over ambiguous name through the caller lookup', () => {
        const people = [{ name: 'BUDI', nik: '00000012' }, { name: 'BUDI', nik: '00000013' }];
        const byName = buildNameIndex(people, (person) => person.name);
        const findPic: ClassifyContext['findPic'] = (name, nik) => {
            if (nik && people.some((person) => person.nik === nik)) return 'found';
            const match = byName(name);
            return match === 'ambiguous' ? 'ambiguous' : match ? 'found' : null;
        };
        expect(classifyPics(draftOf(pic('BUDI', '12')), context({ findPic }))).toEqual({
            pics: [{ ...pic('BUDI', '12'), kind: 'pic', existingTeamId: null, newMasterPic: false }], unresolved: [],
        });
    });

    it('unresolved lists suggestions ranked by score, then name, filtered and capped at five', () => {
        const suggestionPool = ['XYZ', 'ERNA WATI', ...Array.from({ length: 6 }, (_, index) => `ERNAWATI ${5 - index}`)];
        const result = classifyPics(draftOf(pic(), pic('ZZZZZZ')), context({ suggestionPool }));
        expect(result).toEqual({ pics: [], unresolved: [
            { name: 'ERNAWATI', suggestions: ['ERNAWATI 0', 'ERNAWATI 1', 'ERNAWATI 2', 'ERNAWATI 3', 'ERNAWATI 4'] },
            { name: 'ZZZZZZ', suggestions: [] },
        ] });
        expect(suggestionPool[2]).toBe('ERNAWATI 5');
    });

    it('preserves input draft and resolutions while classifying mixed rows', () => {
        const draft = draftOf(pic(' Erna., Wati '), pic('UNKNOWN'));
        const ctx = context({ resolutions: { 'ERNA WATI': { as: 'pic' } } });
        const before = JSON.stringify({ draft, resolutions: ctx.resolutions });
        const result = classifyPics(draft, ctx);
        expect(result.pics[0]).toEqual({ ...draft.pics[0], picName: 'ERNA WATI', kind: 'pic', existingTeamId: null, newMasterPic: true });
        expect(result.unresolved).toEqual([{ name: 'UNKNOWN', suggestions: [] }]);
        expect(JSON.stringify({ draft, resolutions: ctx.resolutions })).toBe(before);
    });
});
