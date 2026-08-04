import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../users/enums/user-role.enum';
import { TokenService } from './token.service';
import { ValidatedUser } from './auth-user.types';

describe('TokenService', () => {
    const jwt = { sign: jest.fn(), verify: jest.fn() } as unknown as JwtService;
    const user: ValidatedUser = {
        id: 'user-1', email: 'user@example.com', fullName: 'User', role: UserRole.USER,
        isActive: true, mustChangePassword: false,
    };

    beforeEach(() => jest.clearAllMocks());

    it('issues compatible access and refresh claims', () => {
        (jwt.sign as jest.Mock).mockReturnValueOnce('access').mockReturnValueOnce('refresh');
        const result = new TokenService(jwt).issueRefreshToken(user, 'family-1', undefined, true);
        expect(result.access_token).toBe('access');
        expect(result.refresh_token).toBe('refresh');
        expect(result.refreshExpiresIn).toBe('90d');
        expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ type: 'access', sub: user.id }), expect.any(Object));
        expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ type: 'refresh', familyId: 'family-1', rememberMe: true }), expect.any(Object));
    });
});
