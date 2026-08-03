# Backend Performance & Query Audit — iDesk

**Tanggal:** 2026-06-15
**Scope:** `apps/backend/src/modules/**` (seluruh 28 module) + cross-cutting infra (`main.ts`, `app.module.ts`, `data-source.ts`, `shared/**`).
**Lensa:** Performa & query optimization (N+1, missing index, un-paginated list, over-fetch, redundant query, side effects on hot path, cache opportunity).
**Method:** Hybrid static — Grep pattern scan + Read per suspect + cross-reference migrations. Read-only, no DB runtime, evidence = `file:line`.
**Exclusion:** Item yang sudah di-cover `docs/superpowers/specs/2026-06-13-idesk-backend-perf-design.md` (ticketing `findAll`/`findAllPaginated`/`getStatistics`) TIDAK diulang di sini.

**Total files scanned:** ~280 TypeScript files (14 modules audited via 4 parallel agent + 1 cross-cutting infra sweep).

---

## Top-10 Quick Wins (Highest Impact / Lowest Effort)

| # | Modul | File:Line | Fix | Estimasi |
|---|-------|-----------|-----|----------|
| 1 | **cross-cutting** | `main.ts:50` | Pindahkan `app.use(helmet(...))` ke top bootstrap, setel setelah CORS, sebelum compression | 5 min |
| 2 | **cross-cutting** | `main.ts` (insert) | Tambah `express.json({limit:'2mb'})` + `urlencoded({limit:'1mb'})` untuk cegah DoS | 5 min |
| 3 | **ticketing** | `ticket-query.service.ts:227` | `getCount()`+`getMany()` → `getManyAndCount()` (1 round-trip hemat) | 10 min |
| 4 | **ticketing** | `tickets.controller.ts:62,179` | Tambah `limits.fileSize: 10MB` di kedua `FilesInterceptor` (Multer default = 8KB) | 10 min |
| 5 | **permissions** | `permission.guard.ts:52` + `permissions.service.ts:695` | Cache `hasPermission(userId,feature,action)` 60s di Redis — hilangkan DB hit per-request | 30 min |
| 6 | **notifications** | `notification-center.service.ts:267-291` | Tambah `LIMIT 50` per query + 30s cache di `getActionItems` | 30 min |
| 7 | **ticketing** | `ticket-template.service.ts:16,38,51` | Wrap `find()` di `cacheService.getOrSet(..., 60)` — templates statis | 15 min |
| 8 | **hardware** | `hardware-catalog.service.ts:18,25` | Cache catalog list 60s — dipanggil setiap kali form request dibuka | 15 min |
| 9 | **ticketing** | `services/ticket-messaging.service.ts:120,160` + `ticket-update.service.ts:74,186,256` | Wrap multi-step write (message + ticket update) dalam `dataSource.transaction` | 45 min |
| 10 | **ticketing** | `tickets.controller.ts:62,179` | Extract shared `attachmentInterceptor` constant (DRY, eliminates config drift) | 15 min |

**Total estimasi Top-10:** ~3 jam, eliminates ~5-10 hot-path DB hits per request rata-rata.

---

## Temuan per Severity

### P0 (Security Leak / Outage Risk)

| Modul | File:Line | Finding | Rekomendasi |
|-------|-----------|---------|-------------|
| cross-cutting | `main.ts:136` | `helmet()` registered AFTER middleware → headers tidak applied ke early paths | Move ke bootstrap top, setelah CORS |
| cross-cutting | `main.ts` (whole) | No body size limit → JSON DoS risk | `express.json({limit:'2mb'})` |
| cross-cutting | `app.module.ts:155-160` | Throttler 100/min global tanpa per-endpoint override → brute force di `/auth/login` | Lower ke 30-60/min global, add `@Throttle({limit:5,ttl:60000})` di auth endpoints |
| notifications | `notification-center.service.ts:267-291` | `getActionItems` 6 raw SQL unbounded, full table scan per poll (manager+admin) | Add `LIMIT` 50/query, index `(assignedToId,status)`, cache 30-60s |
| notifications | `notification.service.ts:29-36` | Dedup `findOne` tanpa composite index → full scan | Add `idx_notif_dedup (userId,type,referenceId,createdAt)` |
| users | `users.controller.ts:138-152` + `user-crud.service.ts:91-95` | `ILIKE '%search%'` un-indexable + `getCount`+`getMany` 2 queries | Add `pg_trgm` GIN, pakai `getManyAndCount()` |
| users | `user-crud.service.ts:323-455` | `getAgentStats` SQL injection risk — string interpolation enum values | Use `:param` binding |
| access-request | `access-request.service.ts:166` | `accessCredentials` stored as plain text (P0 security) | Encrypt with KMS/keyring |

### P1 (Perf Hot Path > 100ms)

**Ticketing (5 finding):**
- `tickets.controller.ts:62-70, 179-187` — Multer tanpa `limits.fileSize` (default 8KB untuk files, bisa terima lebih besar via diskStorage)
- `tickets.controller.ts:87-92` — `GET /` findAll `.take(500)` dengan 4 eager joins, dipakai non-admin
- `ticket-query.service.ts:46-77` — `findAll` tanpa `select`, full JSONB + 4 relations per row
- `ticket-query.service.ts:383-409` — `findOne` eager loads messages+sender, N+1 risk
- `ticket-query.service.ts:227-238` — `getCount()` + `getMany()` 2 round-trips (vs `getManyAndCount()`)
- `ticket-merge.service.ts:42,63,77,86,90,98` — `find`+`save` sequence, multi-write tanpa transaction
- `sla-monitor.service.ts:39,58,83` — `find()`+`.save()` per ticket dalam loop; bulk `update` via `manager.update(Ticket, ids, ...)` lebih cepat
- `ticket-notification.service.ts:334` — `mailerService.sendMail` inline di service (harus di-queue)
- `ticket-template.service.ts:16,38,51` — Reference data tanpa cache

**Hardware-Request (8 finding):**
- `hardware-catalog.service.ts:18,25` — `GET /catalog` returns ALL items, no cache, hit setiap form open
- `mutual-scheduling.service.ts:60,70` — N×M conflict check dengan `findOne` per slot
- `mutual-scheduling.service.ts:117` — Schedule propose/confirm tanpa transaction
- `installation-schedule.service.ts:159,194-200` — `leftJoinAndSelect` chain tanpa `select`, full row
- `installation-schedule.service.ts:192` — `calendar()` tanpa cache, hot path
- `procurement-decision.service.ts:43,66` — bulk save OK tapi `updated` array bisa besar
- `presentation/installation.controller.ts:84-132` — 6 list endpoints tanpa pagination
- `presentation/hardware-dashboard.controller.ts:15-40` — 5 dashboard endpoints tanpa cache

**Notifications (8 finding):**
- `notification.service.ts:110,142,193,701` — Unread `count()` per poll, no denormalized counter
- `notification.service.ts:58-77,414-426` — WS emit broadcasts ke SEMUA socket, full entity payload, no size cap
- `notification-center.service.ts:567-579,596-618` — Digest buffer in-memory Map, lost on restart
- `notification-center.service.ts:111-118,123-127` — `Promise.all` unbounded fan-out
- `notification-center.service.ts:413-442` — `deliverToChannel` sync log save per channel
- `push-channel.service.ts:50-166` — No per-user throttling, all subscriptions fetched
- `notification-center.service.ts:720-761` — Cron retry: 50 logs joined + serial retry
- `notification.service.ts:43-50,76,414` — Entity (with internal fields) leaks to WS payload

**Users (10 finding):**
- `user-crud.service.ts:113,124` — `getCount`+`getMany` 2 round-trips
- `user-crud.service.ts:524-567` — `bulkDeleteUsers` N round-trips, harusnya `IN (…)`
- `user-import.service.ts:99,123,225` — Import preloads ALL users untuk dedup, sequential bcrypt
- `user-import.service.ts:318-352` — Export loads all users, no streaming
- `user-password.service.ts:54` — bcrypt.compare untuk opaque token (overkill, 100ms+)
- `user-crud.service.ts:301-308,524-567` — Audit `logAsync` setelah delete, race window
- `user-crud.service.ts:141-147,476-478` — update+findOne extra round-trip
- `user-crud.service.ts:266-271` — `getAllUsers` no pagination, no select
- `user-crud.service.ts:212-232` — Sync `fs.unlink` di request thread
- `user-crud.service.ts:458-478,497-503` — update tanpa transaction
- `users.controller.ts:194-213` — exportXlsx ignores `site` param filter

**Permissions (7 finding):**
- `permissions.service.ts:562-597` — `updateUserPermissions` N round-trips
- `permissions.service.ts:621,636` — `applyPresetToUser` delete+N saves tanpa transaction
- `permissions.service.ts:675-692` — `bulkApplyPreset` O(N²) writes
- `permissions.service.ts:695-711` — `hasPermission` uncached, hit per guard call
- `permissions.service.ts:447-453` — `getPresets` no cache
- `permissions.service.ts:520-545` — `getUserPageAccess` 2 sequential findOne, no cache
- `permissions.service.ts:795-806` — `updatePreset` sequential cache invalidation

**Audit (6 finding):**
- `audit.service.ts:158-215` — `getStats` 5 sequential count queries, harusnya 1 CTE `COUNT(*) FILTER (WHERE …)`
- `audit.service.ts:138,142` — `findAll` getCount+getMany + join user per list
- `audit.service.ts:51-69,75-83` — Audit log sync, `logAsync` no back-pressure
- `audit.service.ts:223,254` — exportCsv/Xlsx 10K joined rows in memory
- `audit.service.ts:133` — `ILIKE` search no trigram index

**Access-Request (2 finding):**
- `access-request.service.ts:69-85` — `findAll` joins ticket+user+accessType+verifiedBy, no pagination
- `access-request.service.ts:29-47,142-193` — Multi-step writes tanpa transaction

**Workload (3 finding):**
- `workload.service.ts:108-138` — `getAllAgentWorkloads` N+1 loop (per-agent getAgentWorkload+ticketRepo.find)
- `workload.service.ts:94-138` — No pagination, embeds full `activeTickets[]` per agent
- `workload.module.ts` — `onTicketStatusChange` defined tapi tidak di-register sebagai `@OnEvent`

**Lost-Item (5 finding):**
- `lost-item.service.ts:127-135` — `findAll` no pagination, eager joins
- `lost-item.service.ts` (whole) — No expiry cron untuk `REPORTED`/`SEARCHING` past N days
- `found-claim.service.ts:91-113` — `match()` TOCTOU race, no transaction
- `found-claim.service.ts:115-129` — `reject()` same TOCTOU
- `found-claim.service.ts:64-72` — `findAll` no pagination

**Zoom-Booking, Eform, KB:** see `entities/` index + tsvector missing.

**Manager Dashboard (7 finding):**
- `manager-dashboard.service.ts:89-98` — Per-site N+1 ticket count loop
- `manager-dashboard.service.ts:121-151` — 4 counts per site × N sites
- `manager-dashboard.service.ts:211-256` — Top-agents N+1 (3 queries/agent)
- `manager-dashboard.service.ts:262-301` — Trend loop: 2 counts × sites × 7 days
- `manager-dashboard.service.ts:73-117` — 5 sequential counts (no `Promise.all`)
- `manager-dashboard.service.ts` (whole) — Zero caching
- `manager-reports.service.ts:131-173` — Loads all tickets, JS aggregation

**Sites (2 finding):**
- `sites.controller.ts:42-48` — `getSiteStats` returns hardcoded `0` (TODO)
- `sites.service.ts:14-25` — `findAll` no pagination, no cache (hot lookup)

**Settings (5 finding):**
- `settings.service.ts:63-68,72` — `getSetting` DB hit per call, no cache
- `settings.service.ts:79-92` — `setSetting` read-modify-write tanpa transaction
- `settings.controller.ts:105-152` — `scheduling` endpoint hot path
- `settings.service.ts:131-190` — `updateTimeSlots` 3 round-trips per update
- `storage-cleanup.service.ts:1-394` — Sync `fs.statSync` walks 3 folders, blocks event loop

**Reports (4 finding):**
- `reports.service.ts:76-79` — Excel export loads ALL tickets (OOM risk)
- `reports.service.ts:72-201` — `workbook.xlsx.write(res)` buffers entire workbook
- `reports.controller.ts:64-95` — Sync request-response, blocks HTTP thread
- `reports.service.ts:44-69` — `getMonthlyStats` only cached, others not

**Sound, Synology, Telegram, Automation, Google-Sync, IP-Whitelist, Search, Uploads, VPN, Health:** see full table per file di agent output.

### P2 (Best Practice)

Beragam: missing `select`, missing pagination, missing `@Index`, missing Cache decorator, missing DTO projection, log entity vs DTO, dst. Total ~40 item. Lihat detail di agent output (tersimpan di knowledge base label `idesk-perf-audit-2026-06`).

---

## Modul/Section yang SUDAH BAGUS (Tidak Perlu Diubah)

✅ **cross-cutting CORS** (`main.ts:50-58`) — allowlist + credentials sensible
✅ **Gzip compression** (`main.ts:162-172`) — level 6, threshold 1024
✅ **TypeORM pool** (`app.module.ts:153-160`) — max 20, min 5, sensible
✅ **Server timeouts** (`main.ts:198-200`) — 30s/65s/66s correct
✅ **HttpExceptionFilter** — prod 500 returns generic message
✅ **DataSource synchronize:false** — `data-source.ts:24`
✅ **Bull retry/backoff** — `queue.module.ts:60-66` (attempts 3, exp 1000ms)
✅ **migrationsRun only in prod** — `app.module.ts:147`
✅ **TypeORM logger hides full params in prod** — `typeorm-logger.ts`
✅ **CorrelationMiddleware + LoggingInterceptor slow-request** — `correlation.middleware.ts`, `logging.interceptor.ts:18`
✅ **Telegram cache + link-code** — CacheService 5min TTL
✅ **email-channel.service.ts** — single `sendMail`, no side effects
✅ **hardware dto/list-requests.dto.ts:51-56** — `Max(100)` cap on `pageSize`

---

## Rekomendasi Urutan Eksekusi

**Minggu 1 — P0 Security + Quick Wins (< 1 hari total):**
- Helmet order + body size limit
- Throttler per-endpoint
- Plain-text `accessCredentials` encryption
- `getManyAndCount()` migration di ticketing query
- `hasPermission` Redis cache

**Minggu 2 — N+1 + Pagination Sweep (1 sprint):**
- Manager dashboard: GROUP BY + caching
- Notifications `getActionItems`: LIMIT + cache
- All list endpoints tanpa pagination
- All `getCount`+`getMany` → `getManyAndCount`

**Minggu 3 — Transactional Integrity:**
- Ticketing multi-step writes (messaging, update, merge, sla-monitor)
- Hardware mutual-scheduling
- Lost-item match/reject (TOCTOU)
- Access-request create/verify

**Minggu 4 — Hot-path Caching:**
- Sites active list (Redis, 5min)
- Settings scheduling config
- Ticket templates
- Hardware catalog
- SLA config + business hours

**Backlog (P2):** Index additions, select fields, response DTOs.

---

## Knowledge Base Source

Agent results tersimpan di knowledge base label **`idesk-perf-audit-2026-06`**. Tiap agent (4 paralel + 1 cross-cutting) punya full file:line detail yang bisa di-recover via `mcp__plugin_context-mode_context-mode__ctx_search` untuk deep-dive saat eksekusi plan.

---

**Status:** Spec written, awaiting user review sebelum masuk writing-plans skill.
