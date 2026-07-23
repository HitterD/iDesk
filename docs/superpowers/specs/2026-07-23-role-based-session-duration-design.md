# Role-based Session Duration + "Keep Session Active"

## Problem

- Access token expiry flat `15m` untuk semua role (`auth.service.ts:205-207`, `getExpirationByRole` mengabaikan parameter `role`). Komentar di atasnya ("Admin/Agent 3h, User 1h") sudah basi, tidak match kode.
- Refresh token flat `7d` untuk semua role, hardcoded di 2 tempat (`auth.controller.ts:47,107`).
- Checkbox "Keep session active" di login page (`BentoLoginPage.tsx:22,269-270`) ada di UI tapi tidak pernah dikirim ke backend — dead toggle.

## Goals

1. Access token expiry per role: USER = `1h`, ADMIN/AGENT/AGENT_OPERATIONAL_SUPPORT/AGENT_ORACLE/MANAGER = `8h`.
2. Checkbox "Keep session active" berfungsi: dicentang → refresh token `90d` (bukan tanpa expiry — infinite token berisiko kalau cookie/device dicuri). Tidak dicentang → tetap `7d` seperti sekarang.
3. Durasi ini adalah access-token-expiry semantics — silent auto-refresh (`api.ts:117-148`) tetap jalan seperti sekarang, hanya lebih jarang re-issue.

## Non-goals

- Tidak mengubah mekanisme silent refresh di frontend.
- Tidak mengubah cookie flags (httpOnly, secure, sameSite).
- Tidak membuat file baru — semua perubahan di file existing.

## Design

### `auth.service.ts`

```ts
private getExpirationByRole(role: string): string {
    const AGENT_ROLES = new Set(['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'MANAGER']);
    return AGENT_ROLES.has(role) ? '8h' : '1h';
}
```

`login(user, request, rememberMe = false)`:
- `refreshExpiresIn = rememberMe ? '90d' : '7d'`.
- Refresh token payload menyimpan `rememberMe` agar saat `refreshToken()` memanggil `login()` lagi (rotasi), durasi 90 hari tidak reset ke 7 hari.
- `refreshToken(token, request)` membaca `decoded.rememberMe` dari token lama, teruskan ke `login()` saat rotasi.

### `auth.controller.ts`

- `login()`: baca `rememberMe` dari `req.body` (body request masih tersedia meski sudah lewat `LocalAuthGuard`/passport-local), teruskan ke `authService.login()`.
- Refresh token cookie `maxAge` dihitung dari `result.refreshExpiresIn` (dinamis), bukan hardcoded `7 * 24 * 60 * 60 * 1000`.
- `refresh()`: sama, `maxAge` ikut nilai dinamis dari hasil rotasi.

### `BentoLoginPage.tsx`

`handleSubmit` (line 94): kirim `rememberMe` di body:
```ts
const res = await api.post('/auth/login', { email, password, rememberMe });
```

## Test

Tambah ke `auth.service.spec.ts` (existing file, bukan file baru):
- `getExpirationByRole('USER') === '1h'`
- `getExpirationByRole('AGENT') === '8h'`, `'ADMIN'`, `'MANAGER'`, `'AGENT_ORACLE'`, `'AGENT_OPERATIONAL_SUPPORT'` → `'8h'`
- `login(user, req, true)` → refresh token payload `rememberMe: true`, `refreshExpiresIn === '90d'`
- `login(user, req, false)` / default → `refreshExpiresIn === '7d'`
- `refreshToken()` mempertahankan `rememberMe` dari token lama saat rotasi
