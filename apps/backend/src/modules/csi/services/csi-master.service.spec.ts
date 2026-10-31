import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiMasterService } from './csi-master.service';
import { assertPeriodInScope } from './csi-scope.util';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiQuestionType } from '../csi.constants';

const scope = ServiceScope.ICT;
function repository() {
    return {
        find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((value) => value), save: jest.fn(async (value) => value),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        maximum: jest.fn().mockResolvedValue(null),
    };
}

describe('CSI master scope boundaries', () => {
    let dimensions: ReturnType<typeof repository>;
    let departments: ReturnType<typeof repository>;
    let raters: ReturnType<typeof repository>;
    let users: ReturnType<typeof repository>;
    let service: CsiMasterService;
    beforeEach(() => {
        dimensions = repository(); departments = repository(); raters = repository(); users = repository();
        service = new CsiMasterService(dimensions as any, departments as any, raters as any, users as any);
    });

    it('updateDimension rejects dimension of other scope (404)', async () => {
        await expect(service.updateDimension(scope, 'hc-dimension', { name: 'Baru' })).rejects.toBeInstanceOf(NotFoundException);
        expect(dimensions.findOne).toHaveBeenCalledWith({ where: { id: 'hc-dimension', scope } });
        expect(dimensions.save).not.toHaveBeenCalled();
    });

    it('createDepartment rejects duplicate name case-insensitive (409)', async () => {
        departments.findOne.mockResolvedValue({ id: 'existing', name: 'Finance', scope });
        await expect(service.createDepartment(scope, { name: 'FINANCE' })).rejects.toBeInstanceOf(ConflictException);
        expect(departments.findOne.mock.calls[0][0].where.scope).toBe(scope);
        expect(departments.save).not.toHaveBeenCalled();
    });

    it('addRaters ignores already-registered users and returns full list', async () => {
        users.find.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
        const existing = { id: 'r1', userId: 'u1', scope };
        const full = [existing, { id: 'r2', userId: 'u2', scope }];
        raters.find.mockResolvedValueOnce([existing]).mockResolvedValueOnce(full);
        expect(await service.addRaters(scope, ['u1', 'u2', 'u2'])).toEqual(full);
        expect(raters.save).toHaveBeenCalledWith([{ scope, userId: 'u2' }]);
    });

    it('lists active dimensions and departments in stable display order by default', async () => {
        await service.listDimensions(scope);
        await service.listDepartments(scope, true);
        expect(dimensions.find).toHaveBeenCalledWith({ where: { scope, isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } });
        expect(departments.find).toHaveBeenCalledWith({ where: { scope }, order: { sortOrder: 'ASC', name: 'ASC' } });
    });

    it('creates a dimension in the supplied scope and soft-deactivates without mutation', async () => {
        expect(await service.createDimension(scope, { name: 'Layanan', description: 'Baik', type: CsiQuestionType.STAR }))
            .toEqual({ scope, name: 'Layanan', description: 'Baik', shortLabel: null, type: CsiQuestionType.STAR, required: true, options: [], sortOrder: 0 });
        const row = { id: 'd1', scope, name: 'Layanan', isActive: true };
        dimensions.findOne.mockResolvedValue(row);
        expect(await service.deactivateDimension(scope, 'd1')).toEqual({ ...row, isActive: false });
        expect(row.isActive).toBe(true);
    });

    it('updates and deactivates departments only within scope', async () => {
        await expect(service.updateDepartment(scope, 'hc-department', { name: 'Baru' })).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.deactivateDepartment(scope, 'hc-department')).rejects.toBeInstanceOf(NotFoundException);
        expect(departments.findOne).toHaveBeenCalledWith({ where: { id: 'hc-department', scope } });
        const row = { id: 'd1', scope, name: 'Finance', isActive: true };
        departments.findOne.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
        expect(await service.updateDepartment(scope, 'd1', { name: 'FINANCE' })).toEqual({ ...row, name: 'FINANCE' });
        departments.findOne.mockResolvedValueOnce(row);
        expect(await service.deactivateDepartment(scope, 'd1')).toEqual({ ...row, isActive: false });
    });

    it('rejects rename to another department and translates unique violations only', async () => {
        departments.findOne.mockResolvedValueOnce({ id: 'd1', scope }).mockResolvedValueOnce({ id: 'd2', scope });
        await expect(service.updateDepartment(scope, 'd1', { name: 'Finance' })).rejects.toBeInstanceOf(ConflictException);
        departments.findOne.mockResolvedValue(null);
        departments.save.mockRejectedValueOnce({ code: '23505' });
        await expect(service.createDepartment(scope, { name: 'Finance' })).rejects.toBeInstanceOf(ConflictException);
        const failure = new Error('database unavailable');
        departments.save.mockRejectedValueOnce(failure);
        await expect(service.createDepartment(scope, { name: 'Finance' })).rejects.toBe(failure);
    });

    it('translates unique violations on department update and preserves scope', async () => {
        departments.findOne.mockResolvedValueOnce({ id: 'd1', scope, name: 'Old' }).mockResolvedValueOnce(null);
        departments.save.mockRejectedValueOnce({ code: '23505' });
        await expect(service.updateDepartment(scope, 'd1', { name: 'New' })).rejects.toBeInstanceOf(ConflictException);
        expect(departments.save).toHaveBeenCalledWith({ id: 'd1', scope, name: 'New' });
    });

    it('lists only raters from the scope with safe user and site fields', async () => {
        await service.listRaters(scope);
        expect(raters.find).toHaveBeenCalledWith({
            where: { scope }, relations: { user: { site: true } },
            select: { id: true, scope: true, userId: true, createdAt: true, updatedAt: true,
                user: { id: true, fullName: true, email: true, jobTitle: true, site: { name: true, code: true } } },
            order: { user: { fullName: 'ASC' } },
        });
    });

    it('accepts an empty rater selection and avoids writes for registered users', async () => {
        await service.addRaters(scope, []);
        expect(users.find).not.toHaveBeenCalled();
        users.find.mockResolvedValue([{ id: 'u1' }]);
        raters.find.mockResolvedValue([{ id: 'r1', scope, userId: 'u1' }]);
        await service.addRaters(scope, ['u1']);
        expect(raters.save).not.toHaveBeenCalled();
    });

    it('rejects unknown or inactive raters without exposing identifiers', async () => {
        users.find.mockResolvedValue([{ id: 'u1' }]);
        await expect(service.addRaters(scope, ['u1', 'secret-id'])).rejects.toThrow('Pengguna tidak ditemukan atau tidak aktif');
        expect(users.find.mock.calls[0][0].where.isActive).toBe(true);
        expect(raters.save).not.toHaveBeenCalled();
    });

    it('removes only a rater in the requested scope', async () => {
        await expect(service.removeRater(scope, 'hc-rater')).rejects.toBeInstanceOf(NotFoundException);
        expect(raters.delete).not.toHaveBeenCalled();
        raters.findOne.mockResolvedValue({ id: 'r1', scope });
        await service.removeRater(scope, 'r1');
        expect(raters.delete).toHaveBeenCalledWith({ id: 'r1', scope });
    });

    it('searches active users with parameterized alternatives, safe projection and capped limits', async () => {
        await service.searchUsers("O'Brien", 100);
        const query = users.find.mock.calls[0][0];
        expect(query.take).toBe(50);
        expect(query.where).toHaveLength(3);
        expect(query.where.every((condition: any) => condition.isActive === true)).toBe(true);
        expect(query.where[0].fullName.value).toBe("%O'Brien%");
        expect(query.select).toEqual({ id: true, fullName: true, email: true, jobTitle: true, siteId: true, site: { code: true, name: true } });
        await service.searchUsers('');
        expect(users.find.mock.calls[1][0]).toMatchObject({ where: { isActive: true }, take: 20, order: { fullName: 'ASC' } });
    });

    it('assertPeriodInScope rejects period of other scope or missing period', () => {
        expect(() => assertPeriodInScope({ scope: ServiceScope.HC } as CsiPeriod, scope)).toThrow('Periode tidak ditemukan');
        expect(() => assertPeriodInScope(null, scope)).toThrow(NotFoundException);
        const period = { scope } as CsiPeriod;
        expect(assertPeriodInScope(period, scope)).toBe(period);
    });

    it('create appends sortOrder at the end', async () => {
        dimensions.maximum.mockResolvedValue(4);
        departments.maximum.mockResolvedValue(7);
        expect(await service.createDimension(scope, { name: 'Baru', type: CsiQuestionType.TEXT, required: false }))
            .toMatchObject({ scope, sortOrder: 5, required: false, options: [] });
        expect(dimensions.maximum).toHaveBeenCalledWith('sortOrder', { scope });
        expect(await service.createDepartment(scope, { name: 'Gudang' })).toMatchObject({ scope, name: 'Gudang', sortOrder: 8 });
        expect(departments.maximum).toHaveBeenCalledWith('sortOrder', { scope });
    });

    it('reorder rejects incomplete id set (400)', async () => {
        dimensions.find.mockResolvedValue([{ id: 'a', scope, sortOrder: 0 }, { id: 'b', scope, sortOrder: 1 }]);
        for (const ids of [['a'], ['a', 'b', 'c'], ['a', 'a'], ['a', 'x']]) {
            await expect(service.reorderDimensions(scope, ids)).rejects.toThrow(new BadRequestException('Urutan tidak lengkap'));
        }
        expect(dimensions.find).toHaveBeenCalledWith({ where: { scope } });
        departments.find.mockResolvedValue([{ id: 'a', scope, sortOrder: 0 }]);
        await expect(service.reorderDepartments(scope, [])).rejects.toThrow(new BadRequestException('Urutan tidak lengkap'));
        expect(dimensions.save).not.toHaveBeenCalled();
        expect(departments.save).not.toHaveBeenCalled();
    });

    it('reorder assigns index order', async () => {
        const rows = [{ id: 'a', scope, sortOrder: 0 }, { id: 'b', scope, sortOrder: 1 }, { id: 'c', scope, sortOrder: 2 }];
        dimensions.find.mockResolvedValue(rows);
        expect(await service.reorderDimensions(scope, ['c', 'a', 'b'])).toEqual([
            { id: 'c', scope, sortOrder: 0 }, { id: 'a', scope, sortOrder: 1 }, { id: 'b', scope, sortOrder: 2 },
        ]);
        expect(rows[0].sortOrder).toBe(0);
        departments.find.mockResolvedValue([{ id: 'x', scope, sortOrder: 5 }, { id: 'y', scope, sortOrder: 9 }]);
        expect(await service.reorderDepartments(scope, ['y', 'x'])).toEqual([{ id: 'y', scope, sortOrder: 0 }, { id: 'x', scope, sortOrder: 1 }]);
    });

    it('rejects invalid options for the question type on create and update (400)', async () => {
        const invalid = new BadRequestException('Pilihan tidak valid untuk jenis pertanyaan ini');
        await expect(service.createDimension(scope, { name: 'X', type: CsiQuestionType.SCALE, options: [{ label: 'A', points: 1 }] })).rejects.toThrow(invalid);
        await expect(service.createDimension(scope, { name: 'X', type: CsiQuestionType.STAR, options: [{ label: 'A', points: null }] })).rejects.toThrow(invalid);
        dimensions.findOne.mockResolvedValue({ id: 'd1', scope, name: 'Lama', type: CsiQuestionType.CHOICE, options: [{ label: 'A', points: null }, { label: 'B', points: null }] });
        // Switching type without new options re-validates the stored options against the new type.
        await expect(service.updateDimension(scope, 'd1', { type: CsiQuestionType.SCALE })).rejects.toThrow(invalid);
        expect(await service.updateDimension(scope, 'd1', { type: CsiQuestionType.TEXT, options: [] })).toMatchObject({ type: CsiQuestionType.TEXT, options: [] });
        expect(dimensions.save).toHaveBeenCalledTimes(1);
    });

    it('template creates 9 questions in order with E-Services replaced by iDesk', async () => {
        dimensions.maximum.mockResolvedValue(2);
        const created = await service.createTemplateDimensions(scope);
        expect(created).toHaveLength(9);
        expect(created.map((row: any) => row.sortOrder)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(created.every((row: any) => row.scope === scope && row.required === true)).toBe(true);
        expect(created.map((row: any) => row.type)).toEqual([
            CsiQuestionType.CHOICE, CsiQuestionType.SCALE, CsiQuestionType.SCALE, CsiQuestionType.SCALE, CsiQuestionType.SCALE,
            CsiQuestionType.SCALE, CsiQuestionType.STAR, CsiQuestionType.SCALE, CsiQuestionType.STAR,
        ]);
        const prefix = 'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini ';
        expect(created.map((row: any) => row.name)).toEqual([
            'Dalam 1 tahun terakhir, berapa kali Bapak/Ibu meminta bantuan IT Support melalui platform iDesk / Whatsapp / Telepon?',
            `${prefix}[Kecepatan respon IT Support terhadap laporan dari pengguna]`,
            `${prefix}[IT Support bersikap ramah dan mampu menerima penjelasan terhadap masalah yang dihadapi dengan baik]`,
            `${prefix}[Kemampuan diagnosa IT Support terhadap permasalahan yang dilaporkan]`,
            `${prefix}[Kemampuan IT Support dalam memberikan solusi atau menyelesaikan permasalahan]`,
            `${prefix}[Kecepatan IT Support dalam memberikan solusi atau menangani permasalahan sesuai target yang disepakati]`,
            'Bagaimana Anda menilai kemampuan komunikasi IT Support?',
            'Jika anda meminta penjelasan terhadap masalah yang dihadapi. Bagaimana penilaian anda terhadap penjelasan yang diberikan tim IT Support kepada anda?',
            'Bagaimana penilaian anda terhadap kualitas pelayanan tim IT Support secara keseluruhan?',
        ]);
        expect(created.some((row: any) => row.name.includes('E-Services'))).toBe(false);
        expect(created[0].options).toEqual([{ label: '< 5 kali', points: null }, { label: '5 - 10 kali', points: null }, { label: '> 10 kali', points: null }]);
        expect(created[1].options).toEqual([
            { label: 'Sangat puas', points: 5 }, { label: 'Puas', points: 4 }, { label: 'Netral', points: 3 },
            { label: 'Tidak puas', points: 2 }, { label: 'Sangat tidak puas', points: 1 },
        ]);
        expect(created[7].options).toEqual([
            { label: 'Sangat baik', points: 5 }, { label: 'Baik', points: 4 }, { label: 'Cukup', points: 3 },
            { label: 'Buruk', points: 2 }, { label: 'Sangat buruk', points: 1 },
        ]);
        expect(created[6].options).toEqual([]);
        expect(dimensions.save).toHaveBeenCalledTimes(1);
    });

    it('stores shortLabel on create and update, blank clears it', async () => {
        expect(await service.createDimension(scope, { name: 'Kecepatan respon tim', type: CsiQuestionType.STAR, shortLabel: 'Kecepatan' }))
            .toMatchObject({ shortLabel: 'Kecepatan' });
        expect(await service.createDimension(scope, { name: 'Tanpa label', type: CsiQuestionType.STAR })).toMatchObject({ shortLabel: null });
        dimensions.findOne.mockResolvedValue({ id: 'd1', scope, name: 'Q', shortLabel: 'Lama', type: CsiQuestionType.STAR, options: [] });
        expect(await service.updateDimension(scope, 'd1', { shortLabel: 'Baru' })).toMatchObject({ shortLabel: 'Baru' });
        expect(await service.updateDimension(scope, 'd1', { shortLabel: '' })).toMatchObject({ shortLabel: null });
    });
});
