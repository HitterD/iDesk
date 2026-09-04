import * as ExcelJS from 'exceljs';
import { UserImportService } from './user-import.service';

/**
 * Once a user changes their own email, matching import rows on email alone finds
 * nobody and inserts a duplicate account. Employee ID is the stable key, so it is
 * consulted first. These tests pin that, plus the rule that a bulk import never
 * overwrites an address a human deliberately set.
 */
describe('UserImportService — matching by employee ID', () => {
    let service: UserImportService;
    let userRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };

    const buildXlsx = async (rows: Record<string, string>[]): Promise<Express.Multer.File> => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Users');
        const headers = ['email', 'fullName', 'role', 'employeeId'];
        sheet.addRow(headers);
        rows.forEach((row) => sheet.addRow(headers.map((h) => row[h] ?? '')));
        const buffer = await workbook.xlsx.writeBuffer();
        return {
            originalname: 'users.xlsx',
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: Buffer.from(buffer),
        } as Express.Multer.File;
    };

    beforeEach(() => {
        userRepo = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((entity) => entity),
            save: jest.fn(async (entity) => ({ id: 'new-user', ...entity })),
            update: jest.fn().mockResolvedValue({}),
        };
        service = new UserImportService(
            userRepo as any,
            { find: jest.fn().mockResolvedValue([]) } as any, // siteRepo
            { find: jest.fn().mockResolvedValue([]) } as any, // departmentRepo
            { send: jest.fn().mockResolvedValue({ success: true }) } as any, // mailDispatch
        );
    });

    it('mencocokkan user lewat employeeId meski email di CSV sudah usang', async () => {
        userRepo.find.mockResolvedValue([{
            id: 'u1',
            email: 'chosen-by-user@gmail.com',
            employeeId: '00003713',
            emailOverriddenAt: new Date('2026-08-01'),
        }]);

        const file = await buildXlsx([{
            email: 'old-hris@example.com',
            fullName: 'AANG KRISTIANTO',
            role: 'USER',
            employeeId: '00003713',
        }]);

        const result = await service.importUsers(file, true);

        expect(userRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({ fullName: 'AANG KRISTIANTO' }));
        expect(userRepo.save).not.toHaveBeenCalled(); // tidak membuat user duplikat
        expect(result.updated).toBe(1);
    });

    it('tidak pernah menulis kolom email saat upsert', async () => {
        userRepo.find.mockResolvedValue([{
            id: 'u1',
            email: 'chosen-by-user@gmail.com',
            employeeId: '00003713',
            emailOverriddenAt: new Date('2026-08-01'),
        }]);

        const file = await buildXlsx([{
            email: 'old-hris@example.com',
            fullName: 'AANG KRISTIANTO',
            role: 'USER',
            employeeId: '00003713',
        }]);

        await service.importUsers(file, true);

        expect(userRepo.update).toHaveBeenCalledWith('u1', expect.not.objectContaining({ email: expect.anything() }));
    });

    it('melaporkan bahwa email dipertahankan, bukan menggagalkan barisnya', async () => {
        userRepo.find.mockResolvedValue([{
            id: 'u1',
            email: 'chosen-by-user@gmail.com',
            employeeId: '00003713',
            emailOverriddenAt: new Date('2026-08-01'),
        }]);

        const file = await buildXlsx([{
            email: 'old-hris@example.com',
            fullName: 'AANG KRISTIANTO',
            role: 'USER',
            employeeId: '00003713',
        }]);

        const result = await service.importUsers(file, true);

        expect(result.failed).toBe(0);
        expect(result.errors.join(' ')).toContain('kept as-is');
    });

    it('tetap membuat user baru saat employeeId maupun email tidak dikenal', async () => {
        const file = await buildXlsx([{
            email: 'baru@example.com',
            fullName: 'ORANG BARU',
            role: 'USER',
            employeeId: '99999999',
        }]);

        const result = await service.importUsers(file, true);

        expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'baru@example.com' }));
        expect(result.success).toBe(1);
    });

    it('jatuh ke pencocokan email saat baris tidak punya employeeId', async () => {
        userRepo.find.mockResolvedValue([{
            id: 'u1',
            email: 'ada@example.com',
            employeeId: null,
            emailOverriddenAt: null,
        }]);

        const file = await buildXlsx([{
            email: 'ada@example.com',
            fullName: 'NAMA BARU',
            role: 'USER',
            employeeId: '',
        }]);

        const result = await service.importUsers(file, true);

        expect(userRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({ fullName: 'NAMA BARU' }));
        expect(result.updated).toBe(1);
    });
});
