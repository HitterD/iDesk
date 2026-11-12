import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplateRater } from '../entities/csi-assignment-template-rater.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiAssignmentTemplateService } from './csi-assignment-template.service';
import { memoryTable } from './csi-memory-table.fixture';

const HC = ServiceScope.HC;
describe('CsiAssignmentTemplateService', () => {
    let templates: ReturnType<typeof memoryTable>;
    let pics: ReturnType<typeof memoryTable>;
    let raters: ReturnType<typeof memoryTable>;
    let csiPics: ReturnType<typeof memoryTable>;
    let users: ReturnType<typeof memoryTable>;
    let people: ReturnType<typeof memoryTable>;
    let sites: ReturnType<typeof memoryTable>;
    let service: CsiAssignmentTemplateService;

    beforeEach(() => {
        templates = memoryTable(); pics = memoryTable(); raters = memoryTable(); csiPics = memoryTable(); users = memoryTable();
        people = memoryTable(); sites = memoryTable();
        sites.rows.push({ id: 's-smg', code: 'SMG' });
        csiPics.rows.push(
            { id: 'pic-rara', scope: HC, fullName: 'RARA KURNIA MAHARANI PONGDATU', serviceFunction: null, isActive: true },
            { id: 'pic-mega', scope: HC, fullName: 'MEGA DRESTI RARASTYA NUGRAHENI', serviceFunction: 'Diisi manual', isActive: true },
        );
        users.rows.push(
            { id: 'u-elvi', fullName: 'Elvi Cynthia', isActive: true },
            { id: 'u-agus1', fullName: 'AGUS SUBEKTI', isActive: true },
            { id: 'u-agus2', fullName: 'Agus Subekti', isActive: true },
        );
        // The directory query filters on department in SQL; here every directory row is a candidate.
        const directory = { ...people, createQueryBuilder: () => ({ where: () => ({ getMany: async () => people.rows }) }) };
        const repositories = new Map<unknown, unknown>([
            [CsiAssignmentTemplate, templates], [CsiAssignmentTemplatePic, pics], [CsiAssignmentTemplateRater, raters],
            [CsiPic, csiPics], [User, users], [Site, sites], [CsiOrgPerson, directory],
        ]);
        const dataSource = { transaction: jest.fn(async (work: any) => work({ getRepository: (target: unknown) => repositories.get(target) })) };
        service = new CsiAssignmentTemplateService(templates as any, pics as any, raters as any, csiPics as any, users as any, people as any, sites as any, dataSource as any);
    });

    function seedRaters() {
        templates.rows.push({ id: 't', scope: HC, locationCode: 'SMG', name: 'Template' });
        pics.rows.push({ id: 'p', templateId: 't', picName: 'PIC', sortOrder: 0 });
        raters.rows.push(
            { id: 'r1', templatePicId: 'p', raterName: 'ELVI CYNTHIA', userId: null },
            { id: 'r2', templatePicId: 'p', raterName: 'AGUS SUBEKTI', userId: null },
        );
    }

    it('confirm rejects ambiguous and missing accounts before any write', async () => {
        seedRaters();
        await expect(service.confirmRaters(HC, ['r1', 'r2'], true, 'actor')).rejects.toThrow('Pilih akun dulu untuk: AGUS SUBEKTI');
        expect(raters.rows[0].confirmedAt).toBeUndefined();
        raters.rows[1].raterName = 'TIDAK ADA';
        await expect(service.confirmRaters(HC, ['r2'], true, 'actor')).rejects.toThrow('Pilih akun dulu untuk: TIDAK ADA');
    });

    it('indexes active account names once per confirmation batch, not per rater', async () => {
        seedRaters();
        raters.rows[1].raterName = 'ELVI CYNTHIA';
        const readName = jest.fn(() => 'Elvi Cynthia');
        Object.defineProperty(users.rows[0], 'fullName', { get: readName, configurable: true });
        const result = await service.confirmRaters(HC, ['r1', 'r2'], true, 'actor');
        expect(result.pics[0].raters.every((rater) => rater.status === 'confirmed')).toBe(true);
        // One index in the transaction, one in the returned template view.
        expect(readName).toHaveBeenCalledTimes(2);
    });

    it('bulk account pins and confirms all ids, and null clears both', async () => {
        seedRaters();
        const result = await service.setRaterAccounts(HC, ['r1', 'r2'], 'u-elvi', 'actor');
        expect(result.id).toBe('t');
        for (const row of raters.rows) expect(row).toMatchObject({ userId: 'u-elvi', confirmedAt: expect.any(Date), confirmedById: 'actor' });
        await service.setRaterAccounts(HC, ['r1', 'r2'], null, 'actor');
        for (const row of raters.rows) expect(row).toMatchObject({ userId: null, confirmedAt: null, confirmedById: null });
    });

    it('confirm resolves names and NIK, unconfirm preserves pins, single account delegates', async () => {
        seedRaters();
        raters.rows[1].raterNik = '277';
        users.rows[2].employeeId = '00000277';
        await service.confirmRaters(HC, ['r1', 'r2'], true, 'actor');
        expect(raters.rows[0]).toMatchObject({ userId: 'u-elvi', confirmedById: 'actor' });
        expect(raters.rows[1]).toMatchObject({ userId: 'u-agus2', confirmedAt: expect.any(Date) });
        await service.confirmRaters(HC, ['r1'], false, 'actor');
        expect(raters.rows[0]).toMatchObject({ userId: 'u-elvi', confirmedAt: null, confirmedById: null });
        await service.setRaterAccount(HC, 'r1', 'u-agus1', 'actor');
        expect(raters.rows[0]).toMatchObject({ userId: 'u-agus1', confirmedAt: expect.any(Date) });
    });

    it('rejects unknown or other-scope raters and inactive accounts without writes', async () => {
        seedRaters();
        templates.rows.push({ id: 'ict', scope: ServiceScope.ICT });
        pics.rows.push({ id: 'ip', templateId: 'ict' });
        raters.rows.push({ id: 'ir', templatePicId: 'ip', raterName: 'ELVI CYNTHIA' });
        await expect(service.setRaterAccounts(HC, ['r1', 'ir'], 'u-elvi', 'actor')).rejects.toThrow('Penilai tidak ditemukan');
        await expect(service.confirmRaters(HC, ['r1', 'missing'], false, 'actor')).rejects.toThrow('Penilai tidak ditemukan');
        await expect(service.setRaterAccounts(HC, ['r1'], 'inactive', 'actor')).rejects.toThrow('Pengguna tidak ditemukan atau tidak aktif');
        expect(raters.rows[0].userId).toBeNull();
    });

    it('returns first requested raters template when ids span templates', async () => {
        seedRaters();
        templates.rows.push({ id: 't2', scope: HC, locationCode: 'KRW', name: 'Other' });
        pics.rows.push({ id: 'p2', templateId: 't2', sortOrder: 0 });
        raters.rows.push({ id: 'r3', templatePicId: 'p2', raterName: 'ELVI CYNTHIA' });
        expect((await service.setRaterAccounts(HC, ['r3', 'r1'], 'u-elvi', 'actor')).id).toBe('t2');
    });

    it('addRater by account is confirmed', async () => {
        seedRaters();
        raters.rows.splice(1, 1);
        await service.addRater(HC, 'p', { userId: 'u-agus1' }, 'actor');
        expect(raters.rows.find((row) => row.userId === 'u-agus1')).toMatchObject({ confirmedAt: expect.any(Date), confirmedById: 'actor' });
    });

    it('loads suggestions using active users with site and department in one query', async () => {
        seedRaters();
        users.rows[0] = { ...users.rows[0], siteId: 's-smg', site: { code: 'SMG' }, department: { name: 'HC' }, email: 'elvi@example.test', employeeId: '123' };
        users.rows.push({ id: 'off', fullName: 'Elvi Cynthia', isActive: false });
        const result = await service.accountSuggestions(HC, 't', 'Elvi');
        expect(result).toEqual([expect.objectContaining({ id: 'u-elvi', siteCode: 'SMG', department: 'HC', email: 'elvi@example.test' })]);
        expect(users.find).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true }, relations: { site: true, department: true }, relationLoadStrategy: 'join' }));
        await expect(service.accountSuggestions(HC, 't', ' a ')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a suggestion query longer than 150 characters before reading users', async () => {
        seedRaters();
        users.find.mockClear();
        await expect(service.accountSuggestions(HC, 't', 'a'.repeat(151))).rejects.toThrow('Nama terlalu panjang');
        expect(users.find).not.toHaveBeenCalled();
        await expect(service.accountSuggestions(HC, 't', 'a'.repeat(150))).resolves.toBeDefined();
    });

    it('builds the blank workbook from active users in one sorted query; unknown locations are refused', async () => {
        users.find.mockResolvedValueOnce([{ fullName: 'ELVI CYNTHIA', jobTitle: 'PLANT MANAGER 1', employeeId: '277' }]);
        const { filename, buffer } = await service.blankWorkbook(HC, 'smg');
        expect(filename).toBe('CSI HC Semarang - template.xlsx');
        expect(buffer.length).toBeGreaterThan(0);
        expect(users.find).toHaveBeenCalledTimes(1);
        expect(users.find).toHaveBeenCalledWith({
            where: { isActive: true, site: { code: 'SMG' } }, select: { fullName: true, jobTitle: true, employeeId: true }, order: { fullName: 'ASC' },
        });
        await expect(service.blankWorkbook(HC, 'XXX')).rejects.toThrow('Lokasi tidak dikenal');
    });

    it('loads the bundled Semarang template once: 19 PICs, service functions, four new staff without raters', async () => {
        const first = await service.loadBundled(HC, 'SMG');
        await service.loadBundled(HC, 'SMG');
        expect(templates.rows).toHaveLength(1);
        expect(pics.rows).toHaveLength(19);
        const view = await service.get(HC, first.id);
        const rara = view.pics.find((pic) => pic.picName === 'RARA KURNIA MAHARANI PONGDATU')!;
        expect(rara).toMatchObject({ serviceCode: 'HCD', serviceFunction: 'People & Organization Development', picId: 'pic-rara', raterCount: 26 });
        expect(view.pics.filter((pic) => pic.raterCount === 0).map((pic) => pic.picName).sort())
            .toEqual(['AGUS SULISTYONO', 'JINGGA FERDASIWI', 'KUSMANTO', 'WAHYU PURWO ANOM SASONGKO']);
        expect(view.pics.find((pic) => pic.picName === 'BAGUS ARDIAN WIJAYA')!.jobTitle).toBe('HC SERVICES AREA SUPERVISOR');
    });

    it('fills an empty PIC service function from the template but never overwrites one set by hand', async () => {
        await service.loadBundled(HC, 'SMG');
        expect(csiPics.rows.find((row) => row.id === 'pic-rara')!.serviceFunction).toBe('People & Organization Development');
        expect(csiPics.rows.find((row) => row.id === 'pic-mega')!.serviceFunction).toBe('Diisi manual');
    });

    it('matches raters to accounts by name; same name twice is ambiguous, unknown is no account', async () => {
        const template = await service.loadBundled(HC, 'SMG');
        const view = await service.get(HC, template.id);
        const rara = view.pics.find((pic) => pic.picName === 'RARA KURNIA MAHARANI PONGDATU')!;
        const status = (name: string) => rara.raters.find((rater) => rater.raterName === name)!.status;
        expect(status('ELVI CYNTHIA')).toBe('ok');
        expect(status('AGUS SUBEKTI')).toBe('ambiguous');
        expect(status('ARIEF NOEGROHO')).toBe('no-account');
        expect(view.summary).toMatchObject({ pics: 19, raters: 434 });
    });

    it('selects employeeId and siteId for active accounts and confirms a unique NIK', async () => {
        const template = await service.loadBundled(HC, 'SMG');
        const target = raters.rows.find((row) => row.raterName === 'AGUS SUBEKTI')!;
        target.raterNik = '277';
        users.rows.find((row) => row.id === 'u-agus2')!.employeeId = '00000277';
        const find = jest.spyOn(users, 'find');
        const result = await service.get(HC, template.id);
        expect(result.pics.flatMap((pic) => pic.raters).find((row) => row.id === target.id))
            .toMatchObject({ userId: 'u-agus2', status: 'confirmed', confirmed: true, raterNik: '277' });
        expect(find).toHaveBeenCalledWith({ where: { isActive: true }, select: { id: true, fullName: true, employeeId: true, siteId: true } });
    });

    it('a rater added later by hand is kept; adding the same name twice is refused', async () => {
        const template = await service.loadBundled(HC, 'SMG');
        const jingga = (await service.get(HC, template.id)).pics.find((pic) => pic.picName === 'JINGGA FERDASIWI')!;
        await service.addRater(HC, jingga.id, { name: 'elvi cynthia' }, 'actor');
        await expect(service.addRater(HC, jingga.id, { name: 'ELVI  CYNTHIA' }, 'actor')).rejects.toBeInstanceOf(BadRequestException);
        const after = (await service.get(HC, template.id)).pics.find((pic) => pic.id === jingga.id)!;
        expect(after.raters.map((rater) => [rater.raterName, rater.status])).toEqual([['ELVI CYNTHIA', 'ok']]);
    });

    it('editing a PIC trims the service function; removing a PIC removes its raters', async () => {
        const template = await service.loadBundled(HC, 'SMG');
        const rara = (await service.get(HC, template.id)).pics.find((pic) => pic.picName === 'RARA KURNIA MAHARANI PONGDATU')!;
        await service.updatePic(HC, rara.id, { serviceFunction: '  POD  ' });
        expect(pics.rows.find((row) => row.id === rara.id)!.serviceFunction).toBe('POD');
        await service.removePic(HC, rara.id);
        expect(pics.rows.find((row) => row.id === rara.id)).toBeUndefined();
        expect(raters.rows.filter((row) => row.templatePicId === rara.id)).toEqual([]);
    });

    it('a PIC that did not match the PIC master is matched again on the next load', async () => {
        const template = await service.loadBundled(HC, 'SMG');
        const jingga = () => pics.rows.find((row) => row.picName === 'JINGGA FERDASIWI')!;
        expect(jingga().picId).toBeNull();
        csiPics.rows.push({ id: 'pic-jingga', scope: HC, fullName: 'Jingga Ferdasiwi', serviceFunction: null, isActive: true });
        await service.loadBundled(HC, 'SMG');
        expect(jingga().picId).toBe('pic-jingga');
        expect(templates.rows.map((row) => row.id)).toEqual([template.id]);
    });

    it('a template PIC missing from the PIC master is added from the directory (HC staff under HCBP AREA)', async () => {
        people.rows.push(
            { nik: '2001', fullName: 'PRISCILLA NATHANIA OZORA', department: 'HCBP AREA SEMARANG', bagian: 'HC DEVELOPMENT AREA - SEMARANG', jobTitle: 'HC DEVELOPMENT SUPERVISOR', workLocation: 'SJA-SEMARANG' },
        );
        users.rows.push({ id: 'u-pris', fullName: 'Priscilla Nathania Ozora', employeeId: '2001', isActive: true });
        await service.loadBundled(HC, 'SMG');
        const created = csiPics.rows.find((row) => row.nik === '2001')!;
        expect(created).toMatchObject({
            scope: HC, fullName: 'PRISCILLA NATHANIA OZORA', serviceCode: 'HCD', serviceFunction: 'Talent Acquisition & Assessment - People & Organization Development',
            siteId: 's-smg', userId: 'u-pris', workLocation: 'SJA-SEMARANG', isActive: true,
        });
        expect(pics.rows.find((row) => row.picName === 'PRISCILLA NATHANIA OZORA')!.picId).toBe(created.id);
        // Not in the directory (new staff): no PIC is invented.
        expect(csiPics.rows.some((row) => row.fullName === 'JINGGA FERDASIWI')).toBe(false);
        await service.loadBundled(HC, 'SMG');
        expect(csiPics.rows.filter((row) => row.nik === '2001')).toHaveLength(1);
    });

    it('a deactivated PIC listed in a template is switched back on', async () => {
        csiPics.rows.push({ id: 'pic-off', scope: HC, nik: '3001', fullName: 'BAGUS ARDIAN WIJAYA', serviceCode: 'HCS', serviceFunction: null, isActive: false });
        await service.loadBundled(HC, 'SMG');
        expect(csiPics.rows.find((row) => row.id === 'pic-off')!.isActive).toBe(true);
        expect(pics.rows.find((row) => row.picName === 'BAGUS ARDIAN WIJAYA')!.picId).toBe('pic-off');
    });

    it('a directory name with other casing or punctuation still becomes the PIC', async () => {
        people.rows.push({ nik: '2002', fullName: 'Jenny Erine  Valentina.', department: 'HCBP AREA SEMARANG', bagian: null, jobTitle: 'TA STAFF', workLocation: 'SJA-SEMARANG' });
        await service.loadBundled(HC, 'SMG');
        expect(csiPics.rows.find((row) => row.nik === '2002')).toMatchObject({ serviceCode: 'HCD', serviceFunction: 'Talent Acquisition & Assessment' });
        expect(pics.rows.find((row) => row.picName === 'JENNY ERINE VALENTINA')!.picId).toBe(csiPics.rows.find((row) => row.nik === '2002')!.id);
    });

    it('loading the bundled template after a rename keeps the renamed PIC: one row under the current name, no new master', async () => {
        await service.loadBundled(HC, 'SMG');
        const before = { masters: csiPics.rows.length, rows: pics.rows.length };
        Object.assign(csiPics.rows.find((row) => row.id === 'pic-rara')!, { fullName: 'Rara Pongdatu', aliases: ['RARA KURNIA MAHARANI PONGDATU'] });
        pics.rows.find((row) => row.picId === 'pic-rara')!.picName = 'RARA PONGDATU';
        await service.loadBundled(HC, 'SMG');
        expect(csiPics.rows).toHaveLength(before.masters);
        expect(pics.rows).toHaveLength(before.rows);
        expect(pics.rows.filter((row) => row.picId === 'pic-rara').map((row) => row.picName)).toEqual(['RARA PONGDATU']);
    });

    it('a PIC added by its old name links to the renamed master', async () => {
        templates.rows.push({ id: 't', scope: HC, locationCode: 'SMG', name: 'Template' });
        Object.assign(csiPics.rows.find((row) => row.id === 'pic-mega')!, { fullName: 'Mega Nugraheni', aliases: ['MEGA DRESTI'] });
        await service.addPic(HC, 't', { serviceCode: 'HCD', picName: 'Mega Dresti' });
        expect(pics.rows).toEqual([expect.objectContaining({ picName: 'MEGA DRESTI', picId: 'pic-mega' })]);
    });
});
