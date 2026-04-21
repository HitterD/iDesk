import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

// Cookie name for CSRF token (set by backend, readable by JS)
const CSRF_COOKIE_NAME = 'csrf-token';

/**
 * Get CSRF token from cookie
 */
function getCsrfFromCookie(): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === CSRF_COOKIE_NAME) {
            return decodeURIComponent(value);
        }
    }
    return null;
}

/**
 * Hook to manage CSRF token for state-changing requests
 * 
 * Usage:
 * const { csrfToken, refreshCsrfToken, isLoading } = useCsrf();
 * 
 * The token is auto-fetched on mount and stored in cookie + state.
 * API interceptor reads from cookie, so this is primarily for initial fetch.
 */
export function useCsrf() {
    const [csrfToken, setCsrfToken] = useState<string | null>(() => getCsrfFromCookie());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refreshCsrfToken = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await api.get('/auth/csrf-token');
            const token = response.data.csrfToken;
            setCsrfToken(token);
            return token;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch CSRF token');
            setError(error);
            console.error('CSRF token fetch failed:', err);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch CSRF token on mount if not already in cookie
    useEffect(() => {
        if (!csrfToken) {
            refreshCsrfToken().catch(() => {
                // Error is already logged in refreshCsrfToken
            });
        }
    }, [csrfToken, refreshCsrfToken]);

    return {
        csrfToken,
        refreshCsrfToken,
        isLoading,
        error,
    };
}

// Export helper to get token from cookie (for use in API interceptor)
export { getCsrfFromCookie };
