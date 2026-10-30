import type { AxiosResponse } from 'axios';
import { withSharedSessionLock } from './sharedSessionLock';

const COOKIE_LOCK = 'idesk-auth-cookie';
export class SessionCoordinationUnavailableError extends Error {
    constructor() {
        super('Browser ini tidak mendukung koordinasi sesi aman. Gunakan browser terbaru melalui HTTPS lalu coba lagi.');
        this.name = 'SessionCoordinationUnavailableError';
    }
}
let operationQueue: Promise<unknown> = Promise.resolve();
let refreshFlight: { generation: number; promise: Promise<AxiosResponse> } | null = null;

/**
 * Serializes cookie requests through response handling and state application.
 * Generation guards alone cannot undo Set-Cookie: callers must keep the HTTP request
 * inside this lock. Never await refreshSession inside a coordinated login/logout
 * callback: refresh acquires this same non-reentrant lock.
 * Unsupported browsers fail closed rather than attempt a non-atomic storage mutex.
 */
export function coordinateSession<T>(operation: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
        if (typeof navigator !== 'undefined' && navigator.locks) {
            return await navigator.locks.request(COOKIE_LOCK, { mode: 'exclusive' }, operation);
        }
        if (typeof SharedWorker !== 'undefined') return withSharedSessionLock(operation);
        // localStorage cannot provide an atomic mutex. Never rotate shared cookies without a lock.
        throw new SessionCoordinationUnavailableError();
    };
    const result = operationQueue.then(run, run);
    operationQueue = result.then(() => undefined, () => undefined);
    return result;
}

export function singleFlightRefresh(
    generation: number,
    operation: () => Promise<AxiosResponse>,
): Promise<AxiosResponse> {
    if (refreshFlight?.generation === generation) return refreshFlight.promise;
    const promise = coordinateSession(operation).finally(() => {
        if (refreshFlight?.promise === promise) refreshFlight = null;
    });
    refreshFlight = { generation, promise };
    return promise;
}
