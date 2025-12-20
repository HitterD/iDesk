import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import axiosRetry from 'axios-retry';
import { decrypt } from './crypto';
import { getErrorMessage } from './errorMessages';

// Generate unique request ID for error correlation
const generateRequestId = (): string => {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5050',
    timeout: 30000, // Increased for file uploads
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

// === 4.4.1 Request Interceptor with Dev Logging ===
api.interceptors.request.use(
    (config) => {
        // Generate and attach request ID for error correlation
        const requestId = generateRequestId();
        config.headers['X-Request-ID'] = requestId;
        (config as any).requestId = requestId;

        // Add auth token - decrypt from encrypted storage (4.3.2)
        const encryptedStorage = localStorage.getItem('auth-storage');
        if (encryptedStorage) {
            try {
                // Decrypt the storage first, then parse JSON
                const decrypted = decrypt(encryptedStorage);
                if (decrypted) {
                    const { state } = JSON.parse(decrypted);
                    if (state && state.token) {
                        config.headers.Authorization = `Bearer ${state.token}`;
                    }
                }
            } catch (error) {
                console.error('Error parsing auth storage:', error);
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

// Response Interceptor with Dev Logging
api.interceptors.response.use(
    (response) => {
        // Dev-only response logging (4.4.1)
        if (import.meta.env.DEV) {
            console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        }
        return response;
    },
    (error) => {
        const { response } = error;

        // Dev-only error logging
        if (import.meta.env.DEV) {
            console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${response?.status || 'Network Error'}`);
        }

        // Check if this is a login request - let login page handle its own errors
        const isLoginRequest = error.config?.url?.includes('/auth/login');

        if (response) {
            // Handle 401 Unauthorized - but NOT for login attempts
            if (response.status === 401 && !isLoginRequest) {
                localStorage.removeItem('auth-storage');
                window.location.href = '/login';
                toast.error(getErrorMessage('SESSION_EXPIRED'));
                return Promise.reject(error);
            }

            // Don't show toast for login errors (let login page handle it with detailed messages)
            if (!isLoginRequest) {
                // Use centralized error messages
                const errorCode = response.data?.errorCode || response.data?.code;
                const serverMessage = response.data?.message;
                const displayMessage = getErrorMessage(errorCode, serverMessage);
                toast.error(displayMessage);
            }
        } else if (!isLoginRequest) {
            // Network error or no response - but not for login (login page shows its own network error)
            toast.error(getErrorMessage('NETWORK_ERROR'));
        }

        return Promise.reject(error);
    }
);

export default api;

