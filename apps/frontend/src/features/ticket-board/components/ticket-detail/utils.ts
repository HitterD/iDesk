/**
 * Port the backend listens on when `VITE_API_URL` says nothing useful — same value
 * `lib/api.ts` and `lib/socket.ts` fall back to. Behind a reverse proxy that serves
 * the API on the web origin, set VITE_API_URL and this is never used.
 */
const DEFAULT_API_PORT = '5050';

export const getAttachmentUrl = (url: string | null | undefined): string => {
    if (!url || typeof url !== 'string') return '';

    // Skip invalid Telegram file ID formats (legacy data)
    if (url.startsWith('telegram:photo:') || url.startsWith('telegram:document:')) {
        return '';
    }

    // Standardize url by stripping any legacy API prefixes inside stored paths
    // e.g., '/api/v1/uploads/xyz' -> '/uploads/xyz' or '/v1/uploads/xyz' -> '/uploads/xyz'
    let cleanPath = url.replace(/^(https?:\/\/[^\/]+)?(\/api)?(\/v1)?(\/uploads\/)/i, '/uploads/');

    // If url was an absolute http(s) URL but pointed to localhost or 127.0.0.1:
    // replace localhost/127.0.0.1 with current client hostname if client is on IP/domain
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
        try {
            const parsed = new URL(cleanPath);
            const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
            if (currentHostname && currentHostname !== 'localhost' && currentHostname !== '127.0.0.1' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
                parsed.hostname = currentHostname;
                return parsed.toString();
            }
        } catch {
            // Fallthrough to standard normalization if URL parsing fails
        }
        return cleanPath;
    }

    // For relative paths like '/uploads/xyz.png'
    // Determine the base backend URL
    const envApiUrl = import.meta.env.VITE_API_URL || '';
    let hostBase = '';

    if (envApiUrl.startsWith('http://') || envApiUrl.startsWith('https://')) {
        try {
            const parsedEnv = new URL(envApiUrl);
            const portStr = parsedEnv.port ? `:${parsedEnv.port}` : (parsedEnv.protocol === 'https:' ? '' : `:${DEFAULT_API_PORT}`);
            const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
            const activeHost = (currentHostname && currentHostname !== 'localhost' && currentHostname !== '127.0.0.1' && (parsedEnv.hostname === 'localhost' || parsedEnv.hostname === '127.0.0.1'))
                ? currentHostname
                : parsedEnv.hostname;
            hostBase = `${parsedEnv.protocol}//${activeHost}${portStr}`;
        } catch {
            hostBase = '';
        }
    }

    if (!hostBase && typeof window !== 'undefined') {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        // Over https the app is behind a reverse proxy that also fronts /uploads;
        // pinning the raw backend port there would point at a non-TLS listener.
        hostBase = protocol === 'https:'
            ? window.location.origin
            : `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
    }

    const path = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    return `${hostBase}${path}`;
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

export const isImageUrl = (url: string) => {
    if (!url || typeof url !== 'string' || url.startsWith('telegram:')) {
        return false;
    }

    // Match on the extension only, not anywhere in the string: `includes('.png')`
    // treated `report.png.pdf` and `/uploads/gif-guide/manual.pdf` as images and
    // rendered them in an <img> that could only ever show a broken icon.
    const lowerUrl = url.toLowerCase();
    const pathname = lowerUrl.split(/[?#]/)[0];
    return IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext)) || pathname.includes('/uploads/telegram/');
};
