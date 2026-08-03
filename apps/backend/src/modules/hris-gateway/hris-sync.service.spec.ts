import * as bcrypt from 'bcrypt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Department } from '../users/entities/department.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Site } from '../sites/entities/site.entity';
import { HrisEmployee, HrisGatewayAdapter } from './hris-gateway.adapter';
import { HrisSyncService } from './hris-sync.service';
import { PermissionsService } from '../permissions/permissions.service';

const employee = (overrides: Partial<HrisEmployee> = {}): HrisEmployee => ({
    nik_hris: '00000024',
    nik_santos: '2130406',
    nama_karyawan: 'CHRISTHIN MAGDALENA',
    id_departemen: '2.0034',
    nama_departemen: 'PROCUREMENT',
    nama_jabatan: 'GENERAL MANAGER',
    email: 'christin@example.com',
    lokasi: 'SJA-1',
    tgl_keluar: null,
    ...overrides,
});

describe('HrisSyncService', () => {
    let service: HrisSyncService;
    let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
    let gateway: { getEmployeesPage: jest.Mock; isConfigured: jest.Mock };

    beforeEach(async () => {
        userRepo = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((entity) => entity),
            save: jest.fn(async (entity) => ({ id: 'user-1', ...entity })),
        };
        gateway = {
            getEmployeesPage: jest.fn(),
            isConfigured: jest.fn().mockReturnValue(true),
        };

        jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$12$test-default-password-hash' as never);

        const module = await Test.createTestingModule({
            providers: [
                HrisSyncService,
                { provide: HrisGatewayAdapter, useValue: gateway },
                { provide: getRepositoryToken(User), useValue: userRepo },
                {
                    provide: getRepositoryToken(Site),
                    useValue: { find: jest.fn().mockResolvedValue([{ id: 'spj-id', code: 'SPJ' }, { id: 'krw-id', code: 'KRW' }]) },
                },
                {
                    provide: getRepositoryToken(Department),
                    useValue: {
                        findOne: jest.fn().mockResolvedValue(null),
                        create: jest.fn((entity) => entity),
                        save: jest.fn(async (entity) => ({ id: 'department-1', ...entity })),
                    },
                },
                {
                    provide: PermissionsService,
                    useValue: {
                        resolveDefaultPresetId: jest.fn().mockResolvedValue('preset-user'),
                        getPresetById: jest.fn().mockResolvedValue({ id: 'preset-user', name: 'User' }),
                        applyPresetToUser: jest.fn().mockResolvedValue({ applied: true, presetName: 'User' }),
                    },
                },
            ],
        }).compile();
        service = module.get(HrisSyncService);
    });

    afterEach(() => jest.restoreAllMocks());

    it('provisions an HRIS user with NIK, mapped site, department, and bcrypt default password', async () => {
        await service.provisionEmployee(employee());

        expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            employeeId: '00000024',
            fullName: 'CHRISTHIN MAGDALENA',
            email: 'christin@example.com',
            siteId: 'spj-id',
            departmentId: 'department-1',
            role: UserRole.USER,
            appliedPresetId: 'preset-user',
            appliedPresetName: 'User',
            password: '$2b$12$test-default-password-hash',
        }));
    });

    it.each([
        ['SECURITY & NETWORK INFRASTURCTURE AREA - SEPANJANG', UserRole.AGENT_OPERATIONAL_SUPPORT],
        ['INFORMATION SYSTEM DEVELOPMENT', UserRole.AGENT_ORACLE],
    ])('maps %s to %s', async (nama_departemen, role) => {
        await service.provisionEmployee(employee({ nama_departemen }));
        expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ role }));
    });

    it('does not create a user when no active default preset exists', async () => {
        const permissionsService = (service as any).permissionsService;
        permissionsService.resolveDefaultPresetId.mockResolvedValue(null);

        await expect(service.provisionEmployee(employee())).rejects.toThrow('No active default permission preset for role USER');
        expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('uses NIK email fallback when HRIS email is blank or belongs to another user', async () => {
        await service.provisionEmployee(employee({ email: null }));
        expect(userRepo.save).toHaveBeenLastCalledWith(expect.objectContaining({ email: '00000024@hris.local' }));

        userRepo.findOne.mockImplementation(async ({ where }) => where.email ? { id: 'other-user' } : null);
        await service.provisionEmployee(employee());
        expect(userRepo.save).toHaveBeenLastCalledWith(expect.objectContaining({ email: '00000024@hris.local' }));
    });

    it('creates new, updates existing organization fields, and skips departed employees', async () => {
        const existing = {
            id: 'existing-user',
            employeeId: '00000043',
            fullName: 'OLD NAME',
            email: 'admin-overridden@example.com',
            password: 'admin-password-hash',
            role: UserRole.ADMIN,
            isActive: false,
            siteId: 'spj-id',
            departmentId: 'old-department',
        };
        userRepo.findOne.mockImplementation(async ({ where }) => where.employeeId === '00000043' ? existing : null);
        gateway.getEmployeesPage.mockResolvedValueOnce({
            total: 3,
            data: [
                employee(),
                employee({ nik_hris: '00000043', nama_karyawan: 'NEW NAME', lokasi: 'SJA-2' }),
                employee({ nik_hris: '00000099', tgl_keluar: '2025-01-01T00:00:00.000Z' }),
            ],
        });

        await expect(service.syncAll()).resolves.toMatchObject({ created: 1, updated: 1, skipped: 1, errors: [] });
        expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            id: 'existing-user',
            fullName: 'NEW NAME',
            siteId: 'krw-id',
            email: 'admin-overridden@example.com',
            password: 'admin-password-hash',
            role: UserRole.ADMIN,
            isActive: false,
        }));
    });

    it('returns a page error without throwing when Gateway page fetch fails', async () => {
        gateway.getEmployeesPage.mockResolvedValue(null);
        await expect(service.syncAll()).resolves.toEqual({
            created: 0,
            updated: 0,
            skipped: 0,
            errors: ['page 1: fetch failed'],
        });
    });
});

describe('HrisSyncService.disableDepartedEmployees', () => {
    let service: HrisSyncService;
    let userRepo: { createQueryBuilder: jest.Mock; update: jest.Mock };
    let gateway: { getEmployeesPage: jest.Mock };
    let permissionsService: { resolveDefaultPresetId: jest.Mock; applyPresetToUser: jest.Mock };
    let qb: { where: jest.Mock; andWhere: jest.Mock; getMany: jest.Mock };

    const activeUser = (overrides: Partial<User> = {}): User => ({
        id: 'user-1',
        employeeId: '00000024',
        role: UserRole.USER,
        appliedPresetId: 'preset-user',
        isActive: true,
        ...overrides,
    } as User);

    beforeEach(async () => {
        qb = {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        };
        userRepo = {
            createQueryBuilder: jest.fn(() => qb),
            update: jest.fn().mockResolvedValue(undefined),
        };
        gateway = { getEmployeesPage: jest.fn() };
        permissionsService = {
            resolveDefaultPresetId: jest.fn().mockResolvedValue(null),
            applyPresetToUser: jest.fn(),
        };

        const module = await Test.createTestingModule({
            providers: [
                HrisSyncService,
                { provide: HrisGatewayAdapter, useValue: gateway },
                { provide: getRepositoryToken(User), useValue: userRepo },
                { provide: getRepositoryToken(Site), useValue: { find: jest.fn().mockResolvedValue([]) } },
                { provide: getRepositoryToken(Department), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
                { provide: PermissionsService, useValue: permissionsService },
            ],
        }).compile();
        service = module.get(HrisSyncService);
    });

    it('disables (never deletes) a local user whose NIK is gone from the Gateway', async () => {
        gateway.getEmployeesPage.mockResolvedValueOnce({ total: 0, data: [] });
        qb.getMany.mockResolvedValue([activeUser()]);

        const summary = await service.disableDepartedEmployees();

        expect(userRepo.update).toHaveBeenCalledWith('user-1', { isActive: false });
        expect(summary).toEqual({ disabled: 1, errors: [] });
    });

    it('does not touch a user whose NIK is still present in the Gateway', async () => {
        gateway.getEmployeesPage.mockResolvedValueOnce({
            total: 1,
            data: [{ nik_hris: '00000024', tgl_keluar: null }],
        });
        qb.getMany.mockResolvedValue([activeUser()]);

        const summary = await service.disableDepartedEmployees();

        expect(userRepo.update).not.toHaveBeenCalled();
        expect(summary).toEqual({ disabled: 0, errors: [] });
    });

    it('treats tgl_keluar (resigned) as departed even if NIK still returned', async () => {
        gateway.getEmployeesPage.mockResolvedValueOnce({
            total: 1,
            data: [{ nik_hris: '00000024', tgl_keluar: '2025-01-01T00:00:00.000Z' }],
        });
        qb.getMany.mockResolvedValue([activeUser()]);

        const summary = await service.disableDepartedEmployees();

        expect(userRepo.update).toHaveBeenCalledWith('user-1', { isActive: false });
        expect(summary.disabled).toBe(1);
    });

    it('backfills appliedPresetId before disabling so preset is never left empty', async () => {
        gateway.getEmployeesPage.mockResolvedValueOnce({ total: 0, data: [] });
        qb.getMany.mockResolvedValue([activeUser({ appliedPresetId: null as any })]);
        permissionsService.resolveDefaultPresetId.mockResolvedValue('preset-user');

        await service.disableDepartedEmployees();

        expect(permissionsService.resolveDefaultPresetId).toHaveBeenCalledWith(UserRole.USER);
        expect(permissionsService.applyPresetToUser).toHaveBeenCalledWith('user-1', 'preset-user');
        expect(userRepo.update).toHaveBeenCalledWith('user-1', { isActive: false });
    });

    it('reports Gateway fetch failure without disabling anyone', async () => {
        gateway.getEmployeesPage.mockResolvedValue(null);

        const summary = await service.disableDepartedEmployees();

        expect(summary).toEqual({ disabled: 0, errors: ['page 1: fetch failed'] });
        expect(userRepo.update).not.toHaveBeenCalled();
    });
});
