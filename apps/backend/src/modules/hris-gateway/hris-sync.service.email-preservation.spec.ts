import * as bcrypt from 'bcrypt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Department } from '../users/entities/department.entity';
import { User } from '../users/entities/user.entity';
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
    email: 'hris-address@example.com',
    lokasi: 'SJA-1',
    tgl_keluar: null,
    ...overrides,
});

/**
 * A user may change their own email (PATCH /users/me/email). The nightly HRIS
 * sync must never write that column back for an existing user, or it would
 * silently revert the change overnight. These tests pin that behaviour.
 */
describe('HrisSyncService — email preservation on sync', () => {
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
                    useValue: { find: jest.fn().mockResolvedValue([{ id: 'spj-id', code: 'SPJ' }]) },
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

    const syncOnePage = async (rows: HrisEmployee[]) => {
        gateway.getEmployeesPage.mockResolvedValueOnce({ data: rows, total: rows.length });
        return service.syncAll();
    };

    it('tidak menimpa email user yang sudah ada meski HRIS mengirim alamat berbeda', async () => {
        userRepo.findOne.mockResolvedValue({
            id: 'user-1',
            employeeId: '00000024',
            email: 'chosen-by-user@gmail.com',
            emailOverriddenAt: new Date('2026-08-01'),
            emailOverriddenBy: 'user-1',
            fullName: 'CHRISTHIN MAGDALENA',
            role: 'USER',
            appliedPresetId: 'preset-user',
        });

        const summary = await syncOnePage([employee()]);

        expect(summary.updated).toBe(1);
        const saved = userRepo.save.mock.calls[0][0];
        expect(saved.email).toBe('chosen-by-user@gmail.com');
    });

    it('tetap memperbarui nama, jabatan, site, dan departemen', async () => {
        userRepo.findOne.mockResolvedValue({
            id: 'user-1',
            employeeId: '00000024',
            email: 'chosen-by-user@gmail.com',
            emailOverriddenAt: new Date('2026-08-01'),
            fullName: 'NAMA LAMA',
            jobTitle: 'JABATAN LAMA',
            role: 'USER',
            appliedPresetId: 'preset-user',
        });

        await syncOnePage([employee()]);

        expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            fullName: 'CHRISTHIN MAGDALENA',
            jobTitle: 'GENERAL MANAGER',
            siteId: 'spj-id',
            departmentId: 'department-1',
        }));
    });

    it('tidak menimpa email bahkan untuk user yang belum pernah menggantinya', async () => {
        userRepo.findOne.mockResolvedValue({
            id: 'user-1',
            employeeId: '00000024',
            email: '00000024@hris.local',
            emailOverriddenAt: null,
            fullName: 'CHRISTHIN MAGDALENA',
            role: 'USER',
            appliedPresetId: 'preset-user',
        });

        await syncOnePage([employee()]);

        const saved = userRepo.save.mock.calls[0][0];
        expect(saved.email).toBe('00000024@hris.local');
    });
});
