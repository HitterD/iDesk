import { UserCrudService } from '../user-crud.service';
import { UserRole } from '../enums/user-role.enum';

describe('UserCrudService Provisioning & Backfill', () => {
    let service: UserCrudService;
    let userRepo: any;
    let permissionsService: any;

    beforeEach(() => {
        userRepo = {
            create: jest.fn((dto) => dto),
            save: jest.fn(async (user) => ({ id: 'u1', ...user })),
            findOne: jest.fn(async () => null),
            query: jest.fn(async () => []),
        };
        permissionsService = {
            resolveDefaultPresetId: jest.fn(async (role: UserRole) => `preset-id-${role}`),
            applyPresetToUser: jest.fn(async (_userId: string, presetId: string) => ({ applied: true, presetName: presetId })),
        };

        service = new UserCrudService(
            userRepo,
            {} as any,
            {} as any,
            {} as any,
            { send: jest.fn() } as any,
            { logAsync: jest.fn() } as any,
            permissionsService,
        );
    });

    it('auto-assigns resolved default preset during createUser when presetId is missing', async () => {
        const user = await service.createUser({
            email: 'test@example.com',
            fullName: 'Test User',
            role: UserRole.USER,
        } as any);

        expect(permissionsService.resolveDefaultPresetId).toHaveBeenCalledWith(UserRole.USER);
        expect(user.appliedPresetId).toBe('preset-id-USER');
    });

    it('runs backfill query onModuleInit', async () => {
        await service.onModuleInit();
        expect(userRepo.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE "users" AS user_record'),
        );
        expect(userRepo.query).toHaveBeenCalledWith(
            expect.stringContaining('"appliedPresetName" = preset.name'),
        );
    });
});
