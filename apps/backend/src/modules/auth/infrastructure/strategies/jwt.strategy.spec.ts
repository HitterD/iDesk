import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../../../users/enums/user-role.enum';

describe('JwtStrategy', () => {
    const strategy = () => new JwtStrategy({
        getOrThrow: jest.fn().mockReturnValue('x'.repeat(32)),
    } as unknown as ConfigService);

    const claims = {
        sub: 'user-1',
        username: 'user@example.com',
        role: UserRole.USER,
        fullName: 'User',
        type: 'access' as const,
    };

    it('accepts access-token claims and omits sensitive fields', async () => {
        await expect(strategy().validate(claims)).resolves.toEqual({
            userId: 'user-1',
            username: 'user@example.com',
            role: UserRole.USER,
            fullName: 'User',
        });
    });

    it('rejects refresh-token claims used as access credentials', async () => {
        await expect(strategy().validate({ ...claims, type: 'refresh' as never }))
            .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it.each([
        ['sub', { sub: '' }],
        ['username', { username: '' }],
        ['role', { role: undefined }],
        ['fullName', { fullName: '' }],
    ])('rejects missing %s claim', async (_name, override) => {
        await expect(strategy().validate({ ...claims, ...override } as typeof claims))
            .rejects.toBeInstanceOf(UnauthorizedException);
    });
});
