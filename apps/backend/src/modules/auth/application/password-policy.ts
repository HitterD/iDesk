export interface PasswordPolicyContext {
    email?: string;
    nik?: string;
    fullName?: string;
}

export interface PasswordPolicyResult {
    valid: boolean;
    reason?: 'TOO_SHORT' | 'TOO_LONG' | 'MISSING_COMPLEXITY' | 'COMMON_PASSWORD' | 'USER_INFO';
}

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 72;
const COMMON_PASSWORDS = new Set(['password', 'password123', 'password123456', '123456789012', 'qwertyuiop12', 'admin123456']);

export function validatePasswordPolicy(password: string, context: PasswordPolicyContext = {}): PasswordPolicyResult {
    if (password.length < MIN_PASSWORD_LENGTH) return { valid: false, reason: 'TOO_SHORT' };
    if (password.length > MAX_PASSWORD_LENGTH) return { valid: false, reason: 'TOO_LONG' };
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        return { valid: false, reason: 'MISSING_COMPLEXITY' };
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) return { valid: false, reason: 'COMMON_PASSWORD' };

    const normalizedPassword = password.toLowerCase();
    const userValues = [context.email?.split('@')[0], context.nik, context.fullName]
        .filter((value): value is string => Boolean(value))
        .map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter(value => value.length >= 4);
    if (userValues.some(value => normalizedPassword.includes(value))) {
        return { valid: false, reason: 'USER_INFO' };
    }
    return { valid: true };
}

export const PASSWORD_POLICY = {
    minLength: MIN_PASSWORD_LENGTH,
    maxLength: MAX_PASSWORD_LENGTH,
};
