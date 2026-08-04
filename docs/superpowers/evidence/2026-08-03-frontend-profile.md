# Frontend Render Profile — 2026-08-03

Task 2.5. Instrumentasi: React `Profiler` API sementara (tanpa dependency baru), log ke `window.__profileLog`, dibaca via Playwright. Instrumentasi sudah di-revert penuh setelah pengukuran (`git diff` kosong untuk kedua file yang di-instrument).

Env: frontend dev server `http://localhost:4050`, backend `http://127.0.0.1:5050`, login `admin@idesk.com`.

Catatan metode: `actualDuration ≈ baseDuration` → React tidak bail out, subtree render penuh. `actualDuration << baseDuration` → bail out berhasil (memoization efektif). Tidak ada klaim persentase karena sample kecil dan bukan benchmark terkontrol.

---

## A. Dashboard — `BentoDashboardPage.tsx` → BUKAN hotspot, tidak diubah

Route: `/dashboard`. Boundary Profiler: `BentoDashboardPage`.

| phase | actualDuration | baseDuration | catatan |
|---|---|---|---|
| mount | 13.7 ms | 10.9 ms | 1 event, t=535.5 |
| update | 0.1–0.5 ms | 10.7–11.2 ms | ~120 event, jarak ~5.5 ms, t=555.5→1319.7 |

Temuan: ~120 commit itu re-render RAF-driven dari `AnimatedNumber` (`requestAnimationFrame` di `apps/frontend/src/components/ui/AnimatedNumber.tsx:47,54`) yang **bail out** di boundary dashboard — `actualDuration` 0.1–0.5 ms vs `baseDuration` ~11 ms. `liveStats` useMemo (deps `[tickets, chartDateRange]`) tidak re-run pada tick ini.

Kesimpulan: hipotesis awal "`liveStats` mahal" **tidak terbukti**. Tidak ada perubahan kode pada file ini; instrumentasi di-revert (verified `git diff --stat` kosong).

---

## B. Ticket list — hotspot terkonfirmasi, fix diterapkan

Route: `/tickets/list` (bukan `/tickets` — route itu tidak ada, lihat `apps/frontend/src/routes/AppRoutes.tsx:182`). Boundary Profiler: `VirtualizedTicketList` (wrapper list, bukan row individual). 4 ticket ter-render.

### Before (pre-fix)

Mount: `actualDuration` 36.3 ms / `baseDuration` 29.8 ms (t=790).
Settling: 4 `nested-update` dalam 58 ms (t=805.1→848.4), actual 7.4 / 22.8 / 3.3 / 1.3 vs base 24.2 / 42.8 / 35.5 / 35.6.

Interaksi (klik priority dropdown → Escape → klik Refresh): **10 commit**, `actualDuration` 0.3–37.6 ms mengikuti rapat `baseDuration` 15.2–48.3 ms. Contoh terberat: `update` actual 37.6 / base 36.1 (t=42392.3). Artinya seluruh `TicketListRow` re-render tiap commit tanpa peduli props row-nya berubah atau tidak.

### Fix

1. `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx` — komponen dibungkus `React.memo`.
2. `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx` — tiga handler props distabilkan dengan `useCallback` (`handleUpdatePriority`, `handleUpdateStatus`, `handleAssign`), menggantikan inline arrow function yang identitasnya baru tiap render.

Kedua perubahan saling bergantung: `React.memo` tanpa props stabil tidak menghasilkan bail out.

### After (post-fix, interaksi identik)

23 commit tercatat pada boundary yang sama. Yang relevan — setiap `update` sekarang diikuti `nested-update` yang bail out bersih:

| t | phase | actualDuration | baseDuration |
|---|---|---|---|
| 60549.1 | update | 37.7 ms | 37.1 ms |
| 60559.7 | nested-update | **0.5 ms** | 37.1 ms |
| 60624.4 | nested-update | **0.2 ms** | 38.7 ms |
| 120637.5 | nested-update | **0.2 ms** | 45.3 ms |
| 142212.6 | update | **8.6 ms** | 47.0 ms |
| 142232.5 | nested-update | **0.1 ms** | 44.1 ms |
| 142242.7 | update | **0.3 ms** | 44.1 ms |
| 142251.5 | nested-update | **0.0 ms** | 44.6 ms |
| 146700.9 | update | **4.2 ms** | 43.3 ms |
| 150516.0 | nested-update | **0.4 ms** | 47.7 ms |

Sebelum fix tidak ada satu commit pun dengan `actualDuration` jauh di bawah `baseDuration` pada commit berat; setelah fix mayoritas commit turun ke 0.0–0.5 ms terhadap base ~37–48 ms. Commit yang masih ~37–48 ms adalah commit di mana data ticket memang berubah (props row berubah → memo memang harus render) atau refetch mengganti array ticket — itu kerja yang tidak bisa dihindari di level ini.

Jujur soal batas pengukuran: boundary Profiler ada di wrapper list, jadi commit dengan props ticket berubah tetap membayar full subtree. Fix ini menghilangkan re-render yang **tidak perlu**, bukan menurunkan biaya render yang perlu. Tidak ada angka persentase yang diklaim.

---

## C. Regression test

`apps/frontend/src/features/ticket-board/components/__tests__/TicketListRow.memo.test.ts` — memastikan `TicketListRow.$$typeof === Symbol.for('react.memo')`, supaya `React.memo` tidak hilang tanpa sengaja di refactor berikutnya. Test lolos.

## D. Temuan design hook yang sengaja dibiarkan

`impeccable` melaporkan 3 temuan pre-existing di luar scope task perf ini, tidak diubah dan tidak di-suppress:
- `TicketListRow.tsx:372` — `gray-on-color`
- `TicketListRow.tsx:214` — `design-system-font-size` (11px)
- `BentoTicketListPage.tsx:435` — `design-system-font-size` (10px)
