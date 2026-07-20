# Desain: Login NIK HRIS via API Gateway

**Tanggal:** 2026-07-20
**Status:** Approved (desain disetujui user, spec menunggu review)
**Branch:** refactor/zoom-calendar-redesign (implementasi di branch baru)

## Tujuan

Semua karyawan bisa login ke iDesk memakai NIK HRIS yang tervalidasi ke API Gateway `10.10.6.51:27080`. Database dan login email existing tidak diubah — login NIK adalah jalur tambahan. Seluruh 4.735 karyawan HRIS di-provision ke iDesk (sync massal + auto-create saat login pertama) dengan role dan site otomatis.

## Fakta Gateway (hasil verifikasi langsung, bukan asumsi)

Base URL: `http://10.10.6.51:27080/api/v1`, header `X-API-Key` (key terdaftar untuk app "iDesk").

| Endpoint | Response terverifikasi |
|---|---|
| `GET /ping` | `{"ok":true,"appName":"iDesk"}` |
| `POST /auth/lookup` `{nik}` | `{valid, eligible, nama_karyawan, email}` — TANPA departemen/lokasi |
| `POST /auth/verify` `{nik, password}` | `{valid, eligible, match}` (HTTP 201) |
| `GET /employees?page=N` | `{data: [50 rows], total: 4736}`; 95 halaman; ~80 detik full fetch; param `limit`/`offset` TIDAK didukung |
| `GET /employees/:nik` | Detail lengkap satu karyawan (termasuk `nama_departemen`, `lokasi`) |

Field per karyawan: `nik_hris, nik_santos, nama_karyawan, id_departemen, nama_departemen, nama_jabatan, email, lokasi, tgl_bergabung, tgl_keluar, level_jabatan, ...`

Distribusi lokasi: SJA-1 (1857), SJA-2 (1626), SJA-SMG (873), SJA-JKT (191), SJA-3 (187), null (1).

## Keputusan yang dikunci

1. **Password:** verify ke Gateway `/auth/verify` dulu; Gateway down ATAU `match:false` → fallback bcrypt compare password lokal (default `123456`).
2. **Mapping site** (`lokasi` HRIS → `Site.code` iDesk): `SJA-1→SPJ`, `SJA-3→SPJ`, `SJA-2→KRW`, `SJA-SMG→SMG`, `SJA-JKT→JTB`. Lokasi tak dikenal/null → `siteId = null`.
3. **Mapping role** (`nama_departemen`):
   - Diawali `SECURITY & NETWORK INFRASTURCTURE` (pusat + semua AREA) → `AGENT_OPERATIONAL_SUPPORT`
   - Sama dengan `INFORMATION SYSTEM DEVELOPMENT` → `AGENT_ORACLE`
   - Lainnya (termasuk `ICT` demo, `ICT KARAWANG TEST`, `MARKETING INFORMATION SYSTEM`) → `USER`
4. **Provisioning:** sync massal (tombol admin + cron harian) + just-in-time saat login NIK pertama.
5. **Identitas:** `User.employeeId` = `nik_hris` (kolom sudah ada, tidak perlu migration).
6. **UI:** satu field login "NIK / Email" — input mengandung `@` = jalur email lama, selain itu = jalur NIK.
7. Login email existing dan semua user existing TIDAK berubah.

## Arsitektur

### Modul baru: `apps/backend/src/modules/hris-gateway/`

**`hris-gateway.adapter.ts`** — HTTP client axios (pola `zoom-api.adapter.ts`). Env:

```
HRIS_GATEWAY_BASE_URL=http://10.10.6.51:27080/api/v1
HRIS_GATEWAY_API_KEY=<key>   # di .env, JANGAN hardcode/commit
```

Method: `ping()`, `verifyPassword(nik, password)`, `getEmployee(nik)`, `getEmployeesPage(page)`. Timeout 10 detik, retry 2x untuk GET (Gateway teramati kadang drop koneksi / HTTP 000).

**`hris-mapping.ts`** — konstanta murni `LOKASI_TO_SITE_CODE` dan fungsi `resolveRole(namaDepartemen)`. Tanpa dependency, unit-testable.

**`hris-sync.service.ts`** — `syncAll()`:
- Fetch semua halaman `/employees` (loop sampai `page*50 >= total`).
- Skip baris `tgl_keluar != null` dan `nik_hris` kosong.
- Upsert by `employeeId`:
  - **Create** (belum ada): `fullName=nama_karyawan`, `email` (kosong/duplikat → `{nik_hris}@hris.local`), `employeeId=nik_hris`, `role` via mapping, `siteId` via mapping (lookup Site by code), `departmentId` (find-or-create `Department` by `nama_departemen`, code = slug nama, siteId ikut user), `jobTitle=nama_jabatan`, `password=bcrypt('123456')`, `isActive=true`.
  - **Update** (sudah ada by employeeId): refresh `fullName`, `jobTitle`, `departmentId`, `siteId`. TIDAK menyentuh `password`, `role` (admin bisa sudah override), `email`, `isActive`.
- Return ringkasan `{created, updated, skipped, errors[]}`.
- Cron harian 02:00 WIB (`@nestjs/schedule`, sudah dipakai modul lain) + `POST /hris-sync/run` (JwtAuthGuard + role ADMIN) untuk trigger manual dari admin.

### Perubahan auth (`auth.service.ts` — satu cabang baru)

`validateUserWithDetails(identifier, pass)`:

```
identifier mengandung '@' → jalur email lama (tidak berubah)
selain itu → jalur NIK:
  1. gateway.verifyPassword(nik, pass)
     - valid:false            → USER_NOT_FOUND
     - eligible:false         → ACCOUNT_DISABLED
     - match:true             → lolos
     - match:false ATAU error/timeout Gateway → fallback:
         user lokal ada       → bcrypt.compare(pass, user.password)
         user lokal belum ada → pass === '123456' (di-bcrypt saat create)
       gagal juga             → WRONG_PASSWORD
  2. lolos → findByEmployeeId(nik)
     - ada     → cek isActive → return user
     - belum   → gateway.getEmployee(nik) → create user (mapping sama dg sync) → return
```

`LocalStrategy` tidak berubah (field `email` dipakai sebagai identifier generik). `UsersService` tambah `findByEmployeeId(nik)`. JWT, cookie HttpOnly, refresh token, CSRF, throttle (5/menit), audit log — semua reuse jalur existing.

### Frontend

`BentoLoginPage.tsx`: label field email → "NIK / Email", validasi dilonggarkan (terima string angka, bukan hanya format email). Payload request tidak berubah.

## Error handling

- Gateway down saat login NIK → fallback password lokal; user hasil sync tetap bisa login `123456`. Login tidak pernah crash karena Gateway.
- Gateway down saat JIT-create (user lolos verify tapi belum ada lokal dan `getEmployee` gagal) → create minimal dari data `verify` tidak mungkin (tak ada nama) → tolak dengan `USER_NOT_FOUND` + audit log; user tersync masuk lewat cron berikutnya.
- Sync: error per-baris dikumpulkan di `errors[]`, tidak menghentikan batch.

## Risiko yang diterima (keputusan user)

- **Fallback `123456` saat `match:false`:** password HRIS salah pun bisa login pakai `123456` selama user belum ganti password lokal. Mitigasi disarankan (di luar scope): paksa ganti password saat first login.
- Kolom `lokasi` HRIS punya 1 baris null → user tersebut tanpa site, admin lengkapi manual.

## Testing

- **Unit** (`hris-mapping.spec.ts`): tabel lokasi→site, departemen→role (termasuk varian AREA, ICT demo → USER).
- **Unit** (`auth.service.spec.ts` extend): jalur NIK — verify sukses, match:false + fallback benar/salah, Gateway timeout, JIT create.
- **Integration**: login email lama tetap jalan (regression), login NIK user tersync, login NIK user baru (JIT), `POST /hris-sync/run` role guard.
- **Manual**: sync penuh 4.735 karyawan di staging, spot-check role SNI/ISD dan site per lokasi.

## Di luar scope

- Ganti password paksa saat first login.
- Sinkronisasi penonaktifan (karyawan keluar → `isActive=false`) — bisa ditambah di sync nanti.
- SSO/token dari HRIS.
