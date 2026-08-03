/**
 * Simple encryption utility for Zustand persist middleware (4.3.2)
 * Uses AES-like XOR encryption with base64 encoding
 * 
 * NOTE: For production, consider using Web Crypto API or a proper encryption library
 * This is a lightweight solution for basic obfuscation of localStorage data
 */

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'iDesk-secure-key-2024';

/**
 * Encrypt a string value
 */
export function encrypt(value: string | null): string | null {
    if (!value) return null;

    try {
        // XOR encryption with key
        const encrypted = value.split('').map((char, i) => {
            const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            return String.fromCharCode(char.charCodeAt(0) ^ keyChar);
        }).join('');

        // Base64 encode
        return btoa(encrypted);
    } catch (error) {
        console.error('Encryption error:', error);
        return value; // Fallback to unencrypted
    }
}

/**
 * Decrypt a string value
 */
export function decrypt(value: string | null): string | null {
    if (!value) return null;

    try {
        // Base64 decode
        const decoded = atob(value);

        // XOR decryption with key
        const decrypted = decoded.split('').map((char, i) => {
            const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            return String.fromCharCode(char.charCodeAt(0) ^ keyChar);
        }).join('');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return value; // Fallback - might be unencrypted legacy data
    }
}

/** Ambiguous-free alphabet: no O/0, I/l/1. */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

/**
 * Generate a password using the CSPRNG (`crypto.getRandomValues`).
 * `Math.random()` is not cryptographically secure and must never be used for
 * credentials. Rejection sampling avoids the modulo bias of `% length`.
 */
export function generateSecurePassword(length = 16): string {
    const alphabetLength = PASSWORD_ALPHABET.length;
    // Largest multiple of alphabetLength that fits in a byte; values above it are rejected.
    const limit = Math.floor(256 / alphabetLength) * alphabetLength;
    const out: string[] = [];
    const buffer = new Uint8Array(length * 2);

    while (out.length < length) {
        crypto.getRandomValues(buffer);
        for (let i = 0; i < buffer.length && out.length < length; i++) {
            if (buffer[i] < limit) {
                out.push(PASSWORD_ALPHABET[buffer[i] % alphabetLength]);
            }
        }
    }

    return out.join('');
}

/**
 * Create encrypted storage adapter for Zustand
 */
export const createEncryptedStorage = () => ({
    getItem: (key: string): string | null => {
        const value = localStorage.getItem(key);
        return decrypt(value);
    },
    setItem: (key: string, value: string): void => {
        const encrypted = encrypt(value);
        if (encrypted) {
            localStorage.setItem(key, encrypted);
        }
    },
    removeItem: (key: string): void => {
        localStorage.removeItem(key);
    },
});
