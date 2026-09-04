import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * PATCH /users/me used to bind UpdateUserDto, which carries `role`, `siteId`,
 * `isActive` and `employeeId` straight through to userRepo.update() — letting any
 * authenticated user promote themselves to ADMIN. The endpoint now binds
 * UpdateProfileDto; these tests pin that the escalation fields are rejected.
 *
 * The pipe is configured exactly as main.ts configures it globally.
 */
describe('UpdateProfileDto — self-service escalation guard', () => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const metadata = { type: 'body' as const, metatype: UpdateProfileDto };

    it.each(['role', 'isActive', 'siteId', 'employeeId', 'email'])(
        'menolak field %s dari user sendiri',
        async (field) => {
            const payload: Record<string, unknown> = { fullName: 'BUDI' };
            payload[field] = field === 'isActive' ? true : 'ADMIN';

            await expect(pipe.transform(payload, metadata)).rejects.toBeInstanceOf(BadRequestException);
        },
    );

    it('menerima field profil yang sah', async () => {
        const result = await pipe.transform(
            { fullName: 'BUDI', jobTitle: 'STAFF', phoneNumber: '+628123' },
            metadata,
        );

        expect(result).toEqual(
            expect.objectContaining({ fullName: 'BUDI', jobTitle: 'STAFF', phoneNumber: '+628123' }),
        );
    });

    it('mengubah departmentId kosong menjadi null', async () => {
        const result: any = await pipe.transform({ departmentId: '' }, metadata);
        expect(result.departmentId).toBeNull();
    });
});
