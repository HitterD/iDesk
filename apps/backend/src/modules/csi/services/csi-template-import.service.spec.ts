import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiTeamKind } from '../csi.constants';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplateRater } from '../entities/csi-assignment-template-rater.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { memoryTable } from './csi-memory-table.fixture';
import { CsiTemplateImportOptions, CsiTemplateImportService } from './csi-template-import.service';

const HC = ServiceScope.HC;
const HEADER = ['Area', 'Nama Lengkap Karyawan (HC)', 'Jabatan', 'Fungsi pelayanan', 'Nama Lengkap Penilai', 'NIK Penilai'];
type Sheets = { team?: unknown[][]; employees?: unknown[][] };

async function workbook(rows: unknown[][], sheets: Sheets = {}) {
    const book = new ExcelJS.Workbook();
    book.addWorksheet('List Penilai 2026').addRows([HEADER, ...rows]);
    if (sheets.team) book.addWorksheet('Tim').addRows([['Nama Tim', 'Anggota', 'NIK'], ...sheets.team]);
    if (sheets.employees) book.addWorksheet('Karyawan SMG').addRows([['Nama', 'Jabatan', 'NIK'], ...sheets.employees]);
    return Buffer.from(await book.xlsx.writeBuffer());
}
const options = (overrides: Partial<CsiTemplateImportOptions> = {}): CsiTemplateImportOptions => ({
    commit: false, resolutions: {}, prune: false, pruneConfirmed: false, ...overrides,
});

describe('CsiTemplateImportService', () => {
    let tables: Record<string, ReturnType<typeof memoryTable>>;
    let service: CsiTemplateImportService;

    beforeEach(() => {
        tables = Object.fromEntries(['templates', 'pics', 'raters', 'masters', 'users', 'people', 'sites', 'teams', 'members']
            .map((name) => [name, memoryTable()]));
        tables.sites.rows.push({ id: 's-smg', code: 'SMG' }, { id: 's-krw', code: 'KRW' });
        tables.masters.rows.push({ id: 'pic-rara', scope: HC, nik: '00001001', fullName: 'RARA', serviceCode: 'HCD', siteId: 's-smg', serviceFunction: null, isActive: true });
        tables.people.rows.push({ nik: '00002001', fullName: 'Erna', department: 'HCBP AREA SEMARANG', bagian: null, jobTitle: 'TA STAFF', workLocation: 'SJA-SEMARANG' });
        tables.users.rows.push(
            { id: 'u-elvi', fullName: 'Elvi Cynthia', employeeId: '123', isActive: true },
            { id: 'u-budi', fullName: 'Budi Santoso', employeeId: null, isActive: true },
            { id: 'u-new', fullName: 'Someone Else', employeeId: '777', isActive: true },
        );
        // The directory query filters on department in SQL; here every directory row is a candidate.
        const directory = { ...tables.people, createQueryBuilder: () => ({ where: () => ({ getMany: async () => tables.people.rows }) }) };
        const repositories = new Map<unknown, unknown>([
            [CsiAssignmentTemplate, tables.templates], [CsiAssignmentTemplatePic, tables.pics], [CsiAssignmentTemplateRater, tables.raters],
            [CsiPic, tables.masters], [User, tables.users], [Site, tables.sites], [CsiOrgPerson, directory],
            [CsiTeam, tables.teams], [CsiTeamMember, tables.members],
        ]);
        const manager = { getRepository: (target: unknown) => repositories.get(target) };
        const dataSource = { manager, transaction: jest.fn(async (work: any) => work(manager)) };
        service = new CsiTemplateImportService(dataSource as any);
    });

    function seedTemplate(locationCode = 'SMG') {
        tables.templates.rows.push({ id: 't', scope: HC, locationCode, name: 'Template' });
        tables.pics.rows.push({ id: 'p-rara', templateId: 't', area: 'HC Development', serviceCode: 'HCD', picName: 'RARA', jobTitle: 'STAFF',
            serviceFunction: null, picId: 'pic-rara', picNik: null, teamId: null, sortOrder: 0 });
        tables.raters.rows.push({ id: 'r-budi', templatePicId: 'p-rara', raterName: 'BUDI', raterNik: null, confirmedAt: null });
    }
    function addTemplatePic(id: string, picName: string, serviceCode: string, raters: Array<[string, Date | null]>) {
        tables.pics.rows.push({ id, templateId: 't', area: 'X', serviceCode, picName, jobTitle: null, serviceFunction: null, picId: null, picNik: null, teamId: null, sortOrder: 1 });
        raters.forEach(([raterName, confirmedAt]) => tables.raters.rows.push({ id: `${id}-${raterName}`, templatePicId: id, raterName, confirmedAt }));
    }
    const ratersOf = (picName: string) => {
        const pic = tables.pics.rows.find((row) => row.picName === picName)!;
        return tables.raters.rows.filter((row) => row.templatePicId === pic.id).map((row) => row.raterName).sort();
    };

    it('dry run reports diff without writing', async () => {
        seedTemplate();
        addTemplatePic('p-old', 'LAMA', 'HCD', [['X', null]]);
        const buffer = await workbook([
            ['HC Development', 'RARA', 'SUPERVISOR', null, 'BUDI'],
            ['HC Development', 'RARA', null, null, 'CICI'],
            ['HC Development', 'ERNA', 'STAFF', null, 'BUDI'],
            ['HC Development', 'TIM REKRUT', null, null, 'DODI'],
        ]);
        const report = await service.importExcel(HC, 'smg', buffer, options({ prune: true }));
        expect(report).toEqual({
            format: 'list', committed: false, services: ['HCD'],
            pics: { added: ['ERNA', 'TIM REKRUT'], changed: ['RARA'], removed: ['LAMA'] },
            raters: { added: 3, removed: 1 }, teams: { added: ['TIM REKRUT'] }, newMasterPics: ['ERNA'], unresolved: [], problems: [],
        });
        for (const table of Object.values(tables)) {
            expect(table.save).not.toHaveBeenCalled();
            expect(table.delete).not.toHaveBeenCalled();
        }
    });

    it('commit blocked while unresolved', async () => {
        const buffer = await workbook([['HC Development', 'RARA', null, null, 'BUDI'], ['HC Services', 'ERNA WATI', null, null, 'BUDI']]);
        const dry = await service.importExcel(HC, 'SMG', buffer, options());
        expect(dry.unresolved).toEqual([{ name: 'ERNA WATI', suggestions: expect.arrayContaining(['ERNA']) }]);
        await expect(service.importExcel(HC, 'SMG', buffer, options({ commit: true }))).rejects.toThrow('Tentukan dulu: ERNA WATI');
        expect(tables.templates.rows).toHaveLength(0);
        expect(tables.masters.rows).toHaveLength(1);
    });

    it('rename resolution resolves the master by name only, ignoring the row NIK', async () => {
        const buffer = await workbook([['HC Development', 'ERNA WATI', null, null, 'BUDI']], { employees: [['ERNA WATI', 'STAFF', 1001]] });
        const report = await service.importExcel(HC, 'SMG', buffer, options({ commit: true, resolutions: { 'Erna Wati': { as: 'rename', picName: 'erna' } } }));
        const erna = tables.masters.rows.find((row) => row.nik === '00002001')!;
        expect(report).toMatchObject({ committed: true, pics: { added: ['ERNA'] }, newMasterPics: ['ERNA'] });
        expect(tables.pics.rows).toEqual([expect.objectContaining({ picName: 'ERNA', picId: erna.id })]);
    });

    it('prune limited to services in file', async () => {
        seedTemplate();
        addTemplatePic('p-old', 'LAMA', 'HCD', [['X', null]]);
        addTemplatePic('p-hcs', 'SERVIS', 'HCS', [['Y', null]]);
        const buffer = await workbook([['HC Development', 'RARA', null, null, 'CICI']]);
        const report = await service.importExcel(HC, 'SMG', buffer, options({ commit: true, prune: true }));
        expect(report).toMatchObject({ committed: true, services: ['HCD'], pics: { removed: ['LAMA'] }, raters: { added: 1, removed: 2 } });
        expect(tables.pics.rows.map((row) => row.picName).sort()).toEqual(['RARA', 'SERVIS']);
        expect(ratersOf('RARA')).toEqual(['CICI']);
        expect(ratersOf('SERVIS')).toEqual(['Y']);
    });

    it('prune keeps confirmed unless pruneConfirmed', async () => {
        seedTemplate();
        const confirmedAt = new Date();
        tables.raters.rows[0].confirmedAt = confirmedAt;
        tables.raters.rows.push({ id: 'r-dodi', templatePicId: 'p-rara', raterName: 'DODI', confirmedAt: null });
        addTemplatePic('p-old', 'LAMA', 'HCD', [['X', confirmedAt]]);
        const buffer = await workbook([['HC Development', 'RARA', null, null, 'CICI']]);
        const first = await service.importExcel(HC, 'SMG', buffer, options({ commit: true, prune: true }));
        expect(first).toMatchObject({ pics: { removed: [] }, raters: { removed: 1 } });
        expect(ratersOf('RARA')).toEqual(['BUDI', 'CICI']);
        expect(ratersOf('LAMA')).toEqual(['X']);
        const second = await service.importExcel(HC, 'SMG', buffer, options({ commit: true, prune: true, pruneConfirmed: true }));
        expect(second).toMatchObject({ pics: { removed: ['LAMA'] }, raters: { removed: 2 } });
        expect(ratersOf('RARA')).toEqual(['CICI']);
        expect(tables.pics.rows.map((row) => row.picName)).toEqual(['RARA']);
    });

    it('stores parsed PIC and rater NIK', async () => {
        const buffer = await workbook([['HC Development', 'RARA', null, null, 'BUDI', 71]], { employees: [['RARA', 'STAFF', 1001]] });
        await service.importExcel(HC, 'SMG', buffer, options({ commit: true }));
        expect(tables.pics.rows[0]).toMatchObject({ picNik: '00001001', picId: 'pic-rara' });
        expect(tables.raters.rows[0]).toMatchObject({ raterNik: '00000071' });
    });

    it('refreshes rater NIK on re-import without touching confirmation', async () => {
        seedTemplate();
        const confirmedAt = new Date();
        tables.raters.rows[0].confirmedAt = confirmedAt;
        await service.importExcel(HC, 'SMG', await workbook([['HC Development', 'RARA', null, null, 'BUDI', 55]]), options({ commit: true }));
        expect(tables.raters.rows).toEqual([expect.objectContaining({ raterName: 'BUDI', raterNik: '00000055', confirmedAt })]);
    });

    it('creates custom team with members', async () => {
        const buffer = await workbook([['HC Services', 'TIM REKRUT', null, 'Rekrutmen', 'BUDI']], {
            team: [['Tim Rekrut', 'Elvi Cynthia', 123], [null, 'Budi Santoso', null], [null, 'Agus', null]],
        });
        const report = await service.importExcel(HC, 'SMG', buffer, options({ commit: true }));
        expect(report.teams.added).toEqual(['TIM REKRUT']);
        const team = tables.teams.rows[0];
        expect(team).toMatchObject({ scope: HC, kind: CsiTeamKind.CUSTOM, siteId: 's-smg', serviceCode: 'HCS', name: 'TIM REKRUT', isActive: true });
        expect(tables.members.rows.map(({ teamId, name, nik, userId }) => ({ teamId, name, nik, userId }))).toEqual([
            { teamId: team.id, name: 'ELVI CYNTHIA', nik: '00000123', userId: 'u-elvi' },
            { teamId: team.id, name: 'BUDI SANTOSO', nik: null, userId: 'u-budi' },
            { teamId: team.id, name: 'AGUS', nik: null, userId: null },
        ]);
        expect(tables.pics.rows).toEqual([expect.objectContaining({ picName: 'TIM REKRUT', teamId: team.id, picId: null })]);
        expect(tables.masters.rows).toHaveLength(1);
        const again = await service.importExcel(HC, 'SMG', buffer, options({ commit: true }));
        expect(again.teams.added).toEqual([]);
        expect(tables.teams.rows).toHaveLength(1);
        expect(tables.members.rows).toHaveLength(3);
    });

    it('creates master pic without directory row', async () => {
        const buffer = await workbook([
            ['HC Comben', 'STAFF BARU', 'ADMIN', 'Payroll', 'BUDI'],
            ['HC Comben', 'TANPA NIK', null, null, 'BUDI'],
        ], { employees: [['Staff Baru', 'ADMIN', 777]] });
        const resolutions = { 'staff baru': { as: 'pic' as const }, 'TANPA NIK': { as: 'pic' as const } };
        expect((await service.importExcel(HC, 'SMG', buffer, options({ resolutions }))).newMasterPics).toEqual(['STAFF BARU', 'TANPA NIK']);
        expect(tables.masters.rows).toHaveLength(1);
        await service.importExcel(HC, 'SMG', buffer, options({ commit: true, resolutions }));
        const staff = tables.masters.rows.find((row) => row.fullName === 'STAFF BARU')!;
        const unnamed = tables.masters.rows.find((row) => row.fullName === 'TANPA NIK')!;
        expect(staff).toMatchObject({ scope: HC, nik: '00000777', jobTitle: 'ADMIN', serviceCode: 'HCC', serviceFunction: 'Payroll', siteId: 's-smg', userId: 'u-new', isActive: true });
        expect(unnamed).toMatchObject({ siteId: 's-smg', userId: null, isActive: true });
        expect(unnamed.nik).toMatch(/^TPL-[0-9A-F]{8}$/);
        expect(tables.pics.rows.map((row) => [row.picName, row.picId])).toEqual([['STAFF BARU', staff.id], ['TANPA NIK', unnamed.id]]);
    });

    it('import into empty KRW creates template', async () => {
        const buffer = await workbook([['HC Development', 'RARA', null, null, 'BUDI']]);
        await expect(service.importExcel(HC, 'JKT', buffer, options({ commit: true }))).rejects.toThrow('Lokasi tidak dikenal');
        const report = await service.importExcel(HC, 'KRW', buffer, options({ commit: true }));
        expect(report).toMatchObject({ committed: true, pics: { added: ['RARA'] }, raters: { added: 1 } });
        expect(tables.templates.rows).toEqual([expect.objectContaining({ scope: HC, locationCode: 'KRW', name: 'CSI HC – Karawang' })]);
        expect(tables.pics.rows).toEqual([expect.objectContaining({ templateId: tables.templates.rows[0].id, picName: 'RARA', picId: 'pic-rara' })]);
    });
});
