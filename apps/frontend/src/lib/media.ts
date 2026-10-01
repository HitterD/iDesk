/**
 * Media and static assets URL resolver for iDesk.
 * Handles both public frontend assets and backend uploads across environments.
 */

const DEFAULT_API_PORT = '5050';

export const resolveAudioUrl = (url: string | null | undefined): string => {
    if (!url || typeof url !== 'string') return '';

    // 1. If absolute URL, ensure hostname aligns with client hostname
    if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
            const parsed = new URL(url);
            const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
            if (
                currentHostname &&
                currentHostname !== 'localhost' &&
                currentHostname !== '127.0.0.1' &&
                (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
            ) {
                parsed.hostname = currentHostname;
                return parsed.toString();
            }
        } catch {
            // ignore parse error
        }
        return url;
    }

    // 2. Built-in default sounds in frontend public directory (/sounds/default/...)
    if (url.startsWith('/sounds/')) {
        return url;
    }

    // 3. Custom uploaded sounds in backend (/uploads/sounds/...)
    if (url.startsWith('/uploads/')) {
        const envApiUrl = import.meta.env.VITE_API_URL || '';
        let hostBase = '';

        if (envApiUrl.startsWith('http://') || envApiUrl.startsWith('https://')) {
            try {
                const parsedEnv = new URL(envApiUrl);
                const portStr = parsedEnv.port
                    ? `:${parsedEnv.port}`
                    : parsedEnv.protocol === 'https:'
                    ? ''
                    : `:${DEFAULT_API_PORT}`;
                const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
                const activeHost =
                    currentHostname &&
                    currentHostname !== 'localhost' &&
                    currentHostname !== '127.0.0.1' &&
                    (parsedEnv.hostname === 'localhost' || parsedEnv.hostname === '127.0.0.1')
                        ? currentHostname
                        : parsedEnv.hostname;
                hostBase = `${parsedEnv.protocol}//${activeHost}${portStr}`;
            } catch {
                hostBase = '';
            }
        }

        // Without an explicit API URL the frontend server (nginx in prod, Vite in dev) proxies /uploads,
        // so same-origin works on any host, including LAN IPs where port 5050 is not exposed.
        if (!hostBase && typeof window !== 'undefined') {
            hostBase = window.location.origin;
        }

        return `${hostBase}${url}`;
    }

    return url;
};
