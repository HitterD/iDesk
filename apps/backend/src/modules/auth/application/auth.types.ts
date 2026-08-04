export {
    AuthenticatedClaims,
    AuthenticatedUser,
    ValidatedUser,
} from './auth-user.types';

export type { UserRole } from '../../users/enums/user-role.enum';

import type { AuthenticatedUser, ValidatedUser } from './auth-user.types';

export type AuthRequestUser = AuthenticatedUser;
export type AuthenticatedUserData = ValidatedUser;
