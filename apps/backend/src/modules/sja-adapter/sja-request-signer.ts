import * as crypto from 'crypto';

/** Nama variabel lingkungan yang memuat kredensial S2S ke SJA Notification Center. */
export const SJA_APP_ID_ENV = 'SJA_APP_ID';
export const SJA_APP_SECRET_ENV = 'SJA_APP_SECRET';

/**
 * Panjang minimum secret HMAC; harus sama dengan MIN_SECRET_LENGTH di
 * apps/sja-backend/src/modules/auth/services/app-credential.service.ts.
 * Secret pendek membuat brute-force offline atas tanda tangan menjadi praktis.
 */
export const MIN_SJA_SECRET_LENGTH = 32;

export interface SignedSjaRequest {
  /**
   * Body yang SUDAH diserialisasi. Wajib dikirim apa adanya — guard di sisi SJA
   * memverifikasi `${timestamp}.${rawBody}`, sehingga men-stringify ulang objek
   * yang sama berisiko menghasilkan byte berbeda dan tanda tangan ditolak.
   */
  body: string;
  headers: Record<string, string>;
}

/**
 * Menandatangani payload untuk endpoint server-to-server SJA.
 *
 * Fail-closed: tanpa secret yang layak, lebih baik melempar daripada mengirim
 * permintaan tanpa tanda tangan yang pasti ditolak guard (CLAUDE.md §8 —
 * dilarang menaruh secret bawaan di dalam kode).
 */
export function signSjaRequest(
  payload: unknown,
  options: { appId?: string; secret?: string } = {},
): SignedSjaRequest {
  const appId = (options.appId ?? process.env[SJA_APP_ID_ENV] ?? 'idesk').trim();
  const secret = (
    options.secret ??
    process.env[SJA_APP_SECRET_ENV] ??
    process.env.IDESK_APP_SECRET ??
    ''
  ).trim();

  if (!secret) {
    throw new Error(
      `${SJA_APP_SECRET_ENV} belum diset — pengiriman ke SJA Notification Center dinonaktifkan`,
    );
  }
  if (secret.length < MIN_SJA_SECRET_LENGTH) {
    throw new Error(
      `${SJA_APP_SECRET_ENV} terlalu pendek (<${MIN_SJA_SECRET_LENGTH} karakter) — pengiriman ke SJA Notification Center dinonaktifkan`,
    );
  }

  const timestamp = Date.now().toString();
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'x-sja-app-id': appId,
      'x-sja-timestamp': timestamp,
      'x-sja-signature': signature,
    },
  };
}
