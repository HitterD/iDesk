/**
 * Redaction helpers for audit trails and structured logs.
 * Keeps enough of an identifier to correlate events without storing it in full.
 */

const REDACTED = '[REDACTED]';

/** Field names whose value must never reach a log or audit row. */
const SECRET_FIELDS = ['password', 'token', 'cookie', 'secret', 'authorization'];

/** Field names holding an identifier that should be masked, not dropped. */
const IDENTIFIER_FIELDS = ['nik', 'employeeid', 'email'];

/** Mask a value to a short prefix/suffix, e.g. `00000024` -> `00***24`. */
export function maskIdentifier(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length <= 4) return '***';
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

function classify(key: string): 'secret' | 'identifier' | 'plain' {
    const normalized = key.toLowerCase();
    if (SECRET_FIELDS.some(field => normalized.includes(field))) return 'secret';
    if (IDENTIFIER_FIELDS.includes(normalized)) return 'identifier';
    return 'plain';
}

/**
 * Redact secrets and mask identifiers in a plain object, recursively.
 * Non-object input is returned untouched — callers keep responsibility for
 * strings they build themselves.
 */
export function redactSensitive<T>(value: T): T {
    if (Array.isArray(value)) return value.map(item => redactSensitive(item)) as unknown as T;
    if (!value || typeof value !== 'object' || value instanceof Date) return value;

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        const kind = classify(key);
        if (kind === 'secret') {
            result[key] = REDACTED;
        } else if (kind === 'identifier' && typeof item === 'string') {
            result[key] = maskIdentifier(item);
        } else {
            result[key] = redactSensitive(item);
        }
    }
    return result as T;
}
