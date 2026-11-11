import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { UserRole } from '../../users/enums/user-role.enum';
import { CsiSubjectService } from './csi-subject.service';

const ICT = ServiceScope.ICT;
const SPJ = { id: 'site-spj', code: 'SPJ', name: 'Sepanjang', isActive: true };
const KRW = { id: 'site-krw', code: 'KRW', name: 'Karawang', isActive: true };
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const T1 = '33333333-3333-4333-8333-333333333333';

function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
    return Object.entries(where).every(([key, value]): boolean => {
        if (value && typeof value === 'object' && '_type' in value) {
            if (value._type === 'in') return value._value.includes(row[key]);
            throw new Error(`Unsupported operator ${value._type}`);
        }
        return row[key] === value;
    });
}

function memoryRepository<T extends Record<string, any>>(rows: T[] = []) {
    let sequence = 0;
    return {
        rows,
        find: jest.fn(async (options: any = {}) => {
            const where = options.where;
            return Array.isArray(where) ? rows.filter((row) => where.some((w) => matches(row, w))) : rows.filter((row) => matches(row, where));
        }),
        findOne: jest.fn(async (options: any = {}) => rows.find((row) => matches(row, options.where)) ?? null),
        save: jest.fn(async (value: any) => {
            const row = { ...value, id: value.id ?? `gen-${++sequence}` };
            const index = rows.findIndex((existing) => existing.id === row.id);
            if (index >= 0) rows[index] = { ...rows[index], ...row } as T; else rows.push(row);
            return row;
        }),
    };
}

const agent = (id: string, siteId: string | null, over: Record<string, unknown> = {}) => ({
    id, fullName: `Agent ${id.slice(0, 2)}`, siteId, role: UserRole.AGENT_OPERATIONAL_SUPPORT, isActive: true,
    jobTitle: 'Teknisi', avatarUrl: null, ...over,
});

describe('CsiSubjectService', () => {
    let users: ReturnType<typeof memoryRepository>;
    let sites: ReturnType<typeof memoryRepository>;
    let teams: ReturnType<typeof memoryRepository>;
    let profiles: ReturnType<typeof memoryRepository>;
    let pics: ReturnType<typeof memoryRepository>;
    let templates: ReturnType<typeof memoryRepository>;
    let templatePics: ReturnType<typeof memoryRepository>;
    let members: ReturnType<typeof memoryRepository>;
    let service: CsiSubjectService;
    let unlink: jest.SpyInstance;

    beforeEach(() => {
        users = memoryRepository<any>([
            agent(U1, SPJ.id, { avatarUrl: '/uploads/avatars/u1.jpg' }),
            agent(U2, KRW.id),
            agent('44444444-4444-4444-8444-444444444444', SPJ.id, { role: UserRole.USER }),
        ]);
        sites = memoryRepository<any>([KRW, SPJ]);
        teams = memoryRepository<any>([{ id: T1, scope: ICT, siteId: SPJ.id, kind: 'SITE', name: 'Tim Sepanjang', photoUrl: null, tagline: null, jobTitle: null, isActive: true }]);
        profiles = memoryRepository<any>([]);
        pics = memoryRepository<any>([]);
        templates = memoryRepository<any>([]);
        templatePics = memoryRepository<any>([]);
        members = memoryRepository<any>([]);
        service = new CsiSubjectService(users as any, sites as any, teams as any, profiles as any,
            pics as any, templates as any, templatePics as any, members as any);
        unlink = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
    });

    afterEach(() => unlink.mockRestore());

    it('groups people by user site and attaches the site team', async () => {
        const groups = await service.list(ICT);
        expect(groups.map((group) => group.siteCode)).toEqual(['KRW', 'SPJ']);
        const spj = groups.find((group) => group.siteId === SPJ.id)!;
        expect(spj).toMatchObject({ siteName: 'Sepanjang', team: { key: `team:${T1}`, kind: 'TEAM', teamId: T1, name: 'Tim Sepanjang' } });
        expect(spj.people.map((view) => view.key)).toEqual([`user:${U1}`]);
        const krw = groups.find((group) => group.siteId === KRW.id)!;
        expect(krw.team).toBeNull();
        expect(krw.people.map((view) => view.userId)).toEqual([U2]);
    });

    it('ICT list unchanged: staff people, one site team, no custom teams', async () => {
        teams.rows.push({ id: 'custom', scope: ICT, siteId: SPJ.id, kind: 'CUSTOM', serviceCode: null, name: 'Custom', isActive: true });
        const spj = (await service.list(ICT)).find((group) => group.siteId === SPJ.id)!;
        expect(spj.teams).toEqual([]);
        expect(spj.team).toMatchObject({ teamKind: 'SITE', serviceCode: null, picId: null, hasAccount: false });
        expect(spj.people).toEqual([expect.objectContaining({ key: `user:${U1}`, teamKind: null, picId: null, serviceCode: null, hasAccount: true })]);
        expect(pics.find).not.toHaveBeenCalled();
    });

    it('falls back to user avatar when profile has no photo', async () => {
        profiles.rows.push({ id: 'pf1', scope: ICT, userId: U1, photoUrl: null, tagline: 'Siap bantu', jobTitle: null });
        const [view] = (await service.list(ICT)).find((group) => group.siteId === SPJ.id)!.people;
        expect(view).toMatchObject({ photoUrl: '/uploads/avatars/u1.jpg', tagline: 'Siap bantu', jobTitle: 'Teknisi' });
    });

    it('stores the service function of a person and shows it; teams have none', async () => {
        const view = await service.update(ICT, `user:${U1}`, { serviceFunction: '  Network & Infrastruktur  ' });
        expect(view.serviceFunction).toBe('Network & Infrastruktur');
        expect((await service.list(ICT)).find((group) => group.siteId === SPJ.id)!.people[0].serviceFunction).toBe('Network & Infrastruktur');
        expect((await service.update(ICT, `user:${U1}`, { serviceFunction: '' })).serviceFunction).toBeNull();
        await expect(service.update(ICT, `user:${U1}`, { serviceFunction: 'x'.repeat(151) })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects tagline longer than 90 characters', async () => {
        await expect(service.update(ICT, `user:${U1}`, { tagline: 'x'.repeat(91) })).rejects.toBeInstanceOf(BadRequestException);
        const view = await service.update(ICT, `user:${U1}`, { tagline: 'x'.repeat(90) });
        expect(view.tagline).toHaveLength(90);
    });

    it('updates a team name and rejects an unknown or malformed key', async () => {
        await expect(service.update(ICT, `team:${T1}`, { name: 'Tim SPJ' })).resolves.toMatchObject({ name: 'Tim SPJ' });
        await expect(service.update(ICT, `team:${U1}`, { tagline: 'a' })).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.update(ICT, 'nope', { tagline: 'a' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ignores custom teams when listing or creating the single site team', async () => {
        teams.rows.unshift({ id: 'custom', scope: ICT, siteId: KRW.id, kind: 'CUSTOM', name: 'Custom' });
        expect((await service.list(ICT)).find((group) => group.siteId === KRW.id)!.team).toBeNull();
        const created = await service.createTeam(ICT, KRW.id);
        expect(created.teamId).not.toBe('custom');
        expect(teams.rows.find((row) => row.id === created.teamId)).toMatchObject({ kind: 'SITE' });
        expect((await service.createTeam(ICT, KRW.id)).teamId).toBe(created.teamId);
    });

    it('site team stays unique per site', async () => {
        teams.rows.push({ id: 'c1', scope: ICT, siteId: SPJ.id, kind: 'CUSTOM', name: 'Tim Rekrutmen', isActive: true });
        expect((await service.createTeam(ICT, SPJ.id)).teamId).toBe(T1);
        expect(teams.rows.filter((row) => row.siteId === SPJ.id && row.kind === 'SITE')).toHaveLength(1);
    });

    it('creates a site team once with the default name', async () => {
        const created = await service.createTeam(ICT, KRW.id);
        expect(created).toMatchObject({ kind: 'TEAM', name: 'Tim Karawang', siteId: KRW.id });
        const again = await service.createTeam(ICT, KRW.id);
        expect(again.teamId).toBe(created.teamId);
        expect(teams.rows.filter((row) => row.siteId === KRW.id)).toHaveLength(1);
    });

    it('replacing a photo unlinks the previous /uploads/csi file', async () => {
        profiles.rows.push({ id: 'pf1', scope: ICT, userId: U1, photoUrl: '/uploads/csi/old.jpg', tagline: null, jobTitle: null });
        const view = await service.setPhoto(ICT, `user:${U1}`, '/uploads/csi/new.jpg');
        expect(view.photoUrl).toBe('/uploads/csi/new.jpg');
        expect(unlink).toHaveBeenCalledWith('./uploads/csi/old.jpg');
    });

    it('viewFor resolves period override, then master, then the user avatar', async () => {
        const ratee = (over: Record<string, unknown>) => ({
            id: 'r', periodId: 'p1', kind: 'PERSON', userId: U1, siteId: null, teamId: null, photoUrl: null, tagline: null,
            displayName: 'X', jobTitle: 'Snapshot', sortOrder: 0, ...over,
        }) as any;
        expect(await service.viewFor(ICT, ratee({}))).toEqual({
            siteId: SPJ.id, siteCode: 'SPJ', photoUrl: '/uploads/avatars/u1.jpg', tagline: null, jobTitle: 'Snapshot',
        });
        profiles.rows.push({ id: 'pf1', scope: ICT, userId: U1, photoUrl: '/uploads/csi/u1.jpg', tagline: 'Master', jobTitle: 'Lead' });
        expect(await service.viewFor(ICT, ratee({ tagline: 'Periode' }))).toMatchObject({ photoUrl: '/uploads/csi/u1.jpg', tagline: 'Periode', jobTitle: 'Lead' });
        teams.rows[0] = { ...teams.rows[0], photoUrl: '/uploads/csi/team.jpg', tagline: 'Tim master' };
        expect(await service.viewFor(ICT, ratee({ kind: 'TEAM', userId: null, teamId: T1, siteId: KRW.id, photoUrl: '/uploads/csi/p.jpg' })))
            .toEqual({ siteId: KRW.id, siteCode: 'KRW', photoUrl: '/uploads/csi/p.jpg', tagline: 'Tim master', jobTitle: 'Snapshot' });
    });

    it('does not unlink an avatar outside /uploads/csi', async () => {
        const view = await service.setPhoto(ICT, `user:${U1}`, '/uploads/csi/new.jpg');
        expect(view.photoUrl).toBe('/uploads/csi/new.jpg');
        expect(unlink).not.toHaveBeenCalled();
    });

    describe('HC members (picked by hand)', () => {
        const HC = ServiceScope.HC;
        const HCU = '55555555-5555-4555-8555-555555555555';

        beforeEach(() => {
            users.rows.push({ id: HCU, fullName: 'Hana HC', siteId: SPJ.id, role: UserRole.USER, isActive: true, jobTitle: 'HC Officer', avatarUrl: null });
        });

        it('HC starts empty and lists only added members, any role', async () => {
            expect((await service.list(HC)).flatMap((group) => group.people)).toEqual([]);
            const groups = await service.addMembers(HC, [HCU]);
            expect(groups.find((group) => group.siteId === SPJ.id)!.people.map((view) => [view.userId, view.name])).toEqual([[HCU, 'Hana HC']]);
            expect(profiles.rows).toEqual([expect.objectContaining({ scope: HC, userId: HCU, isMember: true })]);
        });

        it('adding twice keeps one profile; removing keeps photo/tagline for later', async () => {
            await service.addMembers(HC, [HCU]);
            await service.update(HC, `user:${HCU}`, { tagline: 'Siap bantu' });
            await service.addMembers(HC, [HCU]);
            expect(profiles.rows).toHaveLength(1);
            const groups = await service.removeMember(HC, HCU);
            expect(groups.flatMap((group) => group.people)).toEqual([]);
            expect(profiles.rows[0]).toMatchObject({ isMember: false, tagline: 'Siap bantu' });
        });

        it('rejects unknown users and removing a non-member', async () => {
            await expect(service.addMembers(HC, ['66666666-6666-4666-8666-666666666666'])).rejects.toBeInstanceOf(BadRequestException);
            await expect(service.removeMember(HC, HCU)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('HC administrators run the survey but are never listed as HC subjects', async () => {
            users.rows.push({ id: '77777777-7777-4777-8777-777777777777', fullName: 'Admin HC', siteId: SPJ.id, role: UserRole.HC_ADMIN, isActive: true, jobTitle: null, avatarUrl: null });
            expect((await service.list(HC)).flatMap((group) => group.people)).toEqual([]);
        });

        it('ICT agents are not HC subjects unless added', async () => {
            await expect(service.update(HC, `user:${U1}`, { tagline: 'x' })).rejects.toBeInstanceOf(NotFoundException);
        });

        describe('template PICs and custom teams', () => {
            const P1 = '88888888-8888-4888-8888-888888888881';
            const P2 = '88888888-8888-4888-8888-888888888882';
            const P3 = '88888888-8888-4888-8888-888888888883';
            const pic = (id: string, over: Record<string, unknown>) => ({
                id, scope: HC, nik: id.slice(-4), fullName: 'X', jobTitle: null, serviceCode: 'HCD', serviceFunction: null,
                siteId: null, userId: null, photoUrl: null, tagline: null, isActive: true, ...over,
            });

            beforeEach(() => {
                templates.rows.push({ id: 'tpl-spj', scope: HC, locationCode: 'SPJ' }, { id: 'tpl-krw', scope: HC, locationCode: 'KRW' });
                pics.rows.push(
                    pic(P1, { fullName: 'Zaki', serviceCode: 'HCC', userId: HCU, tagline: 'Siap' }),
                    pic(P2, { fullName: 'Budi', serviceCode: 'HCS', serviceFunction: 'Seragam', photoUrl: '/uploads/csi/budi.jpg' }),
                    pic(P3, { fullName: 'Ani', serviceCode: 'HCC' }),
                );
                templatePics.rows.push(
                    { id: 'r1', templateId: 'tpl-spj', picId: P1, teamId: null },
                    { id: 'r2', templateId: 'tpl-spj', picId: P2, teamId: null },
                    { id: 'r3', templateId: 'tpl-krw', picId: P3, teamId: null },
                    { id: 'r4', templateId: 'tpl-spj', picId: null, teamId: 'c1' },
                );
                users.rows.find((row) => row.id === HCU)!.avatarUrl = '/uploads/avatars/hana.jpg';
            });

            it('HC list groups template PICs by site', async () => {
                const groups = await service.list(HC);
                const spj = groups.find((group) => group.siteId === SPJ.id)!;
                expect(spj.people.map((view) => view.key)).toEqual([`pic:${P1}`, `pic:${P2}`]);
                expect(spj.people[0]).toMatchObject({ kind: 'PERSON', picId: P1, name: 'Zaki', userId: HCU, serviceCode: 'HCC',
                    photoUrl: '/uploads/avatars/hana.jpg', tagline: 'Siap', hasAccount: true, teamKind: null });
                expect(groups.find((group) => group.siteId === KRW.id)!.people.map((view) => view.picId)).toEqual([P3]);
            });

            it('PIC without account listed with hasAccount false', async () => {
                const spj = (await service.list(HC)).find((group) => group.siteId === SPJ.id)!;
                expect(spj.people[1]).toMatchObject({ picId: P2, userId: null, hasAccount: false, photoUrl: '/uploads/csi/budi.jpg', serviceFunction: 'Seragam' });
            });

            it('legacy hand-picked members stay listed unless a PIC already represents the account', async () => {
                const other = '99999999-9999-4999-8999-999999999999';
                users.rows.push({ id: other, fullName: 'Lama', siteId: SPJ.id, role: UserRole.USER, isActive: true, jobTitle: null, avatarUrl: null });
                profiles.rows.push({ id: 'pf-h', scope: HC, userId: HCU, isMember: true }, { id: 'pf-o', scope: HC, userId: other, isMember: true });
                const spj = (await service.list(HC)).find((group) => group.siteId === SPJ.id)!;
                expect(spj.people.map((view) => view.key)).toEqual([`pic:${P1}`, `pic:${P2}`, `user:${other}`]);
            });

            it('lists active custom teams with members next to the site team', async () => {
                teams.rows.push({ id: 'c1', scope: HC, siteId: SPJ.id, kind: 'CUSTOM', serviceCode: 'HCD', name: 'Tim Rekrutmen', isActive: true });
                members.rows.push({ id: 'm2', teamId: 'c1', userId: null, name: 'Budi', sortOrder: 1 }, { id: 'm1', teamId: 'c1', userId: HCU, name: 'Hana HC', sortOrder: 0 });
                const spj = (await service.list(HC)).find((group) => group.siteId === SPJ.id)!;
                expect(spj.team).toBeNull();
                expect(spj.teams).toEqual([expect.objectContaining({ key: 'team:c1', teamKind: 'CUSTOM', serviceCode: 'HCD', hasAccount: false,
                    members: [{ id: 'm1', name: 'Hana HC', userId: HCU }, { id: 'm2', name: 'Budi', userId: null }] })]);
            });

            it('PIC with account falls back to the legacy subject profile photo/tagline before the avatar', async () => {
                profiles.rows.push({ id: 'pf-h', scope: HC, userId: HCU, isMember: true, photoUrl: '/uploads/csi/hana-lama.jpg', tagline: 'Tagline lama' });
                pics.rows.find((row) => row.id === P1)!.tagline = null;
                const spj = (await service.list(HC)).find((group) => group.siteId === SPJ.id)!;
                expect(spj.people[0]).toMatchObject({ picId: P1, photoUrl: '/uploads/csi/hana-lama.jpg', tagline: 'Tagline lama' });
                const ratee = { id: 'r', periodId: 'p1', kind: 'PERSON', userId: HCU, picId: P1, siteId: SPJ.id, teamId: null,
                    photoUrl: null, tagline: null, displayName: 'Zaki', jobTitle: null, sortOrder: 0 } as any;
                expect(await service.viewFor(HC, ratee)).toMatchObject({ photoUrl: '/uploads/csi/hana-lama.jpg', tagline: 'Tagline lama' });
                // The PIC's own values still win over the legacy profile.
                pics.rows.find((row) => row.id === P1)!.photoUrl = '/uploads/csi/zaki.jpg';
                pics.rows.find((row) => row.id === P1)!.tagline = 'Siap';
                expect(await service.viewFor(HC, ratee)).toMatchObject({ photoUrl: '/uploads/csi/zaki.jpg', tagline: 'Siap' });
                const view = await service.update(HC, `pic:${P1}`, { jobTitle: 'HC Officer' });
                expect(view).toMatchObject({ photoUrl: '/uploads/csi/zaki.jpg', tagline: 'Siap' });
            });

            it('pic key tagline saved on csi_pics', async () => {
                const view = await service.update(HC, `pic:${P2}`, { tagline: 'Rapi selalu' });
                expect(view).toMatchObject({ key: `pic:${P2}`, tagline: 'Rapi selalu' });
                expect(pics.rows.find((row) => row.id === P2)!.tagline).toBe('Rapi selalu');
                expect(profiles.rows).toEqual([]);
                await expect(service.update(HC, `pic:${P2}`, { name: 'Lain' })).rejects.toBeInstanceOf(BadRequestException);
                await expect(service.update(ICT, `pic:${P2}`, { tagline: 'x' })).rejects.toBeInstanceOf(NotFoundException);
            });

            it('pic photo replaces the previous CSI upload on csi_pics', async () => {
                const view = await service.setPhoto(HC, `pic:${P2}`, '/uploads/csi/new.jpg');
                expect(view.photoUrl).toBe('/uploads/csi/new.jpg');
                expect(pics.rows.find((row) => row.id === P2)!.photoUrl).toBe('/uploads/csi/new.jpg');
                expect(unlink).toHaveBeenCalledWith('./uploads/csi/budi.jpg');
            });

            it('pic photo used for ratee view', async () => {
                const ratee = (over: Record<string, unknown>) => ({
                    id: 'r', periodId: 'p1', kind: 'PERSON', userId: null, picId: P2, siteId: null, teamId: null, photoUrl: null, tagline: null,
                    displayName: 'Budi', jobTitle: 'Snapshot', sortOrder: 0, ...over,
                }) as any;
                pics.rows.find((row) => row.id === P2)!.tagline = 'Master PIC';
                expect(await service.viewFor(HC, ratee({ siteId: SPJ.id }))).toEqual({
                    siteId: SPJ.id, siteCode: 'SPJ', photoUrl: '/uploads/csi/budi.jpg', tagline: 'Master PIC', jobTitle: 'Snapshot',
                });
                expect(await service.viewFor(HC, ratee({ picId: P1, userId: HCU, tagline: 'Periode' })))
                    .toMatchObject({ photoUrl: '/uploads/avatars/hana.jpg', tagline: 'Periode' });
            });
        });
    });
});
