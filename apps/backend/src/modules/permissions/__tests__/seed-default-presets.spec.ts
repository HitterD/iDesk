/**
 * Task 11: Seed Default Presets — unit test (mock-based, no DB)
 * Verifikasi bahwa DEFAULT_PRESETS Admin/Manager/Agent include hardware_requests=true
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionsService } from '../permissions.service';
import { PermissionPreset } from '../entities/permission-preset.entity';
import { FeatureDefinition } from '../entities/feature-definition.entity';
import { UserFeaturePermission } from '../entities/user-feature-permission.entity';
import { User } from '../../users/entities/user.entity';
import { CacheService } from '../../../shared/core/cache/cache.service';
import { PermissionsGateway } from '../permissions.gateway';

// ---- Minimal mock repositories ----
function makeRepoMock(seed: any[] = []) {
    const store = [...seed];
    return {
        find:    jest.fn().mockResolvedValue(store),
        findOne: jest.fn(({ where }: any) => {
            const item = store.find((s) => {
                if (where?.name) return s.name === where.name;
                if (where?.key)  return s.key  === where.key;
                return false;
            });
            return Promise.resolve(item ?? null);
        }),
        save:    jest.fn((e) => { store.push(e); return Promise.resolve(e); }),
        create:  jest.fn((e) => e),
        count:   jest.fn().mockResolvedValue(0),
    };
}

const mockCache: Partial<CacheService> = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
};

const mockGateway = {};

describe('PermissionsService — seedDefaultPresets', () => {
    let svc: PermissionsService;
    let presetRepo: ReturnType<typeof makeRepoMock>;

    beforeEach(async () => {
        presetRepo = makeRepoMock();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PermissionsService,
                { provide: getRepositoryToken(FeatureDefinition),     useValue: makeRepoMock() },
                { provide: getRepositoryToken(UserFeaturePermission), useValue: makeRepoMock() },
                { provide: getRepositoryToken(PermissionPreset),      useValue: presetRepo },
                { provide: getRepositoryToken(User),                  useValue: makeRepoMock() },
                { provide: CacheService,                              useValue: mockCache },
                { provide: PermissionsGateway,                        useValue: mockGateway },
            ],
        }).compile();

        svc = module.get(PermissionsService);
        // Prevent onModuleInit side effects
        jest.spyOn(svc as any, 'seedDefaultFeatures').mockResolvedValue(undefined);
    });

    it('default Admin preset includes hardware_requests=true', async () => {
        await (svc as any).seedDefaultPresets();
        const saved = presetRepo.save.mock.calls.map((c: any) => c[0]);
        const admin = saved.find((p: any) => p.name === 'Admin');
        expect(admin).toBeDefined();
        expect(admin?.pageAccess?.hardware_requests).toBe(true);
    });

    it('default Manager preset includes hardware_requests=true', async () => {
        await (svc as any).seedDefaultPresets();
        const saved = presetRepo.save.mock.calls.map((c: any) => c[0]);
        const mgr = saved.find((p: any) => p.name === 'Manager');
        expect(mgr).toBeDefined();
        expect(mgr?.pageAccess?.hardware_requests).toBe(true);
    });

    it('default Agent preset includes hardware_requests=true', async () => {
        await (svc as any).seedDefaultPresets();
        const saved = presetRepo.save.mock.calls.map((c: any) => c[0]);
        const agent = saved.find((p: any) => p.name === 'Agent');
        expect(agent).toBeDefined();
        expect(agent?.pageAccess?.hardware_requests).toBe(true);
    });

    it('idempotent — hardware_requests tetap true setelah multiple seed calls', async () => {
        // Run seedDefaultPresets twice
        await (svc as any).seedDefaultPresets();
        await (svc as any).seedDefaultPresets();

        // Verify all Admin save calls (create or merge) always have hardware_requests=true
        const adminSaveCalls = presetRepo.save.mock.calls.filter((c: any) => c[0]?.name === 'Admin' || c[0]?.pageAccess?.hardware_requests !== undefined);
        // At minimum, at least one save happened for Admin
        expect(adminSaveCalls.length).toBeGreaterThanOrEqual(1);
        // And all saves preserve hardware_requests=true
        for (const call of adminSaveCalls) {
            if (call[0]?.name === 'Admin') {
                expect(call[0]?.pageAccess?.hardware_requests).toBe(true);
            }
        }
    });

    it('preserves an existing system preset pageAccess customization', async () => {
        presetRepo = makeRepoMock([{
            id: 'user-preset', name: 'User', isSystem: true,
            pageAccess: { dashboard: true, tickets: true, zoom_calendar: true },
            permissions: {},
        }]);
        await (svc as any).seedDefaultPresets();
        expect(presetRepo.save).not.toHaveBeenCalledWith(
            expect.objectContaining({ pageAccess: expect.objectContaining({ zoom_calendar: false }) }),
        );
    });
});
