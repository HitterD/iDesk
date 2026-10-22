# Round-2 redesign — verification record

Tanggal: 2026-10-22 · Branch `HitterD/redesign-mockup` · HEAD awal Task 7 `1654fbe0` · merge-base `ab74bab7`.
Plan: `docs/superpowers/plans/2026-10-21-idesk-redesign-round2.md` (Task 7). Sistem desain yang diverifikasi didokumentasikan di `DESIGN.md`.

> Screenshot dan log yang dirujuk ada di `.superpowers/` yang **di-gitignore** (`.gitignore:74`). Hanya tersedia di workspace lokal, tidak ikut commit.

## 1. Bukti dari task sebelumnya (ledger SDD)

Sumber: `.superpowers/sdd/2026-10-20-idesk-redesign-pr2/` (`progress.md`, `r2-task-{1..5,6b}-report.md`, `r2-review-3-4.md`, `r2-review-5.md`, `chat-parity-audit.md`).

| Task round 2 | Commit | Review | Pemeriksaan browser controller |
|---|---|---|---|
| 1 Foundation (font, motion, sky/navy, varian tombol, satu CTA, SegmentedControl) | `28b9c7c1` | dilipat ke review Task 2-5 | tidak (sesi habis), shell diverifikasi di Task 2 |
| 2 Antrian, Kanban, My Tickets | `0c4349bd`, `6275794d` | — | screenshot `r2t2-*`, `r2t2b-*` vs `r2t2b-mock-*` |
| 3 Detail tiket + chat | `c6ef2d62`, fix `f231160`, paritas `40763b0d` | `r2-review-3-4.md`: Needs fixes (3 Important) → fix round 1, re-review bersih | `r2t3-*`, `chatfix-*` |
| 4 Dashboard | `b9454652`, fix `f231160` | sama dengan Task 3 | `r2t4-*` |
| 5 Hardware, e-form, zoom, KB | `e4894642..4fa945be`, fix `5ab083c1` | `r2-review-5.md`: Needs fixes (I1-I5) → fix round 1, re-review bersih | `r2t5-*` |
| 6 Management/admin/settings/health | `b6359d01`, `d3b4888e`, `8ce68982`, `9bab019e`, `1654fbe0` | review ditunda ke review akhir seluruh branch (ruling di `progress.md`) | `r2t6-*`, `r2t6b-*` |

Audit paritas chat (`chat-parity-audit.md`): 1 missing + 4 degraded vs `main`; dipulihkan di `40763b0d` (badge jumlah pesan, pinned bar/koneksi mobile, hint pintasan, toast paste, counter). Typing indicator hanya diverifikasi lewat test.

Screenshot task sebelumnya: `.superpowers/shots/r2t1-*`, `r2t2-*`, `r2t2b-*`, `r2t3-*`, `r2t4-*`, `r2t5-*`, `r2t6-*`, `r2t6b-*`, `chatfix-*` (447 file).

## 2. Verifikasi fresh (Task 7)

### 2.1 Type check dan build (`apps/frontend`)

| Perintah | Hasil |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | exit 0, tanpa output (`.superpowers/r2t7-tests/tsc.log`) |
| `npm run build` | exit 0, `✓ built in 12.96s` (`.superpowers/r2t7-tests/build.log`) |

### 2.2 Unit/integration test — satu file per invocation, serial

Daftar: `git diff --name-only --diff-filter=d ab74bab7..HEAD -- 'apps/frontend/src/**/*.test.ts*'` → **128 file**. Tiap file: `npx vitest run <file> --maxWorkers=1 --no-file-parallelism`, log per file di `.superpowers/r2t7-tests/*.log`, ringkasan `summary.txt`.

**Ringkasan:** 126 file exit 0; 2 file exit 1. Total test lulus 805, gagal 2 (sebelum fix).

#### Temuan

1. **`ZoomMonthView.test.tsx` — 2 failed / 2 passed → regresi test-environment dari branch ini, sudah diperbaiki (test-only).**
   - Gagal: "shows every event when they fit…" (`Meeting 2` tidak ditemukan) dan "collapses the rest into '4 lagi'".
   - `ZoomMonthView.tsx` tidak berubah sejak test ditulis (`4b26867d`). Penyebab: `e01ffc26` (Task 1 PR2, sesudah merge-base) menambah polyfill global no-op `ResizeObserver` di `src/test/setup.ts`. Komponen (`ZoomMonthView.tsx:46-58`) lalu mengukur `clientHeight` = 0 di jsdom dan menurunkan jumlah event terlihat ke `MIN_VISIBLE_EVENTS` (1); sebelumnya `ResizeObserver` undefined sehingga default 2 dipakai.
   - Bukti: dengan `setup.ts` versi `ab74bab7` (dipulihkan sementara lalu dikembalikan), file ini **4 passed** (`zoommonth-oldsetup.log`).
   - Fix: test men-stub `ResizeObserver` = `undefined` per test (`vi.stubGlobal` + `vi.unstubAllGlobals`) sehingga menguji default tanpa pengukuran → **4 passed** (`zoommonth-fixed.log`). Kode aplikasi tidak diubah; di browser nyata pengukuran tetap berjalan.
2. **`oracle-k2-route.test.tsx` — 5/5 passed tetapi exit 1** karena 5 unhandled rejection `TypeError: useAuth.setState is not a function` dari `src/hooks/useSessionRestore.ts`. Mock `useAuth` di test (`oracle-k2-route.test.tsx:46-56`) tidak punya `setState`; `useSessionRestore` ditambahkan oleh `2c9c0a96` (fix auth, sebelum baseline PR2 `5a276380`, bukan pekerjaan redesign). **Pre-existing terhadap redesign, bukan regresi round 2; tidak diperbaiki** (di luar scope; assertion tetap lulus). Disarankan: tambah `setState`/`getState` ke mock.

#### Hasil per file

| File (`apps/frontend/src/…`) | Hasil |
|---|---|
| `components/auth/ProtectedRoute.test.tsx` | 2 passed (2) |
| `components/auth/__tests__/ProtectedRoute.test.tsx` | 8 passed (8) |
| `components/layout/__tests__/BentoSidebar.test.tsx` | 19 passed (19) |
| `components/layout/__tests__/BentoTopbar.test.tsx` | 7 passed (7) |
| `components/layout/__tests__/ClientTopbar.test.tsx` | 10 passed (10) |
| `components/notifications/__tests__/ActionCommandCenter.test.tsx` | 1 passed (1) |
| `components/notifications/__tests__/ActionRow.test.tsx` | 3 passed (3) |
| `components/notifications/__tests__/DesktopAppDownloadBanner.test.tsx` | 3 passed (3) |
| `components/notifications/__tests__/NotificationCenter.test.tsx` | 3 passed (3) |
| `components/notifications/__tests__/NotificationPermissionGate.test.tsx` | 5 passed (5) |
| `components/ui/__tests__/CannedResponses.test.tsx` | 6 passed (6) |
| `components/ui/__tests__/ExternalSourceBadge.test.tsx` | 2 passed (2) |
| `components/ui/__tests__/UserAvatar.test.tsx` | 5 passed (5) |
| `components/ui/__tests__/overlay-layering.test.tsx` | 1 passed (1) |
| `components/ui/__tests__/searchable-picker.test.tsx` | 8 passed (8) |
| `components/ui/__tests__/segmented-control.test.tsx` | 3 passed (3) |
| `components/ui/__tests__/site-selector.test.tsx` | 3 passed (3) |
| `components/ui/__tests__/ticket-dropdowns.test.tsx` | 6 passed (6) |
| `components/ui/__tests__/ticket-pill.test.tsx` | 9 passed (9) |
| `components/ui/__tests__/ticket-tokens.test.ts` | 3 passed (3) |
| `features/admin/components/data-wipe/__tests__/DataWipePage.test.tsx` | 7 passed (7) |
| `features/admin/components/system-health/__tests__/StorageForecastingTab.test.tsx` | 4 passed (4) |
| `features/admin/pages/__tests__/AuditLogPage.test.tsx` | 3 passed (3) |
| `features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx` | 5 passed (5) |
| `features/admin/pages/__tests__/SystemHealthPage.test.tsx` | 4 passed (4) |
| `features/auth/components/__tests__/ForgotPasswordDialog.test.tsx` | 4 passed (4) |
| `features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx` | 15 passed (15) |
| `features/auth/pages/__tests__/BentoLoginPage.test.tsx` | 2 passed (2) |
| `features/automation/pages/__tests__/AutomationRulesPage.test.tsx` | 2 passed (2) |
| `features/client/components/__tests__/UserGuidebookModal.test.tsx` | 6 passed (6) |
| `features/client/components/create-ticket/__tests__/TicketTypeCard.test.tsx` | 5 passed (5) |
| `features/client/components/resolution/__tests__/ResolutionFlow.test.tsx` | 8 passed (8) |
| `features/client/pages/__tests__/BentoCreateTicketPage.test.tsx` | 29 passed (29) |
| `features/client/pages/__tests__/BentoMyTicketsPage.test.tsx` | 6 passed (6) |
| `features/client/pages/__tests__/ClientArticleDetailPage.test.tsx` | 3 passed (3) |
| `features/client/pages/__tests__/ClientProfilePage.test.tsx` | 2 passed (2) |
| `features/client/pages/__tests__/ClientTicketDetailPage.test.tsx` | 8 passed (8) |
| `features/dashboard/agent/__tests__/AgentDashboardPage.test.tsx` | 5 passed (5) |
| `features/dashboard/agent/__tests__/agentDashboard.format.test.ts` | 7 passed (7) |
| `features/dashboard/components/__tests__/dashboardChart.test.ts` | 5 passed (5) |
| `features/dashboard/pages/__tests__/BentoDashboardPage.test.tsx` | 4 passed (4) |
| `features/dashboard/pages/__tests__/teamDashboard.stats.test.ts` | 8 passed (8) |
| `features/devices/__tests__/DeviceActivationPage.test.tsx` | 1 passed (1) |
| `features/hardware-request/__tests__/StatusPipeline.test.tsx` | 4 passed (4) |
| `features/hardware-request/components/__tests__/AgingTable.test.tsx` | 1 passed (1) |
| `features/hardware-request/components/__tests__/HardwareRequestsLayout.test.tsx` | 1 passed (1) |
| `features/hardware-request/components/__tests__/RequestTable.disclosure.test.tsx` | 1 passed (1) |
| `features/hardware-request/components/calendar/__tests__/StatsStrip.test.tsx` | 2 passed (2) |
| `features/hardware-request/utils/__tests__/active-schedule.util.test.ts` | 11 passed (11) |
| `features/hardware-request/utils/__tests__/schedule-slot.util.test.ts` | 3 passed (3) |
| `features/knowledge-base/components/__tests__/ArticleMarkdownViewer.test.tsx` | 6 passed (6) |
| `features/knowledge-base/components/__tests__/KnowledgeBaseLanding.test.tsx` | 7 passed (7) |
| `features/knowledge-base/pages/__tests__/BentoArticleDetailPage.test.tsx` | 4 passed (4) |
| `features/manager/pages/__tests__/AdminWorkloadDashboard.test.tsx` | 3 passed (3) |
| `features/manager/pages/__tests__/ManagerTicketsPage.filters.test.tsx` | 2 passed (2) |
| `features/notifications/hooks/__tests__/useMarkNotificationsRead.test.tsx` | 4 passed (4) |
| `features/public/hooks/__tests__/useRingtone.test.ts` | 8 passed (8) |
| `features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx` | 25 passed (25) |
| `features/public/utils/__tests__/tvBoardTime.test.ts` | 5 passed (5) |
| `features/reports/components/scheduled/__tests__/ScheduledReportsTab.test.tsx` | 2 passed (2) |
| `features/reports/pages/__tests__/BentoReportsPage.test.tsx` | 2 passed (2) |
| `features/request-center/components/eform/__tests__/EformAccessCalendar.test.tsx` | 4 passed (4) |
| `features/request-center/pages/__tests__/EformAccessCreatePage.test.tsx` | 22 passed (22) |
| `features/request-center/pages/__tests__/EformAccessListPage.test.tsx` | 2 passed (2) |
| `features/settings/components/__tests__/TvBoardSettings.test.tsx` | 3 passed (3) |
| `features/settings/pages/__tests__/BentoSettingsPage.test.tsx` | 2 passed (2) |
| `features/ticket-board/components/__tests__/AgentSelectList.test.tsx` | 6 passed (6) |
| `features/ticket-board/components/__tests__/BentoTicketKanban.test.tsx` | 11 passed (11) |
| `features/ticket-board/components/__tests__/BulkActionsBar.test.tsx` | 4 passed (4) |
| `features/ticket-board/components/__tests__/QueueCardToolbar.test.tsx` | 4 passed (4) |
| `features/ticket-board/components/__tests__/QueueTableHeader.test.tsx` | 3 passed (3) |
| `features/ticket-board/components/__tests__/ReassignConfirmDialog.test.tsx` | 7 passed (7) |
| `features/ticket-board/components/__tests__/SelectCheckbox.test.tsx` | 2 passed (2) |
| `features/ticket-board/components/__tests__/StatsCard.test.tsx` | 2 passed (2) |
| `features/ticket-board/components/__tests__/TargetDateCell.test.tsx` | 16 passed (16) |
| `features/ticket-board/components/__tests__/TicketHeader.test.tsx` | 10 passed (10) |
| `features/ticket-board/components/__tests__/TicketListRow.test.tsx` | 29 passed (29) |
| `features/ticket-board/components/ticket-detail/__tests__/AttachmentTray.test.tsx` | 3 passed (3) |
| `features/ticket-board/components/ticket-detail/__tests__/DetailTabs.test.tsx` | 3 passed (3) |
| `features/ticket-board/components/ticket-detail/__tests__/ExtendSlaModal.test.tsx` | 7 passed (7) |
| `features/ticket-board/components/ticket-detail/__tests__/MessageAttachments.test.tsx` | 5 passed (5) |
| `features/ticket-board/components/ticket-detail/__tests__/ResolveTicketModal.test.tsx` | 7 passed (7) |
| `features/ticket-board/components/ticket-detail/__tests__/SlaProgress.test.tsx` | 7 passed (7) |
| `features/ticket-board/components/ticket-detail/__tests__/SlaStatusCard.test.tsx` | 2 passed (2) |
| `features/ticket-board/components/ticket-detail/__tests__/SystemMessageEvent.test.tsx` | 7 passed (7) |
| `features/ticket-board/components/ticket-detail/__tests__/TicketChat.actions.test.tsx` | 7 passed (7) |
| `features/ticket-board/components/ticket-detail/__tests__/TicketChat.reply.test.tsx` | 6 passed (6) |
| `features/ticket-board/components/ticket-detail/__tests__/TicketChat.surface.test.tsx` | 10 passed (10) |
| `features/ticket-board/components/ticket-detail/__tests__/TicketHistory.test.tsx` | 3 passed (3) |
| `features/ticket-board/components/ticket-detail/__tests__/TicketSidebar.inspector.test.tsx` | 7 passed (7) |
| `features/ticket-board/components/ticket-detail/__tests__/priorityOptions.test.ts` | 2 passed (2) |
| `features/ticket-board/components/ticket-detail/messageThread.test.ts` | 19 passed (19) |
| `features/ticket-board/constants/__tests__/statusFilters.test.ts` | 11 passed (11) |
| `features/ticket-board/hooks/__tests__/useStatusTakeover.test.ts` | 16 passed (16) |
| `features/ticket-board/pages/__tests__/BentoMobileDevTicketsPage.smoke.test.tsx` | 4 passed (4) |
| `features/ticket-board/pages/__tests__/BentoOracleK2TicketsPage.smoke.test.tsx` | 4 passed (4) |
| `features/ticket-board/pages/__tests__/BentoTicketListPage.filters.test.tsx` | 10 passed (10) |
| `features/ticket-board/pages/__tests__/BentoWebDevTicketsPage.smoke.test.tsx` | 5 passed (5) |
| `features/zoom-booking/components/__tests__/BookingDetailsModal.test.tsx` | 6 passed (6) |
| `features/zoom-booking/components/__tests__/SimpleBookingForm.test.tsx` | 18 passed (18) |
| `features/zoom-booking/components/__tests__/ZoomAccountLegend.test.tsx` | 4 passed (4) |
| `features/zoom-booking/components/__tests__/ZoomAccountsMatrix.test.tsx` | 5 passed (5) |
| `features/zoom-booking/components/__tests__/ZoomBookingDetailView.test.tsx` | 1 passed (1) |
| `features/zoom-booking/components/__tests__/ZoomCalendarSubBar.test.tsx` | 12 passed (12) |
| `features/zoom-booking/components/__tests__/ZoomMonthView.test.tsx` | 2 failed, 2 passed (4); setelah fix test: 4 passed (4) |
| `features/zoom-booking/components/__tests__/ZoomMyBookingsView.test.tsx` | 9 passed (9) |
| `features/zoom-booking/components/__tests__/ZoomRightSidebar.test.tsx` | 7 passed (7) |
| `features/zoom-booking/hooks/__tests__/useZoomSocket.test.ts` | 3 passed (3) |
| `features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx` | 5 passed (5) |
| `features/zoom-booking/pages/__tests__/ZoomCalendarPage.booking.test.tsx` | 6 passed (6) |
| `hooks/__tests__/useDesktopNotifierSync.test.ts` | 2 passed (2) |
| `hooks/__tests__/useReloadOnAppUpdate.test.tsx` | 2 passed (2) |
| `hooks/__tests__/useSessionRestore.test.ts` | 8 passed (8) |
| `hooks/__tests__/useSessionTimeout.test.ts` | 5 passed (5) |
| `hooks/__tests__/useTicketSocket.test.tsx` | 12 passed (12) |
| `lib/__tests__/appUpdate.test.ts` | 11 passed (11) |
| `lib/__tests__/media.test.ts` | 3 passed (3) |
| `lib/__tests__/retryPolicy.test.ts` | 5 passed (5) |
| `lib/__tests__/roleHome.test.ts` | 8 passed (8) |
| `lib/__tests__/sessionApi.test.ts` | 9 passed (9) |
| `lib/__tests__/sessionCoordinator.test.ts` | 5 passed (5) |
| `lib/__tests__/sessionLockServer.test.ts` | 3 passed (3) |
| `lib/__tests__/slaCountdown.test.ts` | 5 passed (5) |
| `lib/constants/__tests__/service-scope.test.ts` | 3 passed (3) |
| `lib/file-validation.test.ts` | 17 passed (17) |
| `lib/webPush.test.ts` | 5 passed (5) |
| `router/__tests__/oracle-k2-route.test.tsx` | 5 passed (5), exit 1: 5 unhandled rejection `useAuth.setState is not a function` |
| `stores/useAuth.test.ts` | 8 passed (8) |

### 2.3 Browser smoke (Playwright MCP, route-stubbed)

Setup: Vite dev `http://localhost:4071`; `grantPermissions(['notifications'])`; `localStorage['auth-storage'] = {state:{user:{id,email,fullName,role},isAuthenticated:true,expiresAt:'2027-01-01T00:00:00Z',sessionId:'x'},version:0}`; `page.route('**/v1/**')` dengan stub yang dibentuk dari tipe API frontend dan service backend (gabungan fixture Task 3-6; generator `.superpowers/r2t7-gen.py`, skrip `.superpowers/r2t7-run-*.js`). Tiap route: tunggu 2.2s, Escape, screenshot viewport ke `.superpowers/shots/r2t7-<role>-<route>-<w>-<theme>.png` (88 file).

Metrik: **h1** = ada `<h1>` dan bukan error boundary; **ov** = `documentElement.scrollWidth - innerWidth`; **CTA** = jumlah `.idesk-cta` (tanpa `.ct-submit`) yang terlihat di viewport, lokasi `top`/`fab`; tidak ada `pageerror` tak tertangkap di semua 88 sel.

| Role | Route | 1440 light | 1440 dark | 390 light | 390 dark |
|---|---|---|---|---|---|
| ADMIN | `/tickets/list` | h1 · ov 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/kanban` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/tickets/t-1` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · **0** (1) | h1 · 0 · **0** (1) |
| ADMIN | `/dashboard` | h1 · 0 · 1 top (2) | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/dashboard/me` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/hardware-requests` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/eform-access` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/zoom-calendar` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/kb` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/workloads` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/reports` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/notifications` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/renewal` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/agents` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/automation` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/audit-logs` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/system-health` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| ADMIN | `/settings/profile` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| USER | `/client/my-tickets` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| USER | `/client/tickets/t-1` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · **0** (1) | h1 · 0 · **0** (1) |
| USER | `/client/create` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |
| USER | `/client/kb` | h1 · 0 · 1 top | h1 · 0 · 1 top | h1 · 0 · 1 fab | h1 · 0 · 1 fab |

Ringkasan: 88/88 render h1 tanpa error boundary, 0 overflow horizontal, 0 `pageerror`. CTA tepat 1 di 84/88; 4 sel bernilai 0 (detail tiket mobile). Tidak ada sel dengan lebih dari 1 CTA.

(1) **Detail tiket di mobile tidak punya CTA.** `BentoLayout.tsx:146-149` dan `ClientLayout.tsx:63,136` sengaja menyembunyikan bottom nav pada halaman detail tiket agar composer chat mendapat tinggi penuh (perilaku sudah ada di `ab74bab7`: `BentoLayout.tsx:140-143`, `ClientLayout.tsx:94`). Bukan regresi, tetapi menyimpang dari bunyi aturan "tepat 1 per viewport" sehingga menjadi **keputusan produk terbuka** (lihat bagian 4).

(2) Run pertama `/dashboard` 1440 light jatuh ke `FeatureErrorBoundary` ("Dashboard Error", `TypeError: value.replace is not a function at toIndonesianDuration`). Penyebab: stub saya mengirim `avgResolutionTime` sebagai number, mengikuti `lib/api/types.ts:210` (`avgResolutionTime: number`). Backend nyata mengirim string (`ticket-stats.service.ts:217`, `ticket-query.service.ts:1028`, format `"4h 20m"`), dan halaman mengetik `string` (`BentoDashboardPage.tsx:21`). Setelah stub dikoreksi, semua lulus. **Bukan crash pada data nyata**; catatan: tipe `DashboardStats` di `lib/api/types.ts` usang dan `toIndonesianDuration` tidak defensif terhadap non-string.

Konsol browser berisi error yang sudah dikenal dari lingkungan stub (socket/bridge lokal, peringatan axe "page content is not contained by landmarks"); ini **bukan** klaim konsol bersih.

## 3. Yang TIDAK diverifikasi

- Alur backend nyata: semua smoke Task 7 memakai stub `/v1/**`; tidak ada create/update/resolve tiket, upload, atau mutasi nyata.
- Socket real-time: typing indicator, pesan masuk live, presence antara dua user/agen (hanya unit test).
- Interaksi: drag Kanban, bulk bar, dialog takeover, menu aksi, composer kirim/gagal tidak diulang di Task 7 (ada di screenshot Task 2-3).
- Perangkat sentuh nyata (long-press 450ms, drag sentuh 260ms, `pointer: coarse`), Safari/iOS dan font SF Pro nyata (Chromium di Windows memakai Inter).
- Emulasi `prefers-reduced-motion` dan `forced-colors`.
- Viewport di antara 390 dan 1440 (1024/1280/1366) pada Task 7; 1366 dicek di PR2 Task 4.
- Audit kontras otomatis lengkap dan screen reader nyata.
- Rute di luar daftar (antrian Oracle/Web/Mobile Dev, TV board, login, data wipe, sub-tab settings selain profile, client profile/zoom).
- Seluruh suite vitest sekaligus (sengaja tidak; hanya 128 file yang disentuh branch ini).
- Review akhir whole-branch untuk Task 6 (ditunda ke final review per ledger).

## 4. Keputusan terbuka

1. Detail tiket mobile tanpa CTA "Buat Tiket Baru" (bottom nav disembunyikan demi composer). Pilihan: biarkan (aturan dibaca "maksimal 1, nol boleh pada layar fokus") atau tampilkan CTA di header.
2. Mock `useAuth` di `oracle-k2-route.test.tsx` perlu `setState` agar file exit 0.
3. `lib/api/types.ts` `DashboardStats.avgResolutionTime/avgResponseTime` bertipe `number`, backend mengirim string.

## 5. Minor yang ditunda (dari `progress.md`)

PR2:
- T1: M4 AgentSelectList `role=status` di dalam listbox, tombol clear search dan hitungan per grup hilang; M6 `ticket-tokens.test` membaca path relatif cwd; M7 SiteSelector mode single tidak menutup saat pilih.
- T2: #3 selector struktural `.idesk-topbar-actions` rapuh; #4 HSL tile nav teal/mint/brown/slate hard-coded; #9 warna ring badge pojok pada item collapsed aktif; ungu tersisa di `InAppNotificationToast.tsx:53` (TICKET_ASSIGNED).
- T3: padding bawah ganda ZoomCalendarPage mobile; campuran bahasa judul (My Tickets vs Tiket Saya).
- T4: badge iPop mewarisi min-height 36px di kartu; indentasi JSX QueueCardToolbar. (Duplikat CTA desktop sudah diselesaikan round 2, lihat matriks.)
- T5: unit durasi tidak konsisten ("1h 3j" vs "1d 3h"); kartu root pemohon right-aligned tapi gaya bubble-in; `.dark .chat-bubble-out` hsl hard-coded; opsi prioritas kehilangan chip "Xh SLA"; test composer mengecek class bukan visibilitas.
- T6: tidak ada test undo toast/paste/drop/limit lampiran; `DESCRIPTION_MIN` diekspor di tengah file.

Round 2:
- Task 3-4: M1 feed live dihitung dari `createdAt`; M3 link dashboard tidak memperhatikan role; M4 toast refresh saat gagal; M5 bucket mingguan tertua parsial; M7 chip reminder terbuka saat terkunci; M8 ARIA invalid/duplikat; M9 "IT Support Specialist" hard-coded (`ClientTicketInspector.tsx:44`); M10 "Tiket Anda" untuk non-owner dan nama uppercase; M11 wrapper `.dash` di ManagerDashboard; M13 desync DetailTabs saat resize; announcer mengumumkan ulang pesan lama bila pesan terbaru dihapus (`TicketChat.tsx:62-65`).
- Task 5: M4 awal minggu/UTC (backend); M5 grouping overlap zoom; M7 legend blocked; M10 MANAGER edit 403; M11 urutan chip aging; M14 pencarian teknisi; M16 checkbox akun zoom seperti radio di single scope; M17 semantik tabel; M19 konflik Ctrl+K; M20 CSS mati; M21 procurement/installation hue sama; rentang proyeksi beku setelah tengah malam (`InstallationCalendarPage.tsx:171-200`).
- Task 6: Service Map, Incident Log, Trace drawer, kartu SLA, Ticket Modules, Quick Reply masih struktur lama (hanya restyle); ikon nav settings bukan tile berwarna; field mockup-only (volume, rotasi TV, whitelist enforce) tidak dibangun.
- Edit/Hapus pesan chat hanya toast "coming soon" (sama dengan `main`).
