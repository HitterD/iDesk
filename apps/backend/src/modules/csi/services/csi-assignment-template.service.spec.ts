import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplateRater } from '../entities/csi-assignment-template-rater.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiAssignmentTemplateService } from './csi-assignment-template.service';
import { memoryTable } from './csi-memory-table.fixture';

const HC = ServiceScope.HC;
async function excel(rows: unknown[][]) {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('List Penilai 2026');
    sheet.addRow(['No.', 'Area', 'Nama Lengkap Karyawan (HC)', 'Jabatan', 'FUNGSI PELAYANAN', 'Nama Lengkap Penilai', 'Jabatan (akan terisi otomatis)']);
    rows.forEach((row) => sheet.addRow(row));
    return Buffer.from(await book.xlsx.writeBuffer());
}

describe('CsiAssignmentTemplateService', () => {
    let templates: ReturnType<typeof memoryTable>;
    let pics: ReturnType<typeof memoryTable>;
    let raters: ReturnType<typeof memoryTable>;
    let csiPics: ReturnType<typeof memoryTable>;
    let users: ReturnType<typeof memoryTable>;
    let service: CsiAssignmentTemplateService;

    beforeEach(() => {
        templates = memoryTable(); pics = memoryTable(); raters = memoryTable(); csiPics = memoryTable(); users = memoryTable();
        csiPics.rows.push(
            { id: 'pic-rara', scope: HC, fullName: 'RARA KURNIA MAHARANI PONGDATU', serviceFunction: null, isActive: true },
            { id: 'pic-mega', scope: HC, fullName: 'MEGA DRESTI RARASTYA NUGRAHENI', serviceFunction: 'Diisi manual', isActive: true },
        );
        users.rows.push(
            { id: 'u-elvi', fullName: 'Elvi Cynthia', isActive: true },
            { id: 'u-agus1', fullName: 'AGUS SUBEKTI', isActive: true },
            { id: 'u-agus2', fullName: 'Agus Subekti', isActive: true },
        );
        const repositories = new Map<unknown, unknown>([
            [CsiAssignmentTemplate, templates], [CsiAssignmentTemplatePic, pics], [CsiAssignmentTemplateRater, raters],
        ]);
        const dataSource = { transaction: jest.fn(async (work: any) => work({ getRepository: (target: unknown) => repositories.get(target) })) };
        service = new CsiAssignmentTemplateService(templates as any, pics as any, raters as any, csiPics as any, users as any, dataSource as any);
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

    it('a rater added later by hand is kept; adding the same name twice is refused', async () => {
        const template = await service.loadBundled(HC, 'SMG');
        const jingga = (await service.get(HC, template.id)).pics.find((pic) => pic.picName === 'JINGGA FERDASIWI')!;
        await service.addRater(HC, jingga.id, { name: 'elvi cynthia' });
        await expect(service.addRater(HC, jingga.id, { name: 'ELVI  CYNTHIA' })).rejects.toBeInstanceOf(BadRequestException);
        const after = (await service.get(HC, template.id)).pics.find((pic) => pic.id === jingga.id)!;
        expect(after.raters.map((rater) => [rater.raterName, rater.status])).toEqual([['ELVI CYNTHIA', 'ok']]);
    });

    it('Excel import: dry run writes nothing, commit merges (adds, never removes)', async () => {
        const template = await service.loadBundled(HC, 'SMG');
        const buffer = await excel([
            [1, 'HC Services', 'KUSMANTO', 'KOMANDAN REGU SECURITY', 'SECURITY SERVICES', 'ELVI CYNTHIA', null],
            [2, 'HC Services', 'PIC BARU', 'STAFF', 'Layanan baru', 'ARIEF NOEGROHO', null],
        ]);
        const before = raters.rows.length;
        const dry = await service.importExcel(HC, 'SMG', buffer, false);
        expect(dry).toMatchObject({ picsAdded: 1, ratersAdded: 2, committed: false });
        expect(raters.rows.length).toBe(before);
        const done = await service.importExcel(HC, 'SMG', buffer, true);
        expect(done.committed).toBe(true);
        expect(pics.rows).toHaveLength(20);
        expect(raters.rows.length).toBe(before + 2);
        expect(templates.rows.map((row) => row.id)).toEqual([template.id]);
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
});
