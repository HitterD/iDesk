import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import axiosRetry from 'axios-retry';
import { getErrorMessage } from './errorMessages';

// Generate unique request ID for error correlation
const generateRequestId = (): string => {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5050') + '/v1',
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
            console.warn(`🔄 Retry attempt ${retryCount} for ${error.config?.url}`);
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
            console.group(`🌐 ${config.method?.toUpperCase()} ${config.url} [${requestId}]`);
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

// Response Interceptor with Dev Logging and Auto-Refresh
api.interceptors.response.use(
    (response) => {
        // Dev-only response logging (4.4.1)
        if (import.meta.env.DEV) {
            console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        const { response } = error;

        // Dev-only error logging
        if (import.meta.env.DEV) {
            console.error(`❌ ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url} - ${response?.status || 'Network Error'}`);
        }

        const isLoginRequest = originalRequest?.url?.includes('/auth/login');
        const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');

        if (response) {
            // === Token Auto-Refresh Handling ===
            if (response.status === 401 && !isLoginRequest && !isRefreshRequest && !originalRequest._retry) {
                if (isRefreshing) {
                    // Queue concurrent requests while refreshing
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
                    // Call refresh endpoint - HttpOnly cookies handle token exchange automatically
                    await api.post('/auth/refresh');
                    processQueue(null);
                    
                    // Retry original request
                    return api(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError as AxiosError);
                    localStorage.removeItem('auth-storage');
                    window.location.href = '/login';
                    toast.error(getErrorMessage('SESSION_EXPIRED'));
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }

            // Fallback for 401: e.g., refresh token is expired/invalid
            if (response.status === 401 && !isLoginRequest && !isRefreshRequest) {
                localStorage.removeItem('auth-storage');
                window.location.href = '/login';
                toast.error(getErrorMessage('SESSION_EXPIRED'));
                return Promise.reject(error);
            }

            // Don't show toast for login errors (let login page handle it with detailed messages)
            if (!isLoginRequest) {
                // Suppress toast for GET + 403: background read queries that fail due to missing page permission.
                const isGetRequest = originalRequest?.method?.toLowerCase() === 'get';
                const isForbidden = response.status === 403;

                if (isGetRequest && isForbidden) {
                    // Silently reject
                    return Promise.reject(error);
                }

                // Use centralized error messages
                const errorCode = response.data?.errorCode || response.data?.code;
                const serverMessage = response.data?.message;
                const displayMessage = getErrorMessage(errorCode, serverMessage);
                toast.error(displayMessage);
            }
        } else if (!isLoginRequest) {
            // Network error or no response
            toast.error(getErrorMessage('NETWORK_ERROR'));
        }

        return Promise.reject(error);
    }
);

export default api;
