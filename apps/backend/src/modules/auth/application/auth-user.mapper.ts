import { User } from '../../users/entities/user.entity';
import { AuthenticatedUser, ValidatedUser } from './auth-user.types';

export function toValidatedUser(user: User): ValidatedUser {
    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        employeeId: user.employeeId ?? null,
        departmentId: user.departmentId ?? null,
        siteId: user.siteId ?? null,
        avatarUrl: user.avatarUrl ?? null,
        jobTitle: user.jobTitle ?? null,
        phoneNumber: user.phoneNumber ?? null,
    };
}

type AuthenticatedUserSource = Pick<User, 'id' | 'email' | 'role' | 'fullName'>;

export function toAuthenticatedUser(user: AuthenticatedUserSource): AuthenticatedUser {
    return {
        userId: user.id,
        username: user.email,
        role: user.role,
        fullName: user.fullName,
    };
}
