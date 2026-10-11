/**
 * Builds absolute links for outgoing email and for iPop.
 *
 * Email (and iPop) are read outside the browser session, so every link must be absolute
 * and must point at the deployment the recipient actually uses. Before this
 * helper existed, callers reached for `process.env.APP_URL` (never defined
 * anywhere, producing `undefined/...` links) or hardcoded a developer machine
 * address. FRONTEND_URL is the one variable the rest of the app already relies
 * on for CORS, so it is the single source of truth here too.
 *
 * FRONTEND_URL may list several origins for CORS (e.g. the LAN address and the public
 * domain). Links use the public one: the first https entry, else the first entry.
 */
const DEFAULT_FRONTEND_URL = 'http://localhost:4050';

/** Picks the address users open from a FRONTEND_URL value (comma-separated allowed). */
export function pickPublicBaseUrl(value: string | undefined | null): string {
    const entries = (value ?? '').split(',').map((u) => u.trim()).filter(Boolean);
    const base = entries.find((u) => u.toLowerCase().startsWith('https://')) ?? entries[0] ?? DEFAULT_FRONTEND_URL;
    return base.replace(/\/+$/, '');
}

/** Base URL with any trailing slash removed. */
export function getFrontendBaseUrl(): string {
    return pickPublicBaseUrl(process.env.FRONTEND_URL);
}

/**
 * Joins a path onto the frontend base URL.
 * `buildAppUrl('/tickets/42')` -> `https://idesk.example.com/tickets/42`
 */
export function buildAppUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${getFrontendBaseUrl()}${normalized}`;
}
