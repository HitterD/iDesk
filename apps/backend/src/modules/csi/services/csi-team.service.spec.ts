import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiPeriodPublishStatus } from '../csi.constants';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { memoryTable } from './csi-memory-table.fixture';
import { CsiTeamService } from './csi-team.service';

const HC = ServiceScope.HC;
const ICT = ServiceScope.ICT;
const SITE = '11111111-1111-4111-8111-111111111111';
const U1 = '22222222-2222-4222-8222-222222222222';
const U2 = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-11-10T10:00:00+07:00');

describe('CsiTeamService', () => {
    let tables: Record<string, ReturnType<typeof memoryTable>>;
    let service: CsiTeamService;

    beforeEach(() => {
        tables = Object.fromEntries(['teams', 'members', 'sites', 'users', 'templatePics', 'ratees', 'periods'].map((name) => [name, memoryTable()]));
        tables.sites.rows.push({ id: SITE, code: 'SMG', name: 'Semarang' });
        tables.users.rows.push(
            { id: U1, fullName: 'Hana HC', isActive: true },
            { id: U2, fullName: 'Nonaktif', isActive: false },
        );
        const repositories = new Map<unknown, unknown>([
            [CsiTeam, tables.teams], [CsiTeamMember, tables.members], [Site, tables.sites], [User, tables.users],
            [CsiAssignmentTemplatePic, tables.templatePics], [CsiPeriodRatee, tables.ratees], [CsiPeriod, tables.periods],
        ]);
        const manager = { getRepository: (target: unknown) => repositories.get(target) };
        const dataSource = { manager, transaction: jest.fn(async (work: any) => work(manager)) };
        service = new CsiTeamService(dataSource as any);
        service.clock = () => NOW;
    });

    const custom = (over: Record<string, unknown> = {}) => service.createCustom(HC, { siteId: SITE, name: 'Tim Rekrutmen', serviceCode: 'HCD', ...over });

    it('custom team requires service', async () => {
        await expect(custom({ serviceCode: undefined })).rejects.toThrow('Nama dan layanan tim wajib diisi');
        await expect(custom({ name: '  ' })).rejects.toThrow('Nama dan layanan tim wajib diisi');
        const view = await custom();
        expect(view).toMatchObject({ kind: 'TEAM', teamKind: 'CUSTOM', serviceCode: 'HCD', name: 'Tim Rekrutmen', members: [] });
        expect(tables.teams.rows[0]).toMatchObject({ scope: HC, kind: 'CUSTOM', siteId: SITE, isActive: true });
    });

    it('rejects a duplicate custom name in the same site and custom teams outside HC', async () => {
        await custom();
        await expect(custom({ name: 'tim  rekrutmen' })).rejects.toThrow('Nama tim sudah dipakai di site ini');
        await expect(service.createCustom(ICT, { siteId: SITE, name: 'X', serviceCode: 'HCD' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(custom({ siteId: '99999999-9999-4999-8999-999999999999' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('renames a team and changes the layanan of a custom team only', async () => {
        const team = await custom();
        await expect(service.update(HC, team.teamId!, { name: 'Tim TA', serviceCode: 'HCS' })).resolves.toMatchObject({ name: 'Tim TA', serviceCode: 'HCS' });
        tables.teams.rows.push({ id: 'site-team', scope: HC, siteId: SITE, kind: 'SITE', name: 'Tim Semarang', isActive: true });
        await expect(service.update(HC, 'site-team', { serviceCode: 'HCC' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.update(ICT, team.teamId!, { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('members replaced', async () => {
        const team = await custom();
        tables.members.rows.push({ id: 'old', teamId: team.teamId, userId: null, name: 'Lama', nik: null, sortOrder: 0 });
        const view = await service.replaceMembers(HC, team.teamId!, [{ userId: U1 }, { name: ' budi  santoso ' }, { name: 'BUDI SANTOSO' }, { name: 'Hana hc' }]);
        expect(view.members).toEqual([
            { id: expect.any(String), name: 'Hana HC', userId: U1 },
            { id: expect.any(String), name: 'budi santoso', userId: null },
        ]);
        expect(tables.members.rows.map((row) => [row.name, row.sortOrder])).toEqual([['Hana HC', 0], ['budi santoso', 1]]);
        await expect(service.replaceMembers(HC, team.teamId!, [{ userId: U2 }])).rejects.toThrow('Pengguna tidak ditemukan atau tidak aktif');
        await expect(service.replaceMembers(HC, team.teamId!, [{}])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('delete refused while team used in active survey', async () => {
        const team = await custom();
        tables.periods.rows.push({ id: 'p1', scope: HC, publishStatus: CsiPeriodPublishStatus.PUBLISHED, startDate: '2026-11-01', endDate: '2026-11-30' });
        tables.ratees.rows.push({ id: 'r1', periodId: 'p1', teamId: team.teamId });
        await expect(service.remove(HC, team.teamId!)).rejects.toThrow('Tim dipakai di survei yang belum selesai');
        expect(tables.teams.rows).toHaveLength(1);
    });

    it('deletes an unused custom team with its template rows', async () => {
        const team = await custom();
        tables.templatePics.rows.push({ id: 'tp1', templateId: 't', teamId: team.teamId, picId: null }, { id: 'tp2', templateId: 't', teamId: null, picId: 'x' });
        await service.remove(HC, team.teamId!);
        expect(tables.teams.rows).toEqual([]);
        expect(tables.templatePics.rows.map((row) => row.id)).toEqual(['tp2']);
    });

    it('a team kept by ended or cancelled surveys is deactivated, not deleted (their results stay)', async () => {
        const team = await custom();
        tables.periods.rows.push(
            { id: 'p-ended', scope: HC, publishStatus: CsiPeriodPublishStatus.PUBLISHED, startDate: '2026-10-01', endDate: '2026-10-31' },
            { id: 'p-cancel', scope: HC, publishStatus: CsiPeriodPublishStatus.CANCELLED, startDate: '2026-11-01', endDate: '2026-12-31' },
        );
        tables.ratees.rows.push({ id: 'r1', periodId: 'p-ended', teamId: team.teamId }, { id: 'r2', periodId: 'p-cancel', teamId: team.teamId });
        tables.templatePics.rows.push({ id: 'tp1', templateId: 't', teamId: team.teamId, picId: null });
        await service.remove(HC, team.teamId!);
        expect(tables.teams.rows).toEqual([expect.objectContaining({ id: team.teamId, isActive: false })]);
        expect(tables.templatePics.rows).toEqual([]);
    });

    it('never deletes a site team', async () => {
        tables.teams.rows.push({ id: 'site-team', scope: HC, siteId: SITE, kind: 'SITE', name: 'Tim Semarang', isActive: true });
        await expect(service.remove(HC, 'site-team')).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.replaceMembers(HC, 'site-team', [{ name: 'A' }])).rejects.toBeInstanceOf(BadRequestException);
    });
});
