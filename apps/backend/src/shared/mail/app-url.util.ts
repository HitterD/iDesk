/**
 * Builds absolute links for outgoing email.
 *
 * Email is read outside the browser session, so every link must be absolute
 * and must point at the deployment the recipient actually uses. Before this
 * helper existed, callers reached for `process.env.APP_URL` (never defined
 * anywhere, producing `undefined/...` links) or hardcoded a developer machine
 * address. FRONTEND_URL is the one variable the rest of the app already relies
 * on for CORS, so it is the single source of truth here too.
 */
const DEFAULT_FRONTEND_URL = 'http://localhost:4050';

/** Base URL with any trailing slash removed. */
export function getFrontendBaseUrl(): string {
    const configured = process.env.FRONTEND_URL?.trim();
    const base = configured || DEFAULT_FRONTEND_URL;
    return base.replace(/\/+$/, '');
}

/**
 * Joins a path onto the frontend base URL.
 * `buildAppUrl('/tickets/42')` -> `https://idesk.example.com/tickets/42`
 */
export function buildAppUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${getFrontendBaseUrl()}${normalized}`;
}
