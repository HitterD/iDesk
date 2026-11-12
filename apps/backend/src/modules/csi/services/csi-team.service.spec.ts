import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiPeriodPublishStatus } from '../csi.constants';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';
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
        tables = Object.fromEntries(['teams', 'members', 'sites', 'users', 'templatePics', 'ratees', 'periods', 'dimensions', 'pairs', 'responses'].map((name) => [name, memoryTable()]));
        tables.sites.rows.push({ id: SITE, code: 'SMG', name: 'Semarang' });
        tables.users.rows.push(
            { id: U1, fullName: 'Hana HC', isActive: true },
            { id: U2, fullName: 'Nonaktif', isActive: false },
        );
        const repositories = new Map<unknown, unknown>([
            [CsiTeam, tables.teams], [CsiTeamMember, tables.members], [Site, tables.sites], [User, tables.users],
            [CsiAssignmentTemplatePic, tables.templatePics], [CsiPeriodRatee, tables.ratees], [CsiPeriod, tables.periods],
            [CsiPeriodRateeDimension, tables.dimensions], [CsiPeriodRaterRatee, tables.pairs], [CsiResponse, tables.responses],
        ]);
        // Row lock taken before draft ratees are removed: a no-op query builder over the memory table.
        const lockBuilder = { setLock: () => lockBuilder, where: () => lockBuilder, getOne: async () => null };
        Object.assign(tables.periods, { createQueryBuilder: () => lockBuilder });
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

    it('createCustom with the name of an inactive team reactivates it', async () => {
        tables.teams.rows.push({ id: 'old-team', scope: HC, siteId: SITE, kind: 'CUSTOM', serviceCode: 'HCC', name: 'TIM REKRUTMEN', isActive: false });
        const view = await custom();
        expect(view).toMatchObject({ teamId: 'old-team', serviceCode: 'HCD', name: 'TIM REKRUTMEN' });
        expect(tables.teams.rows).toEqual([expect.objectContaining({ id: 'old-team', isActive: true, serviceCode: 'HCD' })]);
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

    const period = (id: string, over: Record<string, unknown> = {}) =>
        tables.periods.rows.push({ id, scope: HC, title: `Survei ${id}`, publishStatus: CsiPeriodPublishStatus.PUBLISHED, startDate: '2026-11-01', endDate: '2026-11-30', ...over });
    const rateTeam = (teamId: string, periodId: string) => {
        const id = `r-${periodId}`;
        tables.ratees.rows.push({ id, periodId, kind: 'TEAM', teamId });
        tables.dimensions.rows.push({ id: `d-${periodId}`, periodRateeId: id });
        tables.pairs.rows.push({ id: `pr-${periodId}`, periodId, periodRaterId: 'rater', periodRateeId: id });
        return id;
    };

    it('delete refused while team used in a running or answered survey, naming the surveys', async () => {
        const team = await custom();
        period('p1', { title: 'CSI HC November' });
        period('p2', { title: 'CSI HC Desember', startDate: '2026-12-01', endDate: '2026-12-31' });
        rateTeam(team.teamId!, 'p1');
        rateTeam(team.teamId!, 'p2');
        tables.responses.rows.push({ id: 'resp', periodId: 'p2' });
        await expect(service.deleteImpact(HC, team.teamId!)).resolves.toEqual({
            blocked: [{ periodId: 'p1', title: 'CSI HC November', reason: 'running' }, { periodId: 'p2', title: 'CSI HC Desember', reason: 'answered' }],
            draftSurveys: [], finishedSurveys: 0,
        });
        await expect(service.remove(HC, team.teamId!)).rejects.toThrow('Tim dipakai di survei yang sedang berjalan: CSI HC November, CSI HC Desember');
        expect(tables.teams.rows).toHaveLength(1);
        expect(tables.ratees.rows).toHaveLength(2);
    });

    it('removes the team ratee (pairs and dimensions too) from draft and not-yet-started surveys, then deletes the team', async () => {
        const team = await custom();
        period('p-draft', { publishStatus: CsiPeriodPublishStatus.DRAFT, title: 'Draft HC' });
        period('p-soon', { startDate: '2026-12-01', endDate: '2026-12-31', title: 'Desember HC' });
        rateTeam(team.teamId!, 'p-draft');
        rateTeam(team.teamId!, 'p-soon');
        tables.ratees.rows.push({ id: 'other', periodId: 'p-draft', kind: 'PERSON', teamId: null });
        await expect(service.deleteImpact(HC, team.teamId!)).resolves.toEqual({
            blocked: [], draftSurveys: [{ periodId: 'p-draft', title: 'Draft HC' }, { periodId: 'p-soon', title: 'Desember HC' }], finishedSurveys: 0,
        });
        await service.remove(HC, team.teamId!);
        expect(tables.ratees.rows.map((row) => row.id)).toEqual(['other']);
        expect(tables.dimensions.rows).toEqual([]);
        expect(tables.pairs.rows).toEqual([]);
        expect(tables.teams.rows).toEqual([]);
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
        period('p-ended', { startDate: '2026-10-01', endDate: '2026-10-31' });
        period('p-cancel', { publishStatus: CsiPeriodPublishStatus.CANCELLED, startDate: '2026-11-01', endDate: '2026-12-31' });
        period('p-draft', { publishStatus: CsiPeriodPublishStatus.DRAFT });
        rateTeam(team.teamId!, 'p-ended');
        rateTeam(team.teamId!, 'p-cancel');
        rateTeam(team.teamId!, 'p-draft');
        tables.responses.rows.push({ id: 'resp', periodId: 'p-ended' });
        tables.templatePics.rows.push({ id: 'tp1', templateId: 't', teamId: team.teamId, picId: null });
        await expect(service.deleteImpact(HC, team.teamId!)).resolves.toMatchObject({ blocked: [], finishedSurveys: 2 });
        await service.remove(HC, team.teamId!);
        expect(tables.teams.rows).toEqual([expect.objectContaining({ id: team.teamId, isActive: false })]);
        expect(tables.templatePics.rows).toEqual([]);
        expect(tables.ratees.rows.map((row) => row.periodId)).toEqual(['p-ended', 'p-cancel']);
    });

    it('deletes a site team by the same rules; members stay for custom teams only', async () => {
        tables.teams.rows.push({ id: 'site-team', scope: HC, siteId: SITE, kind: 'SITE', name: 'Tim Semarang', isActive: true });
        tables.templatePics.rows.push({ id: 'tp1', templateId: 't', teamId: 'site-team', picId: null });
        period('p-draft', { publishStatus: CsiPeriodPublishStatus.DRAFT });
        rateTeam('site-team', 'p-draft');
        await service.remove(HC, 'site-team');
        expect(tables.teams.rows).toEqual([]);
        expect(tables.ratees.rows).toEqual([]);
        expect(tables.templatePics.rows).toEqual([]);
        tables.teams.rows.push({ id: 'site-team', scope: HC, siteId: SITE, kind: 'SITE', name: 'Tim Semarang', isActive: true });
        await expect(service.replaceMembers(HC, 'site-team', [{ name: 'A' }])).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.remove(ICT, 'site-team')).rejects.toBeInstanceOf(NotFoundException);
    });
});
