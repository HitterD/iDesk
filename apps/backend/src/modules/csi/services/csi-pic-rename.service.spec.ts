import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPeriodPublishStatus } from '../csi.constants';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { memoryTable } from './csi-memory-table.fixture';
import { CsiPicRenameService, nextAliases } from './csi-pic-rename.service';

const HC = ServiceScope.HC;
const NOW = new Date('2026-11-10T10:00:00+07:00');
const OLD = 'RARA KURNIA MAHARANI PONGDATU';

describe('CsiPicRenameService', () => {
    let tables: Record<string, ReturnType<typeof memoryTable>>;
    let service: CsiPicRenameService;
    let transaction: jest.Mock;

    beforeEach(() => {
        tables = Object.fromEntries(['pics', 'templates', 'templatePics', 'ratees', 'periods', 'responses'].map((name) => [name, memoryTable()]));
        tables.pics.rows.push({ id: 'pic-rara', scope: HC, nik: '1001', fullName: OLD, aliases: [], serviceCode: 'HCD', isActive: true, user: null });
        tables.templates.rows.push({ id: 't-smg', scope: HC, locationCode: 'SMG' }, { id: 't-krw', scope: HC, locationCode: 'KRW' });
        tables.templatePics.rows.push(
            { id: 'tp1', templateId: 't-smg', picName: OLD, picId: 'pic-rara', teamId: null },
            { id: 'tp2', templateId: 't-krw', picName: OLD, picId: 'pic-rara', teamId: null },
            { id: 'tp3', templateId: 't-smg', picName: 'ERNA', picId: 'pic-erna', teamId: null },
        );
        const period = (id: string, over: Record<string, unknown> = {}) => tables.periods.rows.push({
            id, scope: HC, title: id, publishStatus: CsiPeriodPublishStatus.PUBLISHED, startDate: '2026-11-01', endDate: '2026-11-30', ...over,
        });
        period('p-draft', { publishStatus: CsiPeriodPublishStatus.DRAFT });
        period('p-soon', { startDate: '2026-12-01', endDate: '2026-12-31' });
        period('p-running');
        period('p-answered', { startDate: '2026-12-01', endDate: '2026-12-31' });
        period('p-ended', { startDate: '2026-10-01', endDate: '2026-10-31' });
        for (const periodId of ['p-draft', 'p-soon', 'p-running', 'p-answered', 'p-ended']) {
            tables.ratees.rows.push({ id: `r-${periodId}`, periodId, kind: 'PERSON', picId: 'pic-rara', displayName: OLD });
        }
        tables.ratees.rows.push({ id: 'r-other', periodId: 'p-draft', kind: 'PERSON', picId: 'pic-erna', displayName: 'ERNA' });
        tables.responses.rows.push({ id: 'resp', periodId: 'p-answered' });
        const repositories = new Map<unknown, unknown>([
            [CsiPic, tables.pics], [CsiAssignmentTemplate, tables.templates], [CsiAssignmentTemplatePic, tables.templatePics],
            [CsiPeriodRatee, tables.ratees], [CsiPeriod, tables.periods], [CsiResponse, tables.responses],
        ]);
        const manager = { getRepository: (target: unknown) => repositories.get(target) };
        transaction = jest.fn(async (work: any) => work(manager));
        service = new CsiPicRenameService({ manager, transaction } as any);
        service.clock = () => NOW;
    });

    const nameOf = (id: string) => tables.ratees.rows.find((row) => row.id === id)!.displayName;

    it('renames the master, its template rows (normalised) and the ratees of draft surveys only, in one transaction', async () => {
        const view = await service.rename(HC, 'pic-rara', '  Rara  Kurnia Pongdatu ');
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(view).toMatchObject({ id: 'pic-rara', fullName: 'Rara Kurnia Pongdatu' });
        expect(tables.pics.rows[0]).toMatchObject({ fullName: 'Rara Kurnia Pongdatu', aliases: [OLD] });
        expect(tables.templatePics.rows.map((row) => row.picName)).toEqual(['RARA KURNIA PONGDATU', 'RARA KURNIA PONGDATU', 'ERNA']);
        expect(nameOf('r-p-draft')).toBe('Rara Kurnia Pongdatu');
        expect(nameOf('r-p-soon')).toBe('Rara Kurnia Pongdatu');
        expect(nameOf('r-p-running')).toBe(OLD);
        expect(nameOf('r-p-answered')).toBe(OLD);
        expect(nameOf('r-p-ended')).toBe(OLD);
        expect(nameOf('r-other')).toBe('ERNA');
    });

    it('refuses a name another PIC of the same template already has, changing nothing', async () => {
        await expect(service.rename(HC, 'pic-rara', 'erna')).rejects.toThrow(new BadRequestException('Nama sudah dipakai PIC lain di template Semarang'));
        expect(tables.pics.rows[0].fullName).toBe(OLD);
        expect(tables.templatePics.rows[0].picName).toBe(OLD);
        expect(nameOf('r-p-draft')).toBe(OLD);
    });

    it('validates the length and the PIC (scope, existence)', async () => {
        await expect(service.rename(HC, 'pic-rara', ' R ')).rejects.toThrow('Nama PIC harus terdiri dari 2–150 karakter');
        await expect(service.rename(HC, 'pic-rara', 'x'.repeat(151))).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.rename(HC, 'missing', 'Rara')).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.rename(ServiceScope.ICT, 'pic-rara', 'Rara')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('renaming back drops the name from the aliases', async () => {
        await service.rename(HC, 'pic-rara', 'Rara K');
        await service.rename(HC, 'pic-rara', OLD);
        expect(tables.pics.rows[0]).toMatchObject({ fullName: OLD, aliases: ['RARA K'] });
    });
});

describe('nextAliases', () => {
    it('adds the old normalised name once and never keeps the current one', () => {
        expect(nextAliases(null, 'Rara. K', 'Rara Kurnia')).toEqual(['RARA K']);
        expect(nextAliases(['RARA K'], 'rara k', 'Rara Kurnia')).toEqual(['RARA K']);
        expect(nextAliases(['RARA KURNIA'], 'Rara', 'rara kurnia')).toEqual(['RARA']);
        expect(nextAliases([], 'Rara', 'RARA')).toEqual([]);
    });
});
