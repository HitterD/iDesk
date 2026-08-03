# iDesk Authentication Baseline

**Date:** 2026-08-03
**Source audit:** `docs/docs_Improvement_V7_diff.md`
**Scope:** Phase 0 flow inventory. Tidak ada perubahan runtime.

## Status classification

| Audit item | Status | Evidence |
|---|---|---|
| Timing-safe email login | `confirmed` | User tidak ditemukan return sebelum `bcrypt.compare`; `apps/backend/src/modules/auth/application/auth.service.ts:63-87`. User ditemukan menjalankan compare di `:108-110`. |
| Refresh-token replay detection | `confirmed` | Refresh JWT hanya diverifikasi lalu dicocokkan terhadap satu hash user; tidak ada `tokenId`, `familyId`, `parentId`, atau consumed marker; `auth.service.ts:250-263`, `apps/backend/src/modules/users/user-password.service.ts:40-59`. |
| IP-specific rate limit | `needs evidence` | Controller memiliki throttle endpoint login/refresh/register, tetapi implementasi key IP/trusted proxy belum ditelusuri sampai ThrottlerGuard dan deployment proxy; `apps/backend/src/modules/auth/presentation/auth.controller.ts:26-29,89-91,128-130`. |
| Password policy | `confirmed` | Register minimum 6; change minimum 8; reset minimum 8/max 72; `apps/backend/src/modules/auth/presentation/dto/register.dto.ts:4-20`, `change-password.dto.ts:4-13`, `apps/backend/src/modules/users/dto/reset-password.dto.ts:4-10`. Complexity/common-password/user-info policy belum ada di DTO yang dibaca. |
| Redis provisioning | `confirmed` | Redis service sudah ada di `docker-compose.yml` dan `docker-compose.db.yml`; production authentication, internal-only exposure, authenticated healthcheck, backup/restore belum lengkap. |
| Redis refresh storage | `confirmed` | `UserPasswordService.setCurrentRefreshToken()` menyimpan bcrypt hash ke kolom `users.hashedRefreshToken`; `user-password.service.ts:40-43`, `apps/backend/src/modules/users/entities/user.entity.ts:80-82`. |
| User entity duplication | `confirmed` | Auth domain memiliki runtime `User` berbeda dari TypeORM `users.User`; `apps/backend/src/modules/auth/domain/user.entity.ts`, `apps/backend/src/modules/users/entities/user.entity.ts`. |
| AuthService coupling | `confirmed` | AuthService menangani password, email/NIK validation, HRIS, JWT, refresh state, audit, register; `apps/backend/src/modules/auth/application/auth.service.ts:21-285`. |
| Fire-and-forget audit | `confirmed` | `auditService.logAsync()` dipanggil tanpa `await`/explicit rejection handling pada password/login/logout paths; `auth.service.ts:46-54,74-81,92-100,112-119,230-239,268-275`. |
| HRIS timeout | `confirmed` | Axios client memiliki timeout 10 detik; `verifyPassword()` menangkap semua error dan mengembalikan `null`; retry dipakai untuk GET employee; `apps/backend/src/modules/hris-gateway/hris-gateway.adapter.ts:27-29,35-43,58-85`. Outage classification/fail-closed behavior perlu integration verification. |
| Backend port mismatch | `confirmed` | App listen `5050`; Dockerfile/Compose audit evidence menyebut `3001`; README menggunakan `5050`; `apps/backend/src/main.ts:260-262`, `docs/KUBERNETES_DEPLOYMENT.md:43-54`. |
| Health Redis status | `confirmed` from prior inspection | `HealthService.checkRedisHealth()` selalu mengembalikan `disabled` ketika Redis enabled; implementation fix masuk Phase 2. |
| API versioning | `confirmed` | `main.ts` sudah mengaktifkan URI versioning default `1`; route/client compatibility inventory masih diperlukan sebelum mengklaim seluruh endpoint konsisten; `apps/backend/src/main.ts:48-52`. |
| GraphQL | `needs evidence` | Audit merekomendasikan GraphQL, tetapi kebutuhan consumer dan bounded read-only use case belum dibuktikan. |
| OpenTelemetry | `needs evidence` | Audit merekomendasikan tracing, tetapi dependency/runtime/exporter inventory belum dilakukan. |
| Developer documentation portal | `needs evidence` | Audit menyebut portal dokumentasi; kebutuhan consumer, ownership, dan scope belum dibuktikan. |

## Flow matrix

### Email login

1. `LocalStrategy.validate(email, pass)` memanggil `AuthService.validateUserWithDetails`; `apps/backend/src/modules/auth/infrastructure/strategies/local.strategy.ts:28-53`.
2. Identifier yang mengandung `@` dipakai sebagai email tanpa normalisasi email sebelum lookup; `auth.service.ts:63-69`.
3. User lookup memakai `UsersService.findByEmail`.
4. User tidak ditemukan langsung mengaudit dan return `USER_NOT_FOUND`; bcrypt tidak dipanggil; `auth.service.ts:71-87`.
5. User disabled return `ACCOUNT_DISABLED` sebelum password compare; `auth.service.ts:89-105`.
6. User aktif menjalankan `bcrypt.compare`; salah password return `WRONG_PASSWORD`; `auth.service.ts:108-125`.
7. Sukses menghapus property `password` dari result; `auth.service.ts:128-133`.
8. Controller memanggil `login`, set access/refresh HttpOnly cookies, set CSRF cookie, lalu response hanya user dan expiry; `apps/backend/src/modules/auth/presentation/auth.controller.ts:26-62`.

### NIK/HRIS login

1. Identifier tanpa `@` masuk `validateNikUser(identifier.trim(), pass)`; `auth.service.ts:63-65`.
2. `HrisGatewayAdapter.verifyPassword` dipanggil; return `null` untuk error transport dan result untuk response gateway; `apps/backend/src/modules/hris-gateway/hris-gateway.adapter.ts:58-65`.
3. `valid=false` dipetakan ke `USER_NOT_FOUND`; `eligible=false` ke `ACCOUNT_DISABLED`; `auth.service.ts:136-144`.
4. User lokal dicari berdasarkan employee ID. Jika HRIS tidak match tetapi user ada, local bcrypt fallback dijalankan; `auth.service.ts:146-154`.
5. Jika user belum ada dan authenticated, employee diambil lalu diprovision; `auth.service.ts:156-162`.
6. Disabled lokal dicek setelah provisioning/lookup; `auth.service.ts:164-169`.
7. Outage/error classification dan keputusan fallback harus dikunci sebelum perubahan Phase 1. Default design: fail closed.

### Refresh

1. Controller mengambil `req.cookies.refresh_token`; tidak ada token, return 401; `auth.controller.ts:89-99`.
2. Service memverifikasi JWT dan memastikan `decoded.type === 'refresh'`; `auth.service.ts:250-254`.
3. User/refresh state dicocokkan dengan bcrypt hash di `users.hashedRefreshToken`; `auth.service.ts:255-256`, `user-password.service.ts:49-58`.
4. Sukses memanggil `login()` dan menulis refresh hash baru; old token tidak memiliki consumed/family state; `auth.service.ts:258-259`, `:216-229`.
5. Semua error dipetakan ke generic `UnauthorizedException`; `auth.service.ts:260-262`.

### Logout

1. Guard JWT melindungi route; controller memanggil `AuthService.logout`; `auth.controller.ts:64-70`.
2. Service menghapus satu `hashedRefreshToken` user lalu audit; `auth.service.ts:265-276`.
3. Controller clear access/refresh cookie memakai option yang diduplikasi dari `COOKIE_OPTIONS`; `auth.controller.ts:72-84`.

### Password change

1. AuthService mencari user, membandingkan current password, hash password baru, update password, dan clear `mustChangePassword`; `auth.service.ts:31-45`.
2. Refresh session belum di-invalidasi pada method ini; session invalidation masuk Phase 1.
3. Audit dipanggil fire-and-forget; `auth.service.ts:46-54`.
4. Endpoint auth memakai JWT guard dan throttle; `auth.controller.ts:135-145`.

### Password reset

1. Admin/agent route menerima `ResetPasswordDto`; `apps/backend/src/modules/users/users.controller.ts:263-275`.
2. DTO saat ini hanya memvalidasi string, min 8, max 72; `apps/backend/src/modules/users/dto/reset-password.dto.ts:4-10`.
3. Service hash password, set `mustChangePassword=true`, audit fire-and-forget; `apps/backend/src/modules/users/user-password.service.ts:65-89`.
4. Reset belum meng-invalidasi seluruh refresh sessions; masuk Phase 1.

### Account disable

1. Admin route memanggil `UsersService.toggleUserStatus`; `apps/backend/src/modules/users/users.controller.ts:251-260`.
2. HRIS disable flow meng-update `isActive=false`; `apps/backend/src/modules/hris-gateway/hris-sync.service.ts:180-210`.
3. Session invalidation saat disable belum menjadi bagian verified auth contract; perlu ditambahkan dan diuji pada Phase 1.

## Current compatibility contract

- Backend listener: `5050` dari `apps/backend/src/main.ts:260-262`.
- API route versioning: URI versioning, default version `1`; `main.ts:48-52`.
- Auth controller prefix: `auth`; routes login/logout/refresh/csrf-token/register/change-password; `auth.controller.ts:21-145`.
- Cookie names: `access_token`, `refresh_token`; `auth.controller.ts:13,46-49`.
- Cookie current options: `httpOnly: true`, production `secure`, `sameSite: 'strict'`, `path: '/'`; `auth.controller.ts:14-19`.
- Access expiry: staff role set `8h`, other roles `1h`; `auth.service.ts:200-214`.
- Refresh expiry: standard `7d`, remember-me `90d`; `auth.service.ts:216-226`.
- Login error codes: `USER_NOT_FOUND`, `WRONG_PASSWORD`, `ACCOUNT_DISABLED`; `auth.service.ts:15-19`, `local.strategy.ts:31-50`.
- Login response: controller returns `user`, `expiresIn`, `expiresAt`; token values are intended for cookies, not JSON; `auth.controller.ts:57-61`.
- Passwords are not normalized silently. Identifier normalization may be added only for email/NIK.
- Refresh tokens must never be logged, returned in public JSON, or stored raw after migration.

## Smoke commands

Run from repository root. Use test credentials only through environment variables; do not place secrets in command history or docs.

```bash
npm run test --prefix apps/backend -- --runInBand src/modules/auth/application/auth.service.spec.ts src/modules/auth/application/auth.service.hris.spec.ts
npm run build --prefix apps/backend
npm run test --prefix apps/frontend -- --runInBand
npm run build --prefix apps/frontend
```

```bash
docker compose config
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:5050/health/live
docker compose down
```

Expected baseline note: no runtime hardening is claimed from this document. Phase 0 evidence records current behavior only; Phase 1 must add failing regression tests before security changes.
