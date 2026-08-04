import { UserRole } from '../../users/enums/user-role.enum';
import { UsersService } from '../../users/users.service';
import { RefreshSessionStore } from '../infrastructure/refresh-session.store';
import { SessionService } from './session.service';
import { ValidatedUser } from './auth-user.types';

jest.mock('../../../shared/core/config/security.config', () => ({ resolveRefreshSessionMode: () => 'legacy' }));

describe('SessionService', () => {
    const users = {
        getUserIfRefreshTokenMatches: jest.fn(),
        findById: jest.fn(),
        setCurrentRefreshToken: jest.fn(),
        removeRefreshToken: jest.fn(),
    } as unknown as UsersService;
    const store = {
        create: jest.fn(), consume: jest.fn(), invalidateFamily: jest.fn(), invalidateUserSessions: jest.fn(),
    } as unknown as RefreshSessionStore;
    const user: ValidatedUser = {
        id: 'user-1', email: 'u@example.com', fullName: 'User', role: UserRole.USER,
        isActive: true, mustChangePassword: false,
    };

    beforeEach(() => jest.clearAllMocks());

    it('reads legacy refresh session through UsersService', async () => {
        (users.getUserIfRefreshTokenMatches as jest.Mock).mockResolvedValue(user);
        await expect(new SessionService(users, store).rotate('token', { sub: user.id })).resolves.toBe(user);
        expect(users.getUserIfRefreshTokenMatches).toHaveBeenCalledWith('token', user.id);
    });

    it('invalidates legacy user session', async () => {
        await new SessionService(users, store).invalidateUser(user.id);
        expect(users.removeRefreshToken).toHaveBeenCalledWith(user.id);
    });
});
