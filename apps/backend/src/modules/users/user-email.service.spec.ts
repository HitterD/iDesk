import * as bcrypt from 'bcrypt';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserEmailService } from './user-email.service';

describe('UserEmailService', () => {
    let service: UserEmailService;
    let userRepo: { findOne: jest.Mock; update: jest.Mock };
    let auditService: { logAsync: jest.Mock };

    const currentUser = {
        id: 'u1',
        email: 'old@example.com',
        fullName: 'BUDI',
        password: '$2b$12$hash',
    };

    beforeEach(() => {
        userRepo = {
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
        };
        auditService = { logAsync: jest.fn() };
        service = new UserEmailService(userRepo as any, auditService as any);
    });

    afterEach(() => jest.restoreAllMocks());

    it('menolak jika password saat ini salah', async () => {
        userRepo.findOne.mockResolvedValueOnce(currentUser);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

        await expect(
            service.changeOwnEmail('u1', 'new@example.com', 'wrong-password'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('menolak dengan 409 jika email sudah dipakai user lain', async () => {
        userRepo.findOne
            .mockResolvedValueOnce(currentUser)
            .mockResolvedValueOnce({ id: 'u2', email: 'new@example.com' });
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

        await expect(
            service.changeOwnEmail('u1', 'new@example.com', 'correct-password'),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('menyimpan email baru dan menandai emailOverriddenAt', async () => {
        userRepo.findOne
            .mockResolvedValueOnce(currentUser)
            .mockResolvedValueOnce(null) // tidak ada duplikat
            .mockResolvedValueOnce({ ...currentUser, email: 'new@example.com' });
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

        const result = await service.changeOwnEmail('u1', 'New@Example.com ', 'correct-password');

        expect(userRepo.update).toHaveBeenCalledWith(
            'u1',
            expect.objectContaining({
                email: 'new@example.com',
                emailOverriddenBy: 'u1',
                emailOverriddenAt: expect.any(Date),
            }),
        );
        expect(result.email).toBe('new@example.com');
    });

    it('memasking alamat email di audit log', async () => {
        userRepo.findOne
            .mockResolvedValueOnce(currentUser)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ ...currentUser, email: 'new@example.com' });
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

        await service.changeOwnEmail('u1', 'new@example.com', 'correct-password');

        const logged = auditService.logAsync.mock.calls[0][0];
        expect(logged.newValue.email).toBe('n***@e***');
        expect(logged.oldValue.email).toBe('o***@e***');
    });

    it('menolak jika email baru sama dengan email sekarang', async () => {
        userRepo.findOne.mockResolvedValueOnce(currentUser);

        await expect(
            service.changeOwnEmail('u1', 'OLD@example.com', 'correct-password'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(userRepo.update).not.toHaveBeenCalled();
    });
});
