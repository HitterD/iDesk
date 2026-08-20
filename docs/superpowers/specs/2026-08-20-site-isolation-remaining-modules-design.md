# Site Isolation — Remaining Modules (Phase 2)

**Date:** 2026-08-20
**Branch:** `feat/email-notification-config` (isolation work lands in this PR, split commits per module)
**Previous phase:** `idesk-site-isolation-plan` (memori — ticketing + dashboard, selesai 2026-08-19)
**Status:** Design — awaiting implementation plan (`superpowers:writing-plans`)

---

## 0. Konteks & keputusan awal (dari grilling)

Daftar ini **mengikat** — jangan dinegosiasi ulang tanpa persetujuan eksplisit:

| # | Keputusan | Nilai |
|---|-----------|-------|
| D1 | Cross-site (lihat semua site) — modul umum | `ADMIN`, `MANAGER` |
| D2 | Cross-site — modul ticketing | `ADMIN`, `MANAGER`, `AGENT_ORACLE` (Oracle/K2 terpusat) |
| D3 | `AGENT_ADMIN` | site-locked |
| D4 | Legacy `siteId = NULL` | dibiarkan `NULL`, disembunyikan dari view site-locked — tidak ada migration backfill |
| D5 | Enforcement | **A — service layer, fail-closed** (gagalkan/buat tak terlihat, jangan tipu mata). `SiteGuard` tetap tidak dipakai. |
| D6 | Cakupan PR | semua modul sekaligus, satu PR, commit terpisah per modul |
| D7 | Testing | spec isolasi per modul meniru `ticket-query.site-isolation.spec.ts` |
| D8 | Found-claim | tambah kolom `siteId` + migration |
| D9 | P0 kredensial `access-request` | perbaiki sekalian dalam PR yang sama (kelas yang sama dengan lubang e-form, bukan ticketing) |
| D10 | Manager fail-open | biarkan, cukup catat sebagai risiko di spec ini |
| D11 | Output bahasa | Indonesia |

`SiteGuard` (`apps/backend/src/modules/sites/guards/site.guard.ts`) cacat fail-open dan tidak dipakai — jangan diaktifkan kembali bahkan untuk cakupan parsial.

---

## 1. Masalah

Isolasi site Phase 1 hanya menutup ticketing + dashboard. Modul lain masih dapat:

- Menampilkan atau membocorkan data lintas-site tanpa filter.
- Pada dua jalur, mendekripsi kredensial ke **siapa pun yang login**.
- Mempercayai `siteId` dari body klien saat menulis.

Audit 2026-08-19 menemukan klasifikasi berikut:

| Tingkat | Arti | Modul |
|---------|------|-------|
| **P0** | Kebocoran kredensial ke user terotentikasi mana pun (bukan sekadar lintas-site) | `access-request` (dekripsi tanpa guard), `eform-request` (semua + PDF tanpa guard) |
| **P1** | Penulisan dengan `siteId` yang dikendalikan klien → pembuatan lintas-site | `hardware-request`, bagian dari `workload` |
| **P2** | Kebocoran baca lintas-site (fail-open / fallback) | `lost-item`, `found-claim`, `notifications`, bagian dari `workload` |
| aman | Sudah benar | `tv-board`, `manager` |

Tanpa Phase 2, nilai isolasi site Phase 1 sebagian besar menjadi hiasan — musuh memilih jalur termudah.

---

## 2. Sasaran & non-sasaran

### Sasaran

- Menutup semua kebocoran lintas-site di modul P0/P1/P2 tanpa memperkenalkan jalur lintas-site baru.
- Menjaga perbedaan Oracle: `AGENT_ORACLE` tetap cross-site **hanya** di ticketing.
- Pijakan yang konsisten dan fail-closed untuk setiap query daftar dan setiap pembacaan detail tunggal.

### Non-sasaran

- Backfill data legacy (`siteId = NULL` dibiarkan, disembunyikan — D4).
- Mengubah `manager` atau `tv-board` (keduanya sudah benar; lihat §8).
- Perubahan skema apa pun selain `found_item_claims.siteId`.
- Penyapuan refactor di luar isolasi site.

---

## 3. Arsitektur

### 3.1 Aturan pijakan tunggal

Daftar `AGENT_ORACLE` **hanya** hidup di helper bersama. Tidak ada modul yang boleh menulis ulang `role === 'AGENT_ORACLE'` atau menduplikasi array cross-site.

```
site-scope.util.ts   ──►  CROSS_SITE_ROLES = [ADMIN, MANAGER]
                     ──►  TICKET_CROSS_SITE_ROLES = [...CROSS_SITE_ROLES, AGENT_ORACLE]
                          ├─► ticketing/utils/site-access.util.ts  (mengimpor, menghapus definisi lokal 13-17)
                          └─► modul lain mengimpor CROSS_SITE_ROLES / resolveSiteScope
frontend/lib/constants/  ──►  cermin frontend (menggantikan duplikasi di BentoTicketListPage:66-67, BentoTicketKanban:49-50)
```

### 3.2 Kontrak actor

Setiap service menerima `actor: SiteActor` yang diderivasi dari `req.user` (sudah membawa `siteId`; lihat `auth-user.types.ts:20-27`).

```ts
export type SiteActor = { role: UserRole; siteId: string | null };
export type SiteScope =
  | { mode: 'all' }                      // cross-site — tanpa filter
  | { mode: 'site'; siteId: string }     // site-locked dengan site
  | { mode: 'none' };                    // site-locked tanpa site → nol hasil

export function resolveSiteScope(actor: SiteActor): SiteScope;
export function assertSiteAccess(actor: SiteActor, resourceSiteId: string | null | undefined): void; // throws ForbiddenException bila tidak cocok
export function scopeKey(actor: SiteActor): string; // 'all' | siteId | 'none' — fragmen cache key
```

`mode:'none'` harus diterjemahkan menjadi `WHERE 1=0` (atau return kosong) — **jangan pernah** menjadi "tanpa filter, lihat semua".

### 3.3 Pola penegakan

- **Daftar:** terapkan filter site di sumber query. Cross-site → lewati atau sempitkan secara opsional dengan `siteId`/`siteIds` yang valid; site-locked → pin ke `siteId` milik mereka; `none` → `1=0`.
- **Baca tunggal / mutasi:** ambil record (beserta `ticket.siteId` bila isolasi lewat ticket), lalu `assertSiteAccess(actor, ticket.siteId ?? siteId)`. Lempar `ForbiddenException` — pesan tidak membocorkan keberadaan resource.
- **Tulis:** ambil `siteId` dari `actor.siteId`, bukan dari `dto.siteId`. Abaikan / tolak field `siteId` yang dikirim klien.
- **Anomali notifikasi:** hapus atau buat aman setiap fallback "bila tidak ada penerima di site, kirim ke semua site" (lihat §5.6).
- Penegakan berada di **service layer** — D5. Controller hanya meneruskan `req.user` sebagai actor dan menerapkan `RolesGuard` bila rute sebelumnya tanpa guard.

---

## 4. Helper bersama

**File baru:** `apps/backend/src/shared/core/utils/site-scope.util.ts`

Ekspor `CROSS_SITE_ROLES`, `TICKET_CROSS_SITE_ROLES`, `SiteActor`, `SiteScope`, `isCrossSiteRole`, `resolveSiteScope`, `assertSiteAccess`, `scopeKey`.

Bersama **frontend** di `apps/frontend/src/lib/constants/` (mis. `site-scope.ts`) mengekspor `CROSS_SITE_ROLES` + `isCrossSiteRole` untuk guard / filter sisi klien. Menghapus definisi duplikat di:

- `apps/frontend/src/features/client/pages/BentoTicketListPage.tsx:66-67`
- `apps/frontend/src/features/client/pages/BentoTicketKanban.tsx:49-50`
- (dan temuan `grep` lain untuk `CROSS_SITE_ROLES` / `AGENT_ORACLE` selama implementasi — tidak ada perilaku baru, hanya dedup)

**Dampak ticketing:** `apps/backend/src/modules/ticketing/utils/site-access.util.ts:13-17` berhenti mendefinisikan `CROSS_SITE_ROLES` sendiri; ia mengimpor `TICKET_CROSS_SITE_ROLES` dari helper. Fungsi yang ada (`isCrossSiteRole`, `applySiteFilter`, `canAccessTicketSite`, dst.) mempertahankan signature untuk kompatibilitas, tetapi perilaku mendelegasi ke implementasi bersama. Perubahan ini dikirim bersama helper (commit yang sama).

---

## 5. Perubahan per modul

Setiap sub-bagian mencantumkan layar yang wajib disentuh, pembenaran (tautan file:baris), dan kriteria penerimaan.

### 5.1 `eform-request` — P0

**Tautan:** `eform-request.controller.ts:33-37` (`GET /all` tanpa guard), `:45-49` (`PATCH /terms` tanpa guard), `:57-67` (`GET /:id/pdf` tanpa guard / dekripsi); `eform-request.service.ts:204-206` (`findAll` tidak terfilter), `:208-215` (`getDetails` tidak ada pengecekan), `:243-277` (`generatePdf` tidak ada pengecekan + dekripsi).

**Perubahan:**

- Controller: terapkan `RolesGuard` + `@Roles(...)` pada `GET /all`, `PATCH /terms`, dan jaga `GET /:id/pdf`. Persyaratan peran yang tepat mengikuti kontrol hak akses yang sudah ada — `findAll`/`getDetails` hanya untuk ICT/admin, `getCredentials` sudah membatasi ke `ICT_ROLES || requester`. Gunakan actor yang sama dengan service (jangan menambahkan relaksasi peran baru).
- Service:
  - `findAll(actor)` — tanpa filter untuk cross-site; sebaliknya filter ke `siteId` milik actor; `none` → kosong.
  - `getDetails(actor, id)` / `generatePdf(actor, id)` — `assertSiteAccess(theRequest.siteId)`. `generatePdf` tetap mendekripsi tetapi hanya setelah pengecekan lolos.
  - `getCredentials` sudah memeriksa `isICT || isRequester` — tambahkan `assertSiteAccess` sehingga requester lintas-site tidak dapat mencapai kredensial site lain; tetap `NotFound` vs `Forbidden` semantik yang sudah ada.
- Frontend: konfirmasi bahwa `EformAccessListPage.tsx:32,75-77` sudah membatasi `/all` ke ICT — menambahkan guard di server tidak merusak UI.

**Penerimaan:**

- `AGENT_ADMIN` di site A tidak melihat request lintas-site di `GET /all`.
- `AGENT_ADMIN` di site A tidak dapat mengambil `GET /:id/pdf` untuk id site B (403/404, tidak ada kebocoran dekripsi).
- `ADMIN`/`MANAGER` melihat semua; `GET /all?siteId=S` opsional menyempit.

### 5.2 `access-request` — P0 (kredensial)

**Tautan:** `access-request.controller.ts:57-61` (`GET /:id`), `:63-67` (`GET /ticket/:ticketId`) — keduanya tanpa `@Roles` / guard; `access-request.service.ts:73-89` (`findAll` fail-open pada `ticket.siteId`), `:98-110` (`findOne` tanpa pengecekan, dekripsi di `:108`), `:112-121` (`findByTicketId` sama di `:118`).

**Perubahan:**

- Controller: `RolesGuard` + `@Roles(...)` pada kedua `GET`. Reuse guard peran yang sudah dipakai modul untuk rute yang memerlukan hak istimewa (mis. kreasi admin); jangan memperluas akses write.
- Service:
  - `findAll(actor, filterDto)` — join `ticket`, terapkan scope (cross-site lewati/semprotkan; site-locked pin; `none` → kosong).
  - `findOne(actor, id)` / `findByTicketId(actor, ticketId)` — ambil beserta `ticket.siteId`, lalu `assertSiteAccess`.
- Tiket yang mendasari adalah pembawa `siteId` (kolom sudah ada). Tidak ada penambahan migration.

**Penerimaan:**

- Kredensial terdekripsi tidak pernah kembali ke actor lintas-site tanpa izin-role.
- `access-request` untuk ticket milik site B tidak terlihat oleh ICT site A; `ADMIN`/`MANAGER` tidak terpengaruh.

### 5.3 `lost-item` — P2

**Tautan:** `lost-item.service.ts:127-135` (`findAll` fail-open di `:133`), `:145-159` (`findOne` tanpa pengecekan).

**Perubahan:**

- Scope `findAll`/`findOne`/`findByTicketId`/`updateStatus` melalui `ticket.siteId` (entity sudah punya `ticketId:28`).
- `GET /qr/:token` tetap publik — token adalah pembawa kapabilitas, analog dengan `tv-board` dengan `tvToken`.

**Penerimaan:** laporan di site B tidak terlihat oleh actor site A; token QR tetap berfungsi tanpa otorisasi.

### 5.4 `found-claim` — P2 + migration (D8)

**Tautan:** `found-claim.service.ts:64` (`findAll` tanpa konsep site), controller `:53-59` (AGENT di any site melihat semua klaim); entity `:25-37` tanpa jalur ke site dan `lostItemReportId` nullable.

**Skema — entity baru + migration:**

- Entity `FoundItemClaim`: tambah `@Column({ type: 'varchar', nullable: true }) siteId: string | null`.
- **Gaya kolom mengikuti entitas yang sudah ada di repo ini:** `@Column` tanpa `name` → default `camelCase` `"siteId"` (sama seperti `ticket.entity.ts:111-112` dan `eform-request.entity.ts:95-102`). Jangan perkenalkan mapping `site_id` snake_case — itu akan menyimpang dari preseden.
- Migration baru `AddSiteIdToFoundItemClaims` — perhatikan **penamaan ditemukan di repo** selama verifikasi:
  - `1777200000001-LostItemFullWorkflow.ts:21-22` membuat tabel dengan kolom snake_case `"finder_id"`, `"lost_item_report_id"`.
  - `1779000000000-AddPerfIndexes.ts:13` mengindeks `"finderId"` / `"lostItemReportId"` camelCase.
  - Entity `:29` sendiri campur: `@Column() finderId` (default camelCase) vs `@JoinColumn({ name: 'finder_id' })` (snake_case).
  - Hasilnya, tidak ada migration yang gagal — mengisyaratkan tabel aktual dalam database dev kemungkinan dibuat via `synchronize` (`app.module.ts:156`), bukan via migration asli. **Langkah verifikasi wajib sebelum menjalankan/menggabungkan migration ini:**
    1. `psql` → `\d found_item_claims` dan catat nama kolom fisik nyata (mis. `finder_id` vs `finderId`, `lost_item_report_id` vs `lostItemReportId`).
    2. Sesuaikan migration ini dengan nama nyata — gunakan alias `AS` / kutip `"` sehingga berfungsi apa pun varian yang ada, dan **jangan** membuat atau memperbaiki index yang bertentangan di dalam PR ini (kecuali untuk index `siteId` baru).
    3. Jika verifikasi mengungkapkan ketidakcocokan antara migration dan skema aktual, catat sebagai anomali terpisah dan batasi migration ini hanya untuk menambahkan kolom + index `siteId`.
- DDL (gaya preseden `AddSiteIdToEFormRequests`):
  ```sql
  ALTER TABLE "found_item_claims" ADD COLUMN IF NOT EXISTS "siteId" varchar;
  -- Backfill #1: via lost item report → ticket
  UPDATE "found_item_claims" c
  SET "siteId" = t."siteId"
  FROM "lost_item_reports" r JOIN "tickets" t ON t.id = r."ticketId"
  WHERE c."lostItemReportId" = r.id AND c."siteId" IS NULL;
  -- Backfill #2: sisanya dari site penemu
  UPDATE "found_item_claims" c
  SET "siteId" = u."siteId"
  FROM "users" u WHERE c."finderId" = u.id AND c."siteId" IS NULL;
  CREATE INDEX IF NOT EXISTS "idx_found_claim_site_created" ON "found_item_claims" ("siteId", "createdAt");
  -- ATAU varian snake_case bila verifikasi di atas menunjuk snake_case:
  --   "site_id" / "finder_id" / "lost_item_report_id"
  ```
- Down: `DROP INDEX IF EXISTS "idx_found_claim_site_created"` + `DROP COLUMN IF EXISTS "siteId"` — mengikuti `AddSiteIdToEFormRequests#down`.
- `create` service: tetapkan `siteId` dari `actor.siteId` — abaikan apa pun yang datang dari body.

**Service / controller:**

- `findAll(actor)` — cross-site lewati/semprotkan, site-locked pin ke `actor.siteId`, `none` → kosong.
- `findOne`/`updateStatus` — `assertSiteAccess`.

**Penerimaan:** tanpa backfill (D4) — baris `NULL` tetap, dan site-locked tidak melihatnya, konsisten dengan data legacy lainnya.

### 5.5 `hardware-request` — P1

**Tautan:** `hardware-request/services/hardware-request-command.service.ts:79` (`siteId: dto.siteId`), `:122` (`if (dto.siteId !== undefined) …`), signature `:47`; controller `:64` membuang `req.user.siteId`; `hardware-request-query.service.ts:13-16` vs `installation-schedule.service.ts:15` (dua tipe `ActingUser`).

**Perubahan:**

- Satukan tipe actor: `.shared/hardware-site-actor.ts` (atau perluas salah satu yang ada dan hapus duplikat) menjadi `{ id: string; role: HardwareRole; userRole: UserRole; siteId: string | null }` atau setidaknya `{id, role, siteId}` — di mana keputusan lintas-site menggunakan `UserRole` asli (`req.user.role`), karena `pickRole` (`guards/hardware-role.guard.ts:21-29`) meratakan semua peran ICT-ish menjadi `ICT_STAFF`. Tipe harus membawa keduanya; menghilangkan `UserRole` akan mengunci kebijakan cross-site di balik peran yang pipih.
- Butuh `hardwareType`? **Tidak.** Cross-site untuk hardware tidak bergantung pada `hardwareType`; ia bergantung pada `UserRole` (ADMIN/MANAGER vs yang lain) — sama seperti `CROSS_SITE_ROLES` umum. Jangan memperkenalkan cabang `hardwareType` di helper situs.
- `createDraft(actor, dto)` — `siteId` dari `actor.siteId`, abaikan `dto.siteId`.
- `updateDraft` / mutasi lain — tolak field `siteId` di body, validasi kepemilikan + `assertSiteAccess`.
- Query service — `applySiteFilter` di `list` dan `getById`.

**Urutan & risiko:** 28 spec yang ada + cast `as any` di `installation.controller.ts:46,53,60,67,99,100` akan menelan galat tipe selama refactor `ActingUser` — modul ini dikerjakan **paling akhir** dan paling hati-hati (lihat §10).

### 5.6 `notifications` — P2 (anomali)

**Tautan:** `notification-center.service.ts:135-138`, `:149-152` (fallback kirim-ke-semua), `:332-334` (SQL mentah atas `hardware_requests` tanpa filter site); pemanggil langsung `eform-notification.listener.ts:59-60`.

**Perubahan:**

- `sendToRoleAtSite` — bila `!siteId`, **jangan** fallback ke `sendToRole`; log peringatan dan kembalikan `{ sent: 0 }` (atau sentri serupa). Fallback kedua "no users at site → fallback to all" juga dihilangkan (`:149-152`). Jika pemanggil yang tidak mengirim `siteId` memang dimaksudkan sebagai siaran, mereka harus memanggil `sendToRole` secara eksplisit — jangan biarkan helper lintas-site mengubah siaran selektif menjadi siaran global.
- Query items aksi yang membaca dari `hardware_requests` — lingkup berdasarkan `siteId` (join atau filter langsung).
- Tidak ada perubahan pada isi payload; hanya routing.

**Penerimaan:** e-form VPN yang disetujui di site tanpa `AGENT_ADMIN` tidak lagi menyemprotkan nama requester ke AGENT_ADMIN situs global.

### 5.7 `workload` — P1/P2

**Tautan:** `workload.service.ts:78-88` (membuat baris untuk `siteId` arbitrari), controller `:66-75` (`AGENT` dapat meneruskan `siteId`/`agentId` arbitrari).

**Perubahan:**

- Service menerima `actor`; `getAgentWorkload` pin ke `actor.siteId` untuk peran site-locked, `ADMIN`/`MANAGER` boleh melewatkan site eksplisit.
- Controller menolak param `siteId` dari peran site-locked; sumber kebenaran adalah JWT.

**Penerimaan:** `AGENT` tidak dapat lagi membuat atau menarik workload untuk site lain dengan memalsukan `siteId`.

---

## 6. Frontend

- Konsolidasi `CROSS_SITE_ROLES` ke `apps/frontend/src/lib/constants/` (atau util bersama terdekat yang sudah ada; alias `lib/constants/` sudah dipakai repo).
- Hapus definisi lokal di `BentoTicketListPage.tsx:66-67` dan `BentoTicketKanban.tsx:49-50`; grep harapan tidak ada pengecekan `role === 'ADMIN' || ...` lain yang tersebar.
- Tidak ada logika isolasi baru sisi klien di luar hal di atas — enforcement tetap di backend (D5).

---

## 7. Keamanan — cek lintas-modul (wajib ditegakkan di setiap edit)

Untuk setiap modul, verifikasi sebelum merge:

- Tidak ada secret/password/API key yang di-hardcode.
- Semua input eksternal divalidasi & disanitasi; kueri ber-parameter (no interpolasi string ke SQL/QueryBuilder).
- Jangan membuat kripto/auth kustom — pakai lib yang ada.
- Masking data sensitif di log.
- OWASP Top 10 — khususnya Broken Access Control (A01) dan Cryptographic Failures (A02) untuk jalur kredensial (`eform` PDF, `access-request` dekripsi).

Cek ini bukan doktrin terpisah — mereka adalah bagian dari definisi "selesai".

---

## 8. Keluar dari cakupan — catatan eksplisit

- **`tv-board`** — siteId diturunkan dari `tvToken` via `resolveSiteIdByToken():44-53` dan gateway dibatasi ke ruang `tv:${siteId}` (`tv-board.gateway.ts:25`). Benar berdasarkan desain; tidak ada perubahan.
- **`manager`** — `manager.controller.ts:14-15` mengunci class ke `MANAGER, ADMIN` (keduanya cross-site). Pola internal `siteIds.length ? {...} : {}` di `manager-dashboard.service.ts:88,94,122,132,182` dan `manager-reports.service.ts:133,160,180` secara teknis fail-open tetapi tidak memiliki pemanggil site-locked — dicatat sebagai risiko, tidak diperbaiki di PR ini (D10). Tambahkan `siteScopeKey()` ke kunci cache `manager-dashboard.service.ts:68` akan dibahas ulang bila peran site-locked diizinkan masuk nanti.
- Migrasi atau perbaikan skema apa pun di luar `found_item_claims.siteId`.

---

## 9. Pengujian

### 9.1 Strategi

- Satu spec isolasi per modul yang diubah, mengikuti `ticket-query.site-isolation.spec.ts` secara dekat: array `SITE_LOCKED_ROLES` / `CROSS_SITE_ROLES` tingkat-modul, matriks `it.each(SITE_LOCKED_ROLES)('pins %s to their own site', …)`, mock QueryBuilder berbasis Proxy yang terminalnya (`getManyAndCount`, `getOne`, `getMany`, …) me-resolve dan yang lainnya melakukan chaining.
- Satu `found-claim` cross-site smoke spec kecil yang melatih rantai `service → util` dengan mock minimal (pola `ticketing/__tests__/cross-site-smoke.spec.ts`).
- Suite yang ada dijalankan hijau sebelum setiap commit; regresi yang disebabkan perubahan `ActingUser` harus diperbaiki sebelum melanjutkan.

### 9.2 Cakupan yang diharapkan

| Modul | Spec baru | Sinyal |
|-------|-----------|--------|
| `site-scope` (helper) | unit untuk `resolveSiteScope` / `assertSiteAccess` / `scopeKey` | tabel kebenaran untuk `ADMIN`/`MANAGER` vs site-locked, `none` |
| `eform-request` | `eform-request.site-isolation.spec.ts` | `findAll` memfilter, `getDetails`/`generatePdf` menolak lintas-site |
| `access-request` | `access-request.site-isolation.spec.ts` | `findAll` di-scope, `findOne`/`findByTicketId` validasi + tidak ada dekripsi pada forbidden |
| `lost-item` | `lost-item.site-isolation.spec.ts` | `findAll`/`findOne` di-scope, QR dikecualikan |
| `found-claim` | `found-claim.site-isolation.spec.ts` + smoke | pin & filter `siteId`, `create` mengabaikan `dto.siteId` |
| `hardware-request` | `hardware-request.site-isolation.spec.ts` | `createDraft` mengabaikan `dto.siteId`, `list` memfilter, `getById` memvalidasi |
| `workload` | `workload.site-isolation.spec.ts` | `GET agents/:agentId` menolak `siteId` palsu |
| `notifications` | `notification-center.site-isolation.spec.ts` | `sendToRoleAtSite(null, …)` tidak fallback ke global |

### 9.3 Disiplin eksekusi

- Jalankan `jest` dengan `--runInBand`, satu file per satu (memori `test-runs-must-be-serial` — runner paralel membuat mesin host hang).
- Catatan `teacher-student` di modul yang memiliki topik silang (mis. `notifications` mengirim atas nama `eform`/`hardware`) ditangani dengan membatasi **pengirim** (pusat notifikasi), bukan setiap pendengar.

---

## 10. Rencana pengiriman

Satu commit per peluru, secara berurutan — agar revert bersifat bedah (D6). Urutan meminimalkan risiko dan blast radius:

1. **`shared/site-scope` helper + refactor `ticketing/site-access.util.ts`** — tanpa perubahan perilaku; hanya pijakan.
2. **`access-request` (P0)** — guard + filter; verifikasi dekripsi tidak pernah tercapai pada penolakan lintas-site.
3. **`eform-request` (P0)** — guard + filter; termasuk PDF.
4. **`lost-item` + `found-claim`** — termasuk migration `AddSiteIdToFoundItemClaims` (dengan langkah verifikasi nama kolom di §5.4).
5. **`workload`** — validasi controller.
6. **`notifications`** — hapus fallback lintas-site.
7. **`hardware-request` (P1, terakhir)** — actor unification hati-hati; jalankan 28 spec di antaranya.
8. **Frontend dedup** — `CROSS_SITE_ROLES` konsolidasi, hapus duplikasi, verifikasi UI tidak berubah.

Setiap commit menjalankan lint + `jest --runInBand`; tidak ada perubahan lintas modul di dalam satu commit kecuali dependensi eksplisit (mis. helper + ticketing).

---

## 11. Keputusan yang tertunda & anomali yang dicatat

- **Verifikasi nama kolom (wajib):** sebelum mendaratkan migration §5.4, periksa skema fisik `found_item_claims` untuk memutuskan kutipan `camelCase` vs `snake_case`. Jangan berasumsi; jika ada ketidakcocokan antara migration dan tabel nyata, catat anomali baru dan batasi migration ini hanya pada penambahan `siteId`.
- **Kunci cache `manager-dashboard.service.ts:68`:** tetap `projectId`-only. Penambahan `siteScopeKey()` akan dibahas ulang bila peran site-locked diizinkan.
- **`SiteGuard` tetap mati.** Jangan hidupkan kembali bahkan sebagian.

---

## 12. Kriteria penerimaan PR

- [ ] Setiap jalur daftar dan jalur baca-tunggal yang tercantum di §5 lolos matriks isolasinya untuk setiap `SITE_LOCKED_ROLES`, dan `ADMIN`/`MANAGER` mempertahankan akses cross-site (AGENT_ORACLE hanya di ticketing).
- [ ] `GET /access-request/:id` dan `/ticket/:ticketId` menolak lintas-site sebelum dekripsi.
- [ ] `GET /eform-request/all` dan `GET /:id/pdf` menolak lintas-site; `AGENT_ADMIN` tetap bisa membaca `/all` tetapi hanya untuk site mereka sendiri.
- [ ] `found_item_claims` memiliki kolom & index `siteId`; backfill dua tahap dijalankan; `NULL` tetap disembunyikan (D4).
- [ ] `hardware-request` `createDraft`/`updateDraft` menolak `siteId` yang dikirim klien; tidak ada pembuatan atau penarikan `siteId` lintas-site.
- [ ] `notification-center.sendToRoleAtSite(null, …)` tidak melakukan fallback ke siaran global.
- [ ] `workload` menolak `siteId` yang dipalsukan untuk peran site-locked.
- [ ] Tidak ada `SiteGuard` yang diaktifkan; tidak ada handler fallback fail-open baru.
- [ ] Spec isolasi baru lolos `--runInBand`, satu file per satu; suite yang ada tetap hijau.
- [ ] Cek keamanan §7 ditegakkan; tidak ada secret/password/API key yang di-hardcode.

---

*Spec ini adalah sumber kebenaran untuk Phase 2. Perubahan memerlukan persetujuan eksplisit — jangan mendorong batasan (D1–D4) atau menambahkan migration di luar §5.4 tanpa keputusan baru.*
