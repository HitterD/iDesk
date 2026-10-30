/**
 * Origins every WebSocket gateway accepts, matching the HTTP CORS policy in main.ts.
 *
 * All gateways share one engine.io server, and only the CORS options of the first
 * gateway Nest creates are applied to it. A gateway-specific (looser) policy is
 * therefore silently ignored, so every gateway must use this same check.
 */
const TRUSTED_ORIGIN_PATTERNS = [
    /^https?:\/\/([a-zA-Z0-9-]+\.)*santos\.co\.id(:[0-9]+)?$/,
    /^https?:\/\/localhost(:[0-9]+)?$/,
    /^https?:\/\/127\.0\.0\.1(:[0-9]+)?$/,
    // Office LAN: TV boards and PCs open iDesk by the server's private IP.
    /^https?:\/\/192\.168\.[0-9]+\.[0-9]+(:[0-9]+)?$/,
    /^https?:\/\/10\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)?$/,
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]+\.[0-9]+(:[0-9]+)?$/,
];

function configuredOrigins(): string[] {
    return (process.env.WS_CORS_ORIGIN || process.env.FRONTEND_URL || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

export function isAllowedWsOrigin(origin: string | undefined): boolean {
    if (!origin) return true;
    if (configuredOrigins().includes(origin)) return true;
    return TRUSTED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

export function buildWsCorsOrigin(rejectMessage = 'WebSocket origin not allowed') {
    return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (isAllowedWsOrigin(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(rejectMessage), false);
    };
}
