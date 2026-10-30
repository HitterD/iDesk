import { UserRole } from '../../users/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';
import { toAuthenticatedUser, toValidatedUser } from './auth-user.mapper';

describe('auth user mappers', () => {
    it('maps only safe user fields and omits credentials, security state, and relations', () => {
        const user = Object.assign(new User(), {
            id: 'user-1',
            email: 'user@example.com',
            password: 'hashed-password',
            fullName: 'Test User',
            role: UserRole.AGENT,
            isActive: true,
            mustChangePassword: false,
            employeeId: 'E-1',
            departmentId: 'department-1',
            siteId: 'site-1',
            avatarUrl: null,
            jobTitle: 'Agent',
            phoneNumber: null,
            hashedRefreshToken: 'refresh-hash',
            department: { id: 'department-1' },
            site: { id: 'site-1' },
            appliedPreset: { id: 'preset-1' },
        });

        const mapped = toValidatedUser(user);

        expect(mapped).toEqual({
            id: 'user-1',
            email: 'user@example.com',
            fullName: 'Test User',
            role: UserRole.AGENT,
            isActive: true,
            mustChangePassword: false,
            employeeId: 'E-1',
            departmentId: 'department-1',
            siteId: 'site-1',
            avatarUrl: null,
            jobTitle: 'Agent',
            phoneNumber: null,
            guidebookAcknowledgedAt: null,
        });
        expect(mapped).not.toHaveProperty('password');
        expect(mapped).not.toHaveProperty('hashedRefreshToken');
        expect(mapped).not.toHaveProperty('department');
        expect(mapped).not.toHaveProperty('site');
        expect(mapped).not.toHaveProperty('appliedPreset');
    });

    it('maps validated user to request identity', () => {
        const mapped = toAuthenticatedUser({
            id: 'user-1',
            email: 'user@example.com',
            fullName: 'Test User',
            role: UserRole.ADMIN,
        });

        expect(mapped).toEqual({
            userId: 'user-1',
            username: 'user@example.com',
            role: UserRole.ADMIN,
            fullName: 'Test User',
            siteId: null,
            employeeId: null,
        });
    });

    it('preserves employeeId in authenticated user identity when present', () => {
        const mapped = toAuthenticatedUser({
            id: 'user-2',
            email: 'user2@example.com',
            fullName: 'Employee User',
            role: UserRole.USER,
            siteId: 'site-uuid-1',
            employeeId: '00061058',
        });

        expect(mapped).toEqual({
            userId: 'user-2',
            username: 'user2@example.com',
            role: UserRole.USER,
            fullName: 'Employee User',
            siteId: 'site-uuid-1',
            employeeId: '00061058',
        });
    });
});
