# iDesk Backend Performance — Quick Wins Sprint (Pendekatan A)

**Tanggal:** 2026-06-13
**Status:** Draft — menunggu review user
**Branch kerja:** `perf/quick-wins-sprint`
**Scope:** Backend performance only. TypeORM/DB index, Redis cache, API endpoint (throttler/payload/compression).

---

## 1. Tujuan

Meningkatkan performance backend iDesk-main di tiga area yang paling berdampak pada latency & throughput:

1. **TypeORM query & DB index** — eliminasi N+1, tambahkan index yang hilang, optimasi pagination.
2. **Cache layer (Redis)** — caching endpoint berat dengan TTL + invalidation strategy.
3. **API endpoint** — throttler tuning, compression, payload size limit.

**Bukan tujuan (out of scope):** observability stack, Bull queue tuning, frontend bundle, microservices split.

## 2. Metrik Sukses

| Metrik | Baseline (diukur) | Target |
|---|---|---|
| p95 latency endpoint `GET /tickets` (paginated) | TBD | -30% |
| p95 latency endpoint `GET /admin/agents` | TBD | -25% |
| p95 latency endpoint `GET /notifications/action-items` | TBD | -40% |
| Throughput k6 100 VU @ 30s | TBD | +20% |
| Error rate (5xx) selama load test | TBD | <0.5% |
| Test coverage service yang dioptimasi | 80%+ | 80%+ |

## 3. Arsitektur & Alur

```
┌──────────┐      ┌─────────────────────┐      ┌──────────────┐
│  k6 /    │─────▶│  NestJS endpoints   │─────▶│  TypeORM     │
│autocannon│ p95  │  + ThrottlerGuard   │      │  → Postgres  │
└──────────┘ ms   │  + CacheInterceptor │      └──────────────┘
                  │  + Compression      │            │
                  │  + Payload limit    │            ▼
                  └─────────────────────┘      ┌──────────────┐
                            │                  │ Redis (ioredis)
                            └─────────────────▶│ CacheManager │
                              cache get/set    └──────────────┘
```

## 4. Fase & Komponen

### Fase 1 — Audit (read-only, ~2 jam)
- Scan `apps/backend/src/modules/**` untuk pattern N+1:
  - `for`/`forEach`/`map` yang berisi `repository.find/save/insert/update/delete`.
  - `find({ relations: [...] })` tanpa `select`.
  - `findAndCount` tanpa `take/skip`.
- Scan entity di `*/entities/*.entity.ts` untuk:
  - Foreign key tanpa `@Index`.
  - Field sering di-`where`/`orderBy` tanpa `@Index`.
- Scan `*Service` untuk `cacheManager.get/set` usage — identifikasi hot keys, TTL inkonsisten, missing invalidation.
- Scan `*Controller` untuk:
  - Throttler default vs custom decorator.
  - `ParseFilePipe`/`ParseIntPipe`/`ValidationPipe` presence.
  - Response shape (over-fetching).

**Output:** `docs/perf/2026-06-13-audit-tickets.md` (markdown checklist + severity High/Med/Low).

### Fase 2 — Setup lingkungan lokal
- `docker compose -f docker-compose.db.yml up -d` (Postgres + Redis).
- `npm run migration:run --prefix apps/backend` di branch `perf/quick-wins-sprint`.
- `pg_dump` baseline → `backups/postgres/pre-perf-<ts>.dump`.
- Seed data cukup untuk simulasi beban: minimal 10k tickets, 5k users, 50k ticket messages.

**Output:** branch + env ready, dump baseline.

### Fase 3 — DB Optim (TypeORM)
- Tambah `@Index` decorator di entity (compound index untuk filter+sort kombinasi).
- Generate migration baru: `1779000000000-AddPerfIndexes.ts` — gunakan `CREATE INDEX CONCURRENTLY` (khusus Postgres) untuk hindari table lock.
- Rewrite query yang ditemukan N+1: ganti loop dengan `IN (...)` atau `QueryBuilder` dengan join+select.
- Tambah `select` eksplisit di `find()` untuk kolom besar (TipTap JSON content, attachments).

**Output:** migration file + query refactor.

### Fase 4 — Cache Opt
- Tambah `@CacheInterceptor` atau `@CacheKey`/`@CacheTTL` di controller method untuk endpoint read-heavy.
- Strategi TTL:
  - Ticket list: 60s + jitter ±10s.
  - Agent stats: 300s + invalidate on write.
  - Action items (per user): 30s + invalidate on snooze/complete.
- Cache key pattern: `entity:list:<userId>:<filterHash>:<page>`.
- Invalidation: panggil `cacheManager.del(pattern)` di service method setelah create/update/delete.
- Stampede mitigation: `cache-manager` v7 sudah handle `max` & `ttl` per key; tambahkan jitter manual via util `withJitter()`.

**Output:** decorated endpoints + invalidation hooks.

### Fase 5 — Endpoint Opt
- `main.ts`:
  - `helmet()` sudah ada — tambahkan CSP config sesuai.
  - Tambah `compression()` global middleware (cek sudah ada di `package.json` — `^1.8.1`).
  - `app.use(json({ limit: '1mb' }))` — cegah payload besar.
  - `app.use(urlencoded({ extended: true, limit: '1mb' }))`.
- Throttler:
  - Global default: 60 req/min/IP.
  - Endpoint berat (search, export): 10 req/min/IP via `@Throttle()`.
  - Endpoint auth: 5 req/min/IP via `@SkipThrottle({ default: true })` + custom.
- Pagination: wajib `take` ≤100, default 20. Hard cap di DTO `PageOptionsDto`.

**Output:** patch `main.ts` + throttle decorator.

### Fase 6 — Benchmark
- k6 script di `apps/backend/perf/`:
  - `tickets-list.js` — 100 VU, 30s ramp-up, hit `GET /tickets?page=1&limit=20`.
  - `agents-list.js` — hit `GET /admin/agents`.
  - `action-items.js` — hit `GET /notifications/action-items`.
  - `mixed-read.js` — simulasi user nyata (list → detail → list).
- Threshold: `http_req_duration: ['p(95)<300']`, `http_req_failed: ['rate<0.005']`.
- Run baseline SEBELUM fix apapun (di branch `main` checkout), simpan raw output `docs/perf/raw/baseline-*.json`.
- Run final SETELAH semua fix di branch `perf/quick-wins-sprint`, simpan `docs/perf/raw/final-*.json`.

**Output:** k6 scripts + raw JSON.

### Fase 7 — Report
- `docs/perf/2026-06-13-idesk-backend-perf-bench.md`:
  - Tabel sebelum/sesudah p50/p95/p99.
  - Top 5 endpoint paling diuntungkan.
  - Rekomendasi lanjutan (out of scope sprint ini).

**Output:** markdown report.

## 5. Data Flow Benchmark

```
1. checkout main, run k6 baseline  →  docs/perf/raw/baseline-*.json
2. checkout perf/quick-wins-sprint, run k6 final  →  docs/perf/raw/final-*.json
3. diff p95 per endpoint  →  tabel di benchmark report
```

## 6. Error Handling & Safety

- **Backup DB** sebelum migration: `pg_dump` → `backups/postgres/pre-perf-<ts>.dump`.
- **Staging branch only:** `perf/quick-wins-sprint`. Tidak merge ke `main` tanpa review + benchmark valid.
- **Rollback plan:**
  - Migration: revert dengan `npm run migration:revert` (sudah ada `down`).
  - Index: drop aman (tidak ubah data).
  - Cache: disable decorator, deploy.
  - Throttler/compression: revert `main.ts`.
- **Benchmark idempotent:** k6 ramp-up 10s, steady 20s, ramp-down 10s. VU 100 default.
- **Self-review wajib** sebelum PR: jalankan `npm run test` + smoke E2E existing.

## 7. Testing

- Unit test (Jest) — tambahkan test untuk service yang cache-nya berubah:
  - hit → return cached
  - miss → call DB
  - invalidate on write
- Coverage target: 80%+ untuk service yang dioptimasi.
- E2E: jalankan test suite existing `apps/backend/src/tests/`.
- Smoke: minimal — endpoints yang disentuh harus return 200 dengan shape tidak berubah.

## 8. Deliverable

1. Branch `perf/quick-wins-sprint` + PR.
2. Audit report: `docs/superpowers/specs/2026-06-13-idesk-backend-perf-audit.md` (di-generate saat Fase 1).
3. Design doc ini (committed).
4. Benchmark report: `docs/perf/2026-06-13-idesk-backend-perf-bench.md`.
5. k6 scripts: `apps/backend/perf/*.js` (reusable, di-commit).
6. Migration baru: `apps/backend/src/migrations/<ts>-AddPerfIndexes*.ts`.

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Cache stampede saat TTL expire | TTL jitter ±10%, staggered refresh via cron |
| Migration lock di tabel besar | `CREATE INDEX CONCURRENTLY` (Postgres) — jalankan di luar jam sibuk |
| Throttler terlalu ketat untuk bot/client internal | Tambah `@SkipThrottle` + allowlist IP via env var `INTERNAL_IPS` |
| Compression overhead CPU | `level: 6` default, threshold 1KB, exclude streaming endpoint |
| Index menambah write cost | Hanya index compound pada kolom yang sering di-query; monitor write throughput |
| Benchmark flake | Run 3×, ambil median; exclude outlier |

## 10. Out of Scope (Eksplisit)

- Observability stack (Prometheus, Grafana, OpenTelemetry).
- Bull queue throughput tuning.
- Frontend bundle size, render performance, Core Web Vitals.
- Microservices split, monorepo restructure.
- Refactor arsitektur besar (event-sourcing, CQRS).
- Penambahan fitur baru.

## 11. Timeline (Indikatif)

- Fase 1 (Audit): 2 jam
- Fase 2 (Setup): 30 menit
- Fase 3 (DB): 3-4 jam
- Fase 4 (Cache): 2-3 jam
- Fase 5 (Endpoint): 1-2 jam
- Fase 6 (Benchmark): 1 jam (termasuk 2× run)
- Fase 7 (Report): 1 jam
- **Total:** ~10-13 jam kerja

---

**Referensi:**
- TypeORM docs: https://typeorm.io/indexes
- NestJS Cache: https://docs.nestjs.com/techniques/caching
- k6 docs: https://k6.io/docs/
- iDesk project: `d:\iDesk-main`

**Catatan:** Semua klaim "baseline" di §2 adalah TBD sampai Fase 6 selesai. Angka target adalah estimasi konservatif berdasarkan optimasi standar NestJS+TypeORM — akan dikalibrasi setelah baseline run.
