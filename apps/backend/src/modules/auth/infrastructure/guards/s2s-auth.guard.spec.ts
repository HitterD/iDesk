import { S2sAuthGuard } from './s2s-auth.guard';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('S2sAuthGuard', () => {
  let guard: S2sAuthGuard;
  const originalSecret = process.env.SJA_INTERNAL_SECRET;
  const testSecret = 'test-s2s-internal-secret-min-32-chars-long-12345';

  beforeEach(() => {
    guard = new S2sAuthGuard();
    process.env.SJA_INTERNAL_SECRET = testSecret;
  });

  afterAll(() => {
    if (originalSecret !== undefined) {
      process.env.SJA_INTERNAL_SECRET = originalSecret;
    } else {
      delete process.env.SJA_INTERNAL_SECRET;
    }
  });

  function createMockContext(headers: Record<string, string>, body: any = {}, rawBody?: Buffer) {
    const request = {
      headers,
      body,
      rawBody: rawBody || Buffer.from(JSON.stringify(body)),
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  }

  it('rejects when secret is not configured or too short', async () => {
    delete process.env.SJA_INTERNAL_SECRET;
    delete process.env.IDESK_APP_SECRET;

    const ctx = createMockContext({ 'x-s2s-token': testSecret });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts valid x-s2s-token header', async () => {
    const ctx = createMockContext({ 'x-s2s-token': testSecret });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('accepts valid x-internal-secret header', async () => {
    const ctx = createMockContext({ 'x-internal-secret': testSecret });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects invalid x-s2s-token header', async () => {
    const ctx = createMockContext({ 'x-s2s-token': 'wrong-secret-value-that-does-not-match' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts valid HMAC-SHA256 signature', async () => {
    const body = { nik: '00061058' };
    const rawBody = JSON.stringify(body);
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', testSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const ctx = createMockContext(
      {
        'x-sja-app-id': 'ipop',
        'x-sja-timestamp': timestamp,
        'x-sja-signature': signature,
      },
      body,
      Buffer.from(rawBody),
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects expired HMAC timestamp (>5 minutes old)', async () => {
    const body = { nik: '00061058' };
    const rawBody = JSON.stringify(body);
    const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString();
    const signature = crypto
      .createHmac('sha256', testSecret)
      .update(`${oldTimestamp}.${rawBody}`)
      .digest('hex');

    const ctx = createMockContext(
      {
        'x-sja-app-id': 'ipop',
        'x-sja-timestamp': oldTimestamp,
        'x-sja-signature': signature,
      },
      body,
      Buffer.from(rawBody),
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tampered HMAC signature', async () => {
    const body = { nik: '00061058' };
    const rawBody = JSON.stringify(body);
    const timestamp = Date.now().toString();

    const ctx = createMockContext(
      {
        'x-sja-app-id': 'ipop',
        'x-sja-timestamp': timestamp,
        'x-sja-signature': '0'.repeat(64),
      },
      body,
      Buffer.from(rawBody),
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects request with missing credentials', async () => {
    const ctx = createMockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
