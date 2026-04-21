# Code Review — iDesk Monorepo
**Tanggal:** 2026-04-09
**Scope:** apps/backend (NestJS), apps/frontend (React/Vite), konfigurasi root
**Stats:** 1.292 file TS/TSX, 28 modul backend, 18 feature frontend

---

## RINGKASAN EKSEKUTIF

| Severity | Jumlah | Area Utama |
|---|---|---|
| CRITICAL | 4 | Kredensial hardcoded, strict mode mati, bcrypt lemah |
| HIGH | 9 | File > 800 baris, 383 `any` type, 115 console.log |
| MEDIUM | 12 | Dependency duplikat, error handling, caching |
| LOW | 8 | Dead code, asset besar di repo |

**Build/Runtime Errors ditemukan:** 3 (lihat §6)
**BLOCKING untuk production:** Ya — minimal fix 4 CRITICAL.

---

## §1 CRITICAL — HARUS FIX SEBELUM RELEASE

### 🔴 C1. Hardcoded credentials di source tree
**File:** `apps/backend/src/debug-user.ts:13-14`
```ts
const email = 'admin@antigravity.com';
const password = 'admin123';
```
**Risk:** File bootstraping memakai password production admin di plaintext, masuk ke git & dist build.
**Fix:** HAPUS file. Pindahkan logic debug ke `scripts/` dengan `--email` arg, atau jadikan Jest test.

### 🔴 C2. Backend TypeScript strict mode DISABLED
**File:** `apps/backend/tsconfig.json`
```json
"strictNullChecks": false,
"noImplicitAny": false,
"strictBindCallApply": false,
"noFallthroughCasesInSwitch": false
```
**Risk:** 215 `any` type backend lolos tanpa warning. Sumber utama runtime error seperti `Cannot read property of undefined`. Sudah terlihat di `auth.service.ts:78`: `(user as any).isActive` — tidak ter-type-check.
**Fix:** Aktifkan strict bertahap per modul. Mulai dari `auth`, `users`, `ticketing`.

### 🔴 C3. bcrypt cost factor = 10 (lemah 2026)
**File:** `auth.service.ts:37,98`, `users.service.ts` (5 lokasi), `debug-user.ts:25`
**Risk:** Rainbow table & GPU cracking. Standar 2026: cost ≥ 12.
**Fix:** Ekstrak ke constant `BCRYPT_ROUNDS = 12` di `shared/core/config/security.config.ts`. Update semua call site. Tambahkan migrasi rehash-on-login.

### 🔴 C4. Password policy terlalu lemah
**File:** `apps/backend/src/modules/auth/presentation/dto/register.dto.ts:12`
```ts
@MinLength(6) password: string;
```
**Risk:** 6 karakter tanpa complexity check — OWASP A07:2021 violation.
**Fix:** `@MinLength(12)` + custom validator (upper/lower/digit/symbol). Tambahkan blocklist password umum.

---

## §2 HIGH — FIX SEBELUM SPRINT BERAKHIR

### 🟠 H1. File melewati batas 800 baris (coding standard §4)
| File | Lines | Problem |
|---|---|---|
| `backend/modules/telegram/telegram.update.ts` | **1939** | Monolith handler semua command |
| `frontend/features/admin/pages/BentoAdminAgentsPage.tsx` | **1498** | Page + table + modals + logic |
| `frontend/features/client/pages/BentoCreateTicketPage.tsx` | **1277** | Form multi-step inline |
| `backend/modules/telegram/telegram.service.ts` | **1170** | Service God-class |
| `backend/modules/zoom-booking/services/zoom-booking.service.ts` | **1150** | Business + HTTP + mapping |
| `frontend/features/reports/pages/BentoReportsPage.tsx` | 971 | Charts + fetch + export |
| `frontend/features/ticket-board/components/BentoTicketKanban.tsx` | 943 | Drag-drop + API + render |
| `backend/modules/users/users.service.ts` | 933 | CRUD + CSV + Excel + email |
| `frontend/features/dashboard/pages/BentoDashboardPage.tsx` | 920 | Inline DonutChart (bisa komponen) |
| `backend/modules/permissions/permissions.service.ts` | 828 | |

**Fix pattern:**
- Backend: pecah per `command` / `use-case` class (`telegram/commands/*.command.ts`)
- Frontend: ekstrak ke `components/` sibling + custom hook (`useXxx.ts`) + slice store

### 🟠 H2. 383 `any` types (backend 215, frontend 168)
Contoh kritikal:
- `auth.service.ts:14` — `user?: any` di LoginValidationResult
- `auth.service.ts:116` — `async validateUser(...): Promise<any>`
- `auth.service.ts:133` — `async login(user: any, ...)`
- `jwt.strategy.ts:42` — `async validate(payload: any)`
- `lib/api.ts:36` — `(config as any).requestId`

**Fix:** Buat `AuthenticatedUser` type + `JwtPayload` interface di `modules/auth/domain/`. Type guard di interceptor.

### 🟠 H3. 115 console.log statements
- Backend: **99** statement (termasuk di `debug-user.ts`)
- Frontend: 16 (mostly dev-guarded, tapi ada beberapa plain)

**Fix:** Ganti semua backend dengan `Logger` service yang sudah ada. Tambah ESLint rule `no-console: ['error', { allow: ['warn','error'] }]`.

### 🟠 H4. Dependency terduplikasi — dua drag-drop library
**File:** `apps/frontend/package.json`
```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2",
"@hello-pangea/dnd": "^18.0.1",
```
**Impact:** Bundle +~45KB gzipped. Maintenance double.
**Fix:** Pilih salah satu. `@dnd-kit` lebih modern & headless. Migrasi semua `@hello-pangea/dnd` konsumer.

### 🟠 H5. Puppeteer sebagai runtime dep di root
**File:** `package.json` (root)
```json
"dependencies": { "puppeteer": "^24.37.5" }
```
**Impact:** Install size +170MB unzipped, downloaded Chromium di CI.
**Fix:** Pindah ke `devDependencies`, atau pakai `puppeteer-core` + chromium system. Jika dipakai runtime (report PDF), sudah ada `pdf-generator.service.ts` — verifikasi pemakaian.

### 🟠 H6. App.tsx 507 baris — bisa dipecah
**File:** `apps/frontend/src/App.tsx`
Berisi semua lazy import + routing + QueryClient + role redirect. Ekstrak ke:
- `app/routes/admin-routes.tsx`
- `app/routes/client-routes.tsx`
- `app/providers.tsx` (QueryClient + Theme)

### 🟠 H7. `localStorage.getItem('auth-storage')` di App.tsx
**File:** `App.tsx` — `RoleBasedRedirect()`
```ts
const authData = localStorage.getItem('auth-storage');
const parsed = JSON.parse(authData);
userRole = parsed?.state?.user?.role || null;
```
**Risk:** Parse mentah tanpa schema validation. Bila storage di-tamper atau version berubah, crash.
**Fix:** Pakai Zod `safeParse`, fallback ke `/login`.

### 🟠 H8. File asset besar tersimpan di repo
- `backups.zip` — **13.3 MB**
- `iDesk Logo.png` — **4.3 MB**
- `Stylized Logotype for iDesk.png` — 86 KB (OK)

**Fix:** Pindah ke Git LFS atau `docs/assets/`, tambah ke `.gitignore`. `backups.zip` harusnya TIDAK pernah di-commit.

### 🟠 H9. `_orig.tsx` (941 baris) di repo root
Duplicate dari `BentoDashboardPage.tsx`. Dead code.
**Fix:** Delete.

---

## §3 MEDIUM — IMPROVEMENT

### 🟡 M1. CORS allow list hardcoded localhost
**File:** `main.ts:45-49`
```ts
const allowedOrigins = ['http://localhost:4050','http://localhost:5173','http://localhost:3000'];
```
Di production localhost tidak seharusnya allowed. Fix: `NODE_ENV === 'production'` ? hanya `FRONTEND_URL` : sertakan localhost.

### 🟡 M2. Port server hardcoded 5050
**File:** `main.ts:`
```ts
const server = await app.listen(5050, '0.0.0.0');
```
Fix: `process.env.PORT || 5050`. Dibutuhkan untuk PaaS (Render/Heroku/Cloud Run).

### 🟡 M3. CSRF middleware commented-out (bukan dihapus)
**File:** `main.ts` ~baris 60-85, `csrf.middleware.ts` masih dipakai untuk `setCsrfCookie` + frontend masih kirim `X-CSRF-TOKEN`. Half-state: token di-set, cookie dikirim, tapi tidak divalidasi.
**Fix:** Keputusan tegas — hapus total atau aktifkan validasi. Current setup: overhead tanpa proteksi.

### 🟡 M4. JWT expiry inkonsisten (3h staff / 1h user)
**File:** `auth.service.ts:142`
Tidak ada refresh token mechanism, user USER kena re-login tiap 1 jam. UX buruk.
**Fix:** Tambah refresh-token rotation (store hashed di DB), `access_token` 15m, `refresh_token` 7d.

### 🟡 M5. React Query `staleTime: 5000` global
**File:** `App.tsx:107`
Terlalu rendah — trigger refetch berlebihan. Notification popover pakai 30s, beberapa 5min. Inkonsisten.
**Fix:** Default 60_000 (1 menit), override per-query yang butuh realtime via WebSocket saja.

### 🟡 M6. TicketQueryService `findAll` tidak paginate
**File:** `ticket-query.service.ts:~28`
Admin query return semua ticket tanpa limit. Pada 10k+ tiket → OOM atau slow.
**Fix:** Remove method ini, force pakai `findAllPaginated`. Atau hard-limit 1000.

### 🟡 M7. No request-level DB transaction wrapper
Modul `users`, `ticketing`, `access-request` punya multi-write ops tanpa `@Transaction` atau `DataSource.transaction()`. Risk: partial writes.
**Fix:** Tambah `TransactionInterceptor` atau pakai `QueryRunner.startTransaction`.

### 🟡 M8. Error handling pakai `catch (error)` 149 lokasi
Banyak `catch` yang hanya `logger.error` lalu lanjut. Tidak re-throw, tidak kembalikan error struktur.
**Fix:** Pakai custom `BusinessException` yang sudah ada (`shared/core/errors/business.exception.ts`). Consistent error envelope.

### 🟡 M9. Bundle chunk split — charts & editor tidak lazy per-route
**File:** `vite.config.ts`
`vendor-charts` (recharts) & `vendor-editor` (tiptap) di-split sebagai chunk terpisah — bagus, tapi di-load saat route pertama yang import. Kurang: `@radix-ui/react-select` dkk dimasukkan ke `vendor-ui` (OK). Missing: `framer-motion` dipakai di LazyMotion tetapi tetap masuk vendor chunk → redundan.
**Fix:** Gunakan dynamic import untuk recharts & tiptap per komponen, bukan global vendor chunk.

### 🟡 M10. Synology module berisi 3 TODO tidak diimplementasi
**File:** `synology.service.ts:137,378,473` — mock returns.
**Fix:** Implementasikan atau hapus modul. Membingungkan untuk tim baru.

### 🟡 M11. Permission check di Frontend hanya pakai `RoleBasedRedirect`
Tidak ada per-feature permission guard di frontend. Backend sudah ada `@PageAccess`, `@FeatureAccess`. FE harus konsumsi `/me/permissions` endpoint & guard navigation.

### 🟡 M12. Dockerfile tidak multi-stage / non-root
Cek `apps/backend/Dockerfile` & `apps/frontend/Dockerfile` — belum diverifikasi multi-stage build & USER non-root. Wajib untuk container security (CIS Docker Benchmark).

---

## §4 LOW — HOUSEKEEPING

- **L1.** `.env.example` contains emoji (⚠️) — OK as doc, tetapi rules forbid emoji in code.
- **L2.** Root-level markdown berlebihan: `Improve UI UX.md`, `PLAN MOBILE.md`, `Walktrough.md`, `design_plan.md`, `implementation_plan.md`. Pindahkan ke `docs/planning/`.
- **L3.** `idesk-481813-271700b60e92.json` — Google service account di root. WAJIB `.gitignore`, saat ini tidak ada.
- **L4.** `node_modules` ter-commit di `apps/backend` (13MB+). Pastikan `.gitignore` benar.
- **L5.** `dist/` ter-commit di backend. Hapus.
- **L6.** `redis-data/` folder ter-commit? Cek.
- **L7.** Frontend `tsconfig.app.json` — `noUnusedLocals: false, noUnusedParameters: false`. Aktifkan.
- **L8.** 13 TODO comments di `telegram/*` dan `synology/*` untuk placeholder icon — bukan real TODO, rename jadi `STATUS_ICONS` constant.

---

## §5 HAL YANG BAGUS (KEEP)

✅ JWT strategy fail-fast jika `JWT_SECRET` kosong (main.ts validateEnvironment)
✅ HttpOnly cookie auth + SameSite strict (proper)
✅ Helmet + CSP (production only)
✅ Gzip compression + threshold
✅ Throttle per-endpoint (login 5/min, register 3/min)
✅ Audit log async untuk semua auth events
✅ Request correlation ID middleware
✅ Lazy loading routes + manual chunks (FE)
✅ React Query + axios-retry exponential backoff
✅ Redis + Bull queue untuk email/notification
✅ Swagger docs + API versioning

---

## §6 RUNTIME/BUILD ERRORS DITEMUKAN

### ❌ E1. Type assertion berbahaya di auth
**File:** `auth.service.ts:78`
```ts
if ((user as any).isActive === false || (user as any).status === 'DISABLED')
```
User entity harus ekspose field `isActive` / `status`. Bila tidak ada di DB schema, check selalu false → user DISABLED bisa login.
**Action:** Buka `user.entity.ts`, konfirmasi field, hapus `as any`.

### ❌ E2. `parseExpiresIn` tidak handle unit mixed
**File:** `auth.controller.ts`
```ts
private parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
```
`getExpirationByRole` return `'3h'` atau `'1h'` — OK. Tapi nilai `JWT_EXPIRES_IN` env default 60m tidak dipakai karena di-override per role. Bug: env variable di `.env.example` jadi dead config. Fix: dokumentasikan atau hormati env.

### ❌ E3. `RoleBasedRedirect` crash-safe tapi return invalid JSX fallback
**File:** `App.tsx`
```ts
} catch {
    userRole = null;
}
if (userRole === 'MANAGER') { ... }
// Jika null → fall through ke admin portal
```
User dengan invalid role (tamper) langsung masuk admin portal. Fix: default `Navigate to="/login"`.

---

## §7 REKOMENDASI PRIORITAS (SPRINT PLAN)

### Sprint 1 (CRITICAL — 2 hari)
1. Hapus `debug-user.ts`, `_orig.tsx`, `backups.zip`
2. `.gitignore`: service account JSON, `dist/`, `node_modules/`
3. bcrypt rounds → 12 (+migration)
4. Register DTO password MinLength(12) + complexity
5. Backend tsconfig: aktifkan `strictNullChecks` + `noImplicitAny` (per modul)

### Sprint 2 (HIGH — 1 minggu)
1. Split 10 file > 800 baris (per file ~4 jam)
2. Replace 99 backend console.log → Logger
3. Eliminasi 1 dari 2 dnd library
4. Puppeteer → devDep atau puppeteer-core
5. App.tsx refactor jadi routes + providers

### Sprint 3 (MEDIUM — 2 minggu)
1. Refresh token rotation
2. Transaction wrapper di service multi-write
3. FE permission guard per feature
4. Dockerfile multi-stage + USER
5. Dynamic import recharts/tiptap per-component

### Sprint 4 (Cleanup)
- Move planning docs ke `docs/`
- Hapus dead Synology TODOs atau implementasi
- Enable frontend `noUnusedLocals`
- Audit ulang 168 frontend `any` types

---

## §8 FLOW END-TO-END YANG DIVERIFIKASI

### Auth Flow ✅
```
Browser → POST /auth/login (throttled 5/min)
       → LocalAuthGuard → validateUserWithDetails()
       → bcrypt.compare (10 rounds ⚠️)
       → auditLogAsync (LOGIN_FAILED/USER_LOGIN)
       → JWT sign (role-based expiry)
       → Set HttpOnly cookie (SameSite=strict)
       → Set CSRF cookie (tapi validator disabled ⚠️)
       → 200 + { user, expiresIn }
```
**Masalah:** bcrypt cost lemah, CSRF half-state.

### Ticket Create Flow ⚠️
`BentoCreateTicketPage.tsx` (1277 lines) → API v1/tickets → TicketingService
**Masalah:** Page monolith, error boundary ada tapi loading state belum optimistic.

### Dashboard Flow ⚠️
`BentoDashboardPage.tsx` (920 lines) → parallel useQuery
**Masalah:** staleTime 5s trigger refetch berlebihan, DonutChart inline belum memoized.

### Report PDF Flow ✅
pdf-generator.service.ts (677 lines) → Bull queue → email attach
**Masalah:** Tidak ada progress tracking ke user.

---

## §9 METRIK TARGET SETELAH FIX

| Metrik | Current | Target |
|---|---|---|
| File > 800 baris | 10 | 0 |
| `any` types | 383 | < 50 |
| console.log | 115 | 0 (log via Logger) |
| bcrypt rounds | 10 | 12 |
| Backend strict mode | off | on |
| Bundle size (main) | ? | < 300KB gzip |
| Test coverage | ? | ≥ 80% |

---

**Reviewer Notes:** Review statis tanpa menjalankan kode. Untuk konfirmasi runtime error E1–E3, perlu jalankan test suite + manual test dengan user `isActive=false`.
