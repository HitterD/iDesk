import { UserRole } from '../../users/enums/user-role.enum';

/** User data safe to return from authentication endpoints. */
export interface ValidatedUser {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    mustChangePassword: boolean;
    employeeId?: string | null;
    departmentId?: string | null;
    siteId?: string | null;
    avatarUrl?: string | null;
    jobTitle?: string | null;
    phoneNumber?: string | null;
}

/** User identity attached to an authenticated request. */
export interface AuthenticatedUser {
    userId: string;
    username: string;
    role: UserRole;
    fullName: string;
    /** Site the user belongs to; null for accounts without a site assignment. */
    siteId: string | null;
}

export interface AuthenticatedClaims {
    sub: string;
    username: string;
    role: UserRole;
    fullName: string;
    type: 'access';
    /** Absent on tokens issued before multi-site isolation shipped. */
    siteId?: string | null;
}
