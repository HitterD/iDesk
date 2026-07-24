import { describe, it, expect } from 'vitest';
import { getErrorFromResponse } from '../loginErrorMapping';

type LoginErrorBody = { message?: string | string[]; errorCode?: string };

const makeAxiosErr = (status: number | undefined, data: LoginErrorBody = {}) => ({
  isAxiosError: true,
  response: status ? { status, data } : undefined,
  message: 'mocked',
});

describe('getErrorFromResponse', () => {
  it('returns "Unable to connect to server" when no response', () => {
    const result = getErrorFromResponse(makeAxiosErr(undefined), 0);
    expect(result.message).toBe('Unable to connect to server');
    expect(result.type).toBe('error');
  });

  it('maps USER_NOT_FOUND errorCode', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { errorCode: 'USER_NOT_FOUND' }), 0);
    expect(result).toEqual({
      type: 'error',
      message: 'Account not found',
      details: 'NIK atau email tidak terdaftar dalam sistem iDesk.',
      errorCode: 'USER_NOT_FOUND',
    });
  });

  it('maps WRONG_PASSWORD with attempts remaining', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { errorCode: 'WRONG_PASSWORD' }), 2);
    expect(result).toEqual({
      type: 'error',
      message: 'Incorrect password',
      details: '2 attempts remaining.',
      errorCode: 'WRONG_PASSWORD',
    });
  });

  it('maps WRONG_PASSWORD last attempt', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { errorCode: 'WRONG_PASSWORD' }), 4);
    expect(result.details).toContain('last attempt');
  });

  it('maps ACCOUNT_DISABLED', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { errorCode: 'ACCOUNT_DISABLED' }), 0);
    expect(result.message).toBe('Account suspended');
  });

  it('maps 423 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(423, { message: 'Locked' }), 0);
    expect(result).toEqual({
      type: 'warning',
      message: 'Security lock active',
      details: 'Too many attempts. Wait 15 minutes.',
    });
  });

  it('maps 429 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(429, {}), 0);
    expect(result).toEqual({
      type: 'warning',
      message: 'Rate limit exceeded',
      details: 'Wait 60 seconds.',
    });
  });

  it('maps 500 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(500, {}), 0);
    expect(result.message).toBe('Server unavailable');
  });

  it('maps 502 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(502, {}), 0);
    expect(result.message).toBe('Server unavailable');
  });

  it('maps 503 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(503, {}), 0);
    expect(result.message).toBe('Server unavailable');
  });

  it('maps 400 with array message', () => {
    const result = getErrorFromResponse(makeAxiosErr(400, { message: ['field1', 'field2'] }), 0);
    expect(result.details).toBe('field1, field2');
  });

  it('maps 401 with custom message', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { message: 'Token expired' }), 0);
    expect(result.message).toBe('Token expired');
  });

  it('maps 403 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(403, {}), 0);
    expect(result.message).toBe('Access denied');
  });

  it('falls back to "Authentication Error" for non-AxiosError', () => {
    const result = getErrorFromResponse(new Error('boom'), 0);
    expect(result).toEqual({
      type: 'error',
      message: 'Authentication Error',
      details: 'System malfunction. Please retry.',
    });
  });

  it('falls back to default for unknown status', () => {
    const result = getErrorFromResponse(makeAxiosErr(418, { message: 'teapot' }), 0);
    expect(result.message).toBe('teapot');
  });
});
