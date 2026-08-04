import { ValidatedUser } from './auth-user.types';

export interface LoginValidationResult {
    success: boolean;
    user?: ValidatedUser;
    errorCode?: 'USER_NOT_FOUND' | 'WRONG_PASSWORD' | 'ACCOUNT_DISABLED';
}
