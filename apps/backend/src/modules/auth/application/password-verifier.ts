import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../../shared/core/config/security.config';

// Fixed bcrypt hash keeps missing-user verification on the same work factor as real passwords.
export const DUMMY_PASSWORD_HASH = '$2b$12$Dr0x0lVWs3y1qsIZ6j7LtOlcgib14LLK/ui5jRFlDsDUibYhyJpY6';

export async function verifyPassword(password: string, passwordHash?: string | null): Promise<boolean> {
    return bcrypt.compare(password, passwordHash || DUMMY_PASSWORD_HASH);
}

export const PASSWORD_HASH_ROUNDS = BCRYPT_ROUNDS;
