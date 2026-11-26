/** Only same-origin relative paths; rejects //host, /\host and scheme URLs. */
export function safeReturnTo(value: unknown): string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
    return value;
}

/** Login page URL for a failed SSO attempt; `next` lets the page send the user back to where they were headed. */
export function ssoFailureUrl(code: string, returnTo: unknown): string {
    const target = safeReturnTo(returnTo);
    const next = target === '/' ? '' : `&next=${encodeURIComponent(target)}`;
    return `/login?sso_error=${code}${next}`;
}
