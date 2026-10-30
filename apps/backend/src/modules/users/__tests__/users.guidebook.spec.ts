import { NotFoundException } from '@nestjs/common';
import { UsersController } from '../users.controller';
import { UserCrudService } from '../user-crud.service';
import { toValidatedUser } from '../../auth/application/auth-user.mapper';
import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';

describe('Users Guidebook Acknowledgment', () => {
    describe('UsersController.acknowledgeGuidebook', () => {
        it('calls usersService.acknowledgeGuidebook with user id from request', async () => {
            const now = new Date();
            const usersService = {
                acknowledgeGuidebook: jest.fn().mockResolvedValue({ success: true, acknowledgedAt: now }),
            };
            const controller = new UsersController(usersService as never, {} as never);

            const result = await controller.acknowledgeGuidebook({ user: { userId: 'user-uuid-123' } });

            expect(usersService.acknowledgeGuidebook).toHaveBeenCalledWith('user-uuid-123');
            expect(result).toEqual({ success: true, acknowledgedAt: now });
        });
    });

    describe('UserCrudService.acknowledgeGuidebook', () => {
        it('updates guidebookAcknowledgedAt and saves user', async () => {
            const mockUser = {
                id: 'user-uuid-123',
                fullName: 'Bagas Pratama',
                role: UserRole.USER,
                guidebookAcknowledgedAt: null,
            };
            const userRepo = {
                findOne: jest.fn().mockResolvedValue(mockUser),
                save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
            };

            const service = new UserCrudService(
                userRepo as any,
                {} as any,
                {} as any,
                {} as any,
                {} as any,
                {} as any,
                {} as any,
            );

            const result = await service.acknowledgeGuidebook('user-uuid-123');

            expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-uuid-123' } });
            expect(userRepo.save).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.acknowledgedAt).toBeInstanceOf(Date);
            expect(mockUser.guidebookAcknowledgedAt).toBeInstanceOf(Date);
        });

        it('throws NotFoundException when user does not exist', async () => {
            const userRepo = {
                findOne: jest.fn().mockResolvedValue(null),
                save: jest.fn(),
            };

            const service = new UserCrudService(
                userRepo as any,
                {} as any,
                {} as any,
                {} as any,
                {} as any,
                {} as any,
                {} as any,
            );

            await expect(service.acknowledgeGuidebook('unknown-id')).rejects.toThrow(NotFoundException);
            expect(userRepo.save).not.toHaveBeenCalled();
        });
    });

    describe('toValidatedUser mapper', () => {
        it('serializes guidebookAcknowledgedAt to ISO string when present', () => {
            const acknowledgedDate = new Date('2026-09-24T10:00:00.000Z');
            const user = {
                id: 'u-1',
                email: 'user@example.com',
                fullName: 'Test User',
                role: UserRole.USER,
                isActive: true,
                mustChangePassword: false,
                guidebookAcknowledgedAt: acknowledgedDate,
            } as User;

            const validated = toValidatedUser(user);

            expect(validated.guidebookAcknowledgedAt).toBe('2026-09-24T10:00:00.000Z');
        });

        it('returns null for guidebookAcknowledgedAt when absent or null', () => {
            const user = {
                id: 'u-2',
                email: 'user2@example.com',
                fullName: 'Test User 2',
                role: UserRole.USER,
                isActive: true,
                mustChangePassword: false,
                guidebookAcknowledgedAt: null,
            } as User;

            const validated = toValidatedUser(user);

            expect(validated.guidebookAcknowledgedAt).toBeNull();
        });
    });
});
