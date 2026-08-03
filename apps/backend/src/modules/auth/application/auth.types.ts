import { UserRole } from '../../users/enums/user-role.enum';

export interface ValidatedUser {
    id: string;
    email: string;
    fullName: string;
    role: UserRole | string;
    isActive: boolean;
    mustChangePassword: boolean;
    employeeId?: string | null;
    departmentId?: string | null;
    siteId?: string | null;
}
