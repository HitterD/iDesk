import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { shouldRetryRequest } from '../retryPolicy';

const errorFor = (method: string, status?: number, code = 'ERR_BAD_RESPONSE'): AxiosError => {
    const config = { method, headers: new AxiosHeaders() };
    const response = status === undefined
        ? undefined
        : { status, statusText: '', headers: {}, config, data: {} };
    return new AxiosError('failed', status === undefined ? 'ERR_NETWORK' : code, config, {}, response);
};

describe('shouldRetryRequest', () => {
    it('retries safe reads that hit 503', () => {
        expect(shouldRetryRequest(errorFor('get', 503))).toBe(true);
    });

    // A replayed POST repeats its side effect: forgot-password mailed a new temporary
    // password on every replay, so the first emails carried passwords that no longer worked.
    it.each(['post', 'patch'])('never replays a %s, even on 503', (method) => {
        expect(shouldRetryRequest(errorFor(method, 503))).toBe(false);
    });

    it('never retries 429', () => {
        expect(shouldRetryRequest(errorFor('get', 429))).toBe(false);
    });

    it('retries reads that failed at the network level', () => {
        expect(shouldRetryRequest(errorFor('get'))).toBe(true);
    });
});
