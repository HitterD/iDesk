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
    let service: CsiSubjectService;
    let unlink: jest.SpyInstance;

    beforeEach(() => {
        users = memoryRepository<any>([
            agent(U1, SPJ.id, { avatarUrl: '/uploads/avatars/u1.jpg' }),
            agent(U2, KRW.id),
            agent('44444444-4444-4444-8444-444444444444', SPJ.id, { role: UserRole.USER }),
        ]);
        sites = memoryRepository<any>([KRW, SPJ]);
        teams = memoryRepository<any>([{ id: T1, scope: ICT, siteId: SPJ.id, name: 'Tim Sepanjang', photoUrl: null, tagline: null, jobTitle: null, isActive: true }]);
        profiles = memoryRepository<any>([]);
        service = new CsiSubjectService(users as any, sites as any, teams as any, profiles as any);
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

    it('falls back to user avatar when profile has no photo', async () => {
        profiles.rows.push({ id: 'pf1', scope: ICT, userId: U1, photoUrl: null, tagline: 'Siap bantu', jobTitle: null });
        const [view] = (await service.list(ICT)).find((group) => group.siteId === SPJ.id)!.people;
        expect(view).toMatchObject({ photoUrl: '/uploads/avatars/u1.jpg', tagline: 'Siap bantu', jobTitle: 'Teknisi' });
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

    it('does not unlink an avatar outside /uploads/csi', async () => {
        const view = await service.setPhoto(ICT, `user:${U1}`, '/uploads/csi/new.jpg');
        expect(view.photoUrl).toBe('/uploads/csi/new.jpg');
        expect(unlink).not.toHaveBeenCalled();
    });
});
