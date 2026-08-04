import { UserPasswordService } from './user-password.service';

describe('UserPasswordService', () => {
    let service: UserPasswordService;

    beforeEach(() => {
        service = new UserPasswordService(
            {} as any, // userRepo
            { logAsync: jest.fn() } as any, // auditService
        );
    });

    describe('resetPassword', () => {
        it('menandai mustChangePassword true', async () => {
            const update = jest.fn(async () => ({}));
            (service as any).userRepo.findOne = jest.fn(async () => ({ id: 'u1', fullName: 'A', role: 'USER' }));
            (service as any).userRepo.update = update;

            await service.resetPassword('u1', 'Temp-pass-123', 'admin', 'ADMIN');

            expect(update).toHaveBeenCalledWith('u1', expect.objectContaining({ mustChangePassword: true }));
        });
    });
});
