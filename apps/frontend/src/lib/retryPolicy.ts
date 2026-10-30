import { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

const HTTP_TOO_MANY_REQUESTS = 429;
/** Methods whose replay cannot repeat a side effect (RFC 9110 §9.2.2). */
const IDEMPOTENT_METHODS = ['get', 'head', 'options', 'put', 'delete'];

/**
 * Only idempotent requests are replayed. A POST/PATCH that failed may still have run on
 * the server (e.g. forgot-password mailed a password before a later step returned 503),
 * so replaying it repeats the side effect.
 */
export const shouldRetryRequest = (error: AxiosError): boolean => {
    const method = error.config?.method?.toLowerCase();
    if (!method || !IDEMPOTENT_METHODS.includes(method)) return false;
    // Never retry 429: retrying a rate-limited request only extends the lockout.
    if (error.response?.status === HTTP_TOO_MANY_REQUESTS) return false;
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
};
