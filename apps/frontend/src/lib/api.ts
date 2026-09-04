import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import axiosRetry from 'axios-retry';
import { getErrorMessage, resolveNetworkOrServerError } from './errorMessages';

// Generate unique request ID for error correlation
const generateRequestId = (): string => {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL || ''}/v1`,
    timeout: 30000, // Increased for file uploads
    withCredentials: true, // Enable HttpOnly cookie auth
});

// === 4.4.2 Implement Retry with Exponential Backoff ===
axiosRetry(api, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error: AxiosError) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 503,
    onRetry: (retryCount, error) => {
        if (import.meta.env.DEV) {
            console.warn(`Retry attempt ${retryCount} for ${error.config?.url}`);
        }
    },
});

// === Request Interceptor with Dev Logging ===
api.interceptors.request.use(
    (config) => {
        // Generate and attach request ID for error correlation
        const requestId = generateRequestId();
        config.headers['X-Request-ID'] = requestId;
        (config as any).requestId = requestId;

        // Token is now in HttpOnly cookie - browser handles it automatically
        // No need to manually inject Authorization header

        // Add CSRF token for state-changing requests (POST, PUT, PATCH, DELETE)
        const stateChangingMethods = ['post', 'put', 'patch', 'delete'];
        const method = config.method?.toLowerCase();

        if (method && stateChangingMethods.includes(method)) {
            // Read CSRF token from cookie (set by /auth/csrf-token endpoint)
            const csrfToken = getCsrfTokenFromCookie();
            if (csrfToken) {
                config.headers['X-CSRF-TOKEN'] = csrfToken;
            }
        }

        // Dev-only request logging (4.4.1)
        if (import.meta.env.DEV) {
            console.group(`${config.method?.toUpperCase()} ${config.url} [${requestId}]`);
            if (config.params) console.log('Params:', config.params);
            if (config.data && !(config.data instanceof FormData)) console.log('Data:', config.data);
            console.groupEnd();
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Read CSRF token from cookie
 */
function getCsrfTokenFromCookie(): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrf-token') {
            return decodeURIComponent(value);
        }
    }
    return null;
}

// State for handling concurrent refresh requests
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: AxiosError | null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

export interface AuthHandlers {
    logout?: () => void;
    setExpiresAt?: (expiresAt: string | null) => void;
    isAuthenticated?: () => boolean;
}

let authHandlers: AuthHandlers = {};

export const registerAuthHandlers = (handlers: AuthHandlers): void => {
    authHandlers = { ...authHandlers, ...handlers };
};

let hasRedirectedToLogin = false;

export function resetLoginRedirectState(): void {
    hasRedirectedToLogin = false;
}

function forceLogout(): void {
    if (hasRedirectedToLogin) return;
    hasRedirectedToLogin = true;
    try {
        authHandlers.logout?.();
    } catch {
        try { localStorage.removeItem('auth-storage'); } catch {}
    }
    const pathname = window.location.pathname;
    if (pathname.startsWith('/login') || pathname.startsWith('/tv/') || pathname.startsWith('/feedback/')) {
        return;
    }
    const next = `${pathname}${window.location.search}${window.location.hash}`;
    const base = next && next !== '/login' ? `/login?next=${encodeURIComponent(next)}` : '/login';
    const target = base.includes('?') ? `${base}&reason=expired` : `${base}?reason=expired`;
    toast.error(getErrorMessage('SESSION_EXPIRED'));
    window.location.replace(target);
}

// Response Interceptor with Dev Logging and Auto-Refresh
api.interceptors.response.use(
    (response) => {
        // Dev-only response logging (4.4.1)
        if (import.meta.env.DEV) {
            console.log(`${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        }
        if (response.config?.url?.includes('/auth/login')) {
            resetLoginRedirectState();
        }
        // Keep local session expiry in sync when backend rotates tokens.
        const expiresAt: unknown = (response.data as Record<string, unknown> | undefined)?.expiresAt;
        if (typeof expiresAt === 'string' && response.config?.url?.includes('/auth/')) {
            const iso = Date.parse(expiresAt) ? expiresAt : null;
            if (iso) authHandlers.setExpiresAt?.(iso);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        const { response } = error;

        // Dev-only error logging
        if (import.meta.env.DEV) {
            console.error(`${originalRequest?.method?.toUpperCase()} ${originalRequest?.url} - ${response?.status || 'Network Error'}`);
        }

        const isLoginRequest = originalRequest?.url?.includes('/auth/login');
        const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');
        const isLogoutRequest = originalRequest?.url?.includes('/auth/logout');

        // If user is already logged out or during logout request, avoid triggering refresh/forceLogout
        const isCurrentlyAuthenticated = authHandlers.isAuthenticated ? authHandlers.isAuthenticated() : true;

        if (response) {
            // Single 401 handler: try refresh once, otherwise force logout (no duplicate block).
            if (response.status === 401 && !isLoginRequest && !isRefreshRequest && !isLogoutRequest && isCurrentlyAuthenticated) {
                if (originalRequest._retry) {
                    forceLogout();
                    return Promise.reject(error);
                }
                if (isRefreshing) {
                    return new Promise(function(resolve, reject) {
                        failedQueue.push({ resolve, reject });
                    }).then(() => {
                        return api(originalRequest);
                    }).catch(err => {
                        return Promise.reject(err);
                    });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const refreshRes = await api.post('/auth/refresh');
                    const nextExpiresAt: unknown = (refreshRes.data as Record<string, unknown> | undefined)?.expiresAt;
                    if (typeof nextExpiresAt === 'string') {
                        const iso = Date.parse(nextExpiresAt) ? nextExpiresAt : null;
                        if (iso) authHandlers.setExpiresAt?.(iso);
                    }
                    processQueue(null);
                    return api(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError as AxiosError);
                    forceLogout();
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }

            // Don't show toast for login/logout/refresh errors or when user is already logged out
            if (!isLoginRequest && !isLogoutRequest && !isRefreshRequest && isCurrentlyAuthenticated) {
                // Suppress toast for GET + 403: background read queries that fail due to missing page permission.
                const isGetRequest = originalRequest?.method?.toLowerCase() === 'get';
                const isForbidden = response.status === 403;

                if (isGetRequest && isForbidden) {
                    return Promise.reject(error);
                }

                // Use centralized error messages
                const errorCode = response.data?.errorCode || response.data?.code;
                const serverMessage = response.data?.message;
                
                // For 500 errors without explicit business code, use friendly Indonesian error
                let displayMessage: string;
                if (response.status === 500 && (!errorCode || errorCode === 'INTERNAL_ERROR')) {
                    displayMessage = getErrorMessage('SYS_001');
                } else {
                    displayMessage = getErrorMessage(errorCode, serverMessage);
                }
                toast.error(displayMessage);
            }
        } else if (!isLoginRequest) {
            // No response received (timeout, abort, network, server unreachable)
            const { message, isSilent } = resolveNetworkOrServerError(error);
            if (!isSilent && message) {
                toast.error(message);
            }
        }

        return Promise.reject(error);
    }
);

(api as any).resetLoginRedirectState = resetLoginRedirectState;
(api as any).registerAuthHandlers = registerAuthHandlers;

export default api;
