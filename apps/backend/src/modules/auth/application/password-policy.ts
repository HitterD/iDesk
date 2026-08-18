export interface PasswordPolicyContext {
    email?: string;
    nik?: string;
    fullName?: string;
}

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 72;

export interface PasswordPolicyResult {
    valid: boolean;
    reason?: 'TOO_SHORT' | 'TOO_LONG' | 'MISSING_COMPLEXITY' | 'COMMON_PASSWORD' | 'USER_INFO';
    message?: string;
}

export const PASSWORD_POLICY_MESSAGES: Record<NonNullable<PasswordPolicyResult['reason']>, string> = {
    TOO_SHORT: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    TOO_LONG: `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`,
    MISSING_COMPLEXITY: 'Password must contain an uppercase letter, a lowercase letter, and a number',
    COMMON_PASSWORD: 'This password is too common, choose a more unique one',
    USER_INFO: 'Password must not contain your name, email, or NIK',
};
const COMMON_PASSWORDS = new Set(['password', 'password123', 'password123456', '123456789012', 'qwertyuiop12', 'admin123456']);

export function validatePasswordPolicy(password: string, context: PasswordPolicyContext = {}): PasswordPolicyResult {
    if (password.length < MIN_PASSWORD_LENGTH) return { valid: false, reason: 'TOO_SHORT', message: PASSWORD_POLICY_MESSAGES.TOO_SHORT };
    if (password.length > MAX_PASSWORD_LENGTH) return { valid: false, reason: 'TOO_LONG', message: PASSWORD_POLICY_MESSAGES.TOO_LONG };
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        return { valid: false, reason: 'MISSING_COMPLEXITY', message: PASSWORD_POLICY_MESSAGES.MISSING_COMPLEXITY };
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) return { valid: false, reason: 'COMMON_PASSWORD', message: PASSWORD_POLICY_MESSAGES.COMMON_PASSWORD };

    const normalizedPassword = password.toLowerCase();
    const userValues = [context.email?.split('@')[0], context.nik, context.fullName]
        .filter((value): value is string => Boolean(value))
        .map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter(value => value.length >= 4);
    if (userValues.some(value => normalizedPassword.includes(value))) {
        return { valid: false, reason: 'USER_INFO', message: PASSWORD_POLICY_MESSAGES.USER_INFO };
    }
    return { valid: true };
}

export const PASSWORD_POLICY = {
    minLength: MIN_PASSWORD_LENGTH,
    maxLength: MAX_PASSWORD_LENGTH,
};
