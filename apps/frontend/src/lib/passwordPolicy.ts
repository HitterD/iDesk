/**
 * Shared frontend mirror of backend `password-policy.ts`.
 * Single source of truth for password constraints shown in the UI.
 * MUST stay in sync with `apps/backend/src/modules/auth/application/password-policy.ts`.
 */

export const PASSWORD_POLICY = {
    minLength: 12,
    maxLength: 72,
} as const;

export const MIN_PASSWORD_LENGTH = PASSWORD_POLICY.minLength;
export const MAX_PASSWORD_LENGTH = PASSWORD_POLICY.maxLength;

export type PasswordPolicyReason =
    | 'TOO_SHORT'
    | 'TOO_LONG'
    | 'MISSING_COMPLEXITY'
    | 'COMMON_PASSWORD'
    | 'USER_INFO';

export interface PasswordCheckResult {
    valid: boolean;
    reason?: PasswordPolicyReason;
}

/**
 * Lightweight client-side mirror of backend `validatePasswordPolicy` — only the
 * checks that don't need user context. Gives instant feedback before the request.
 * Full validation (COMMON_PASSWORD, USER_INFO) tetap di backend.
 */
export function validatePasswordLocal(password: string): PasswordCheckResult {
    if (password.length < PASSWORD_POLICY.minLength) return { valid: false, reason: 'TOO_SHORT' };
    if (password.length > PASSWORD_POLICY.maxLength) return { valid: false, reason: 'TOO_LONG' };
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        return { valid: false, reason: 'MISSING_COMPLEXITY' };
    }
    return { valid: true };
}

export function passwordPolicyMessage(reason: PasswordPolicyReason): string {
    switch (reason) {
        case 'TOO_SHORT':
            return `Password minimal ${PASSWORD_POLICY.minLength} karakter.`;
        case 'TOO_LONG':
            return `Password maksimal ${PASSWORD_POLICY.maxLength} karakter.`;
        case 'MISSING_COMPLEXITY':
            return 'Password harus mengandung huruf besar, huruf kecil, dan angka.';
        case 'COMMON_PASSWORD':
            return 'Password terlalu umum, pilih yang lebih unik.';
        case 'USER_INFO':
            return 'Password tidak boleh mengandung nama, email, atau NIK Anda.';
        default:
            return 'Password tidak memenuhi kebijakan keamanan.';
    }
}

/** Translate backend messages like "Password policy violation: TOO_SHORT" to friendly text. */
export function translatePasswordPolicyError(message: string): string | null {
    const m = message.match(/Password policy violation:\s*(\w+)/);
    if (!m) return null;
    const reason = m[1] as PasswordPolicyReason;
    const known: PasswordPolicyReason[] = ['TOO_SHORT', 'TOO_LONG', 'MISSING_COMPLEXITY', 'COMMON_PASSWORD', 'USER_INFO'];
    if ((known as string[]).includes(reason)) return passwordPolicyMessage(reason);
    return null;
}

/** Checklist items for the live requirement list in forms. */
export function getPasswordRequirements(password: string): { label: string; met: boolean }[] {
    return [
        { label: `Minimal ${PASSWORD_POLICY.minLength} karakter`, met: password.length >= PASSWORD_POLICY.minLength },
        { label: 'Huruf kecil (a-z)', met: /[a-z]/.test(password) },
        { label: 'Huruf besar (A-Z)', met: /[A-Z]/.test(password) },
        { label: 'Angka (0-9)', met: /\d/.test(password) },
        { label: `Maksimal ${PASSWORD_POLICY.maxLength} karakter`, met: password.length <= PASSWORD_POLICY.maxLength },
    ];
}
