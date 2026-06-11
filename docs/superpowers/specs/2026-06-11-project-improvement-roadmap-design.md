# iDesk — Project Improvement Roadmap (Audit & Design Spec)

**Tanggal:** 2026-06-11
**Tipe:** Audit roadmap (multi-workstream, prioritas P0–P3)
**Scope dimensi:** UI/UX & konsistensi halaman + Performance & teknis
**Status:** Draft disetujui (struktur), menunggu review akhir user

---

## 1. Tujuan

Menyediakan peta improvement menyeluruh untuk codebase iDesk: **apa yang bisa di-improve** dan **halaman mana yang harus di-upgrade**. Roadmap ini berbasis bukti (routing aktual + line count aktual), bukan asumsi. Setiap item kerja mencantumkan langkah verifikasi sebelum perubahan, supaya rekomendasi tetap akurat saat dieksekusi.

Catatan kejujuran: scan ini **belum menemukan P0** (crash / security / data-loss) terverifikasi. P0 hanya akan ditetapkan jika verifikasi per-halaman menemukannya. Tidak ada temuan yang dilebih-lebihkan.

## 2. Metodologi & Bukti

Sumber temuan:
- `apps/frontend/src/routes/AppRoutes.tsx` — daftar halaman yang **benar-benar dirouting** vs yang hanya ter-define.
- Inventaris `apps/frontend/src/features/**/pages/*.tsx` — pola penamaan `Bento*` = versi modern, non-`Bento` = kandidat legacy.
- Line count aktual (`wc -l`) — hotspot ukuran file vs aturan proyek (file < 800 baris, CLAUDE.md §4).

Temuan positif (tidak perlu dikerjakan):
- **Code splitting sudah matang** — semua route `lazy()` + `Suspense`, layout per-portal dipecah (Admin/Manager/Client bundle terpisah).
- `LazyMotion` (Framer Motion di-defer), TanStack Virtual & Table tersedia untuk virtualization.
- Fokus performa **bukan** di strategi bundle, melainkan di file gede + re-render/query yang belum terukur.

## 3. Workstream & Prioritas

### WS1 — Selesaikan migrasi design system "Bento" (UI/UX konsistensi)

Sebagian halaman legacy masih aktif dirouting, menimbulkan inkonsistensi visual antar-portal.

| Item | Halaman | Prio | Alasan |
|------|---------|------|--------|
| Client portal → Bento | `ClientTicketDetailPage`, `ClientKnowledgeBasePage`, `ClientArticleDetailPage`, `ClientProfilePage`, `ClientNotificationCenter` | **P1** | User-facing, volume tinggi, inkonsistensi paling kelihatan oleh end-user |
| Manager legacy → Bento | `ManagerTicketsPage`, `ManagerReportsPage` | P2 | Portal manager baru sebagian di-redesign (dashboard & workload sudah) |
| Admin tooling → Bento | `AuditLogPage`, `SystemHealthPage`, `AutomationRulesPage` + `RuleBuilder`, settings sub-pages (`IpWhitelistSettings`, `StorageSettingsPage`, `SynologyBackupSettings`, `GoogleSyncSettingsPage`) | P2/P3 | Internal, traffic rendah → prioritas lebih rendah |

**Verifikasi per item:** baca isi halaman dulu untuk konfirmasi benar-benar legacy (sebagian halaman `Client*` mungkin sudah cukup modern walau tanpa prefix `Bento`).

### WS2 — Cleanup dead / duplicate code (tech debt)

Halaman ter-define tapi **tidak dirouting** (terverifikasi dari `AppRoutes.tsx`):

| Item | Target | Prio | Alasan |
|------|--------|------|--------|
| Hapus legacy page tak-dirouting | `DashboardPage`, `LoginPage`, `ReportsPage`, `KnowledgeBasePage`, `ArticleDetailPage`, `SlaSettingsPage`, `FeedbackPage`, `MyTicketsPage`, `RenewalDashboardPage` | P2 | Mengurangi surface area maintenance & kebingungan legacy vs Bento |
| Hapus duplikat hardware-request | `request-center/pages/HardwareRequestPage`, `HardwareRequestCreatePage`, `HardwareRequestDetailPage` (sudah pindah ke `features/hardware-request/`) | P2 | Duplikasi penuh, sumber drift |
| Konfirmasi + hapus VPN page | `VpnAccessPage` (700 baris; komentar `AppRoutes` menyebut "integrated into RenewalHubPage") | P2 | Perlu verifikasi 1 langkah sebelum hapus |

**Verifikasi:** jalankan pencarian import (`grep` referensi) untuk tiap file sebelum hapus — pastikan tidak ada import tersembunyi di luar routing.

### WS3 — Pecah file > 800 baris (maintainability + chunk size)

Melanggar aturan proyek sendiri (CLAUDE.md §4: file < 800 baris). Line count terverifikasi:

| File | Baris | Prio | Aksi |
|------|-------|------|------|
| `features/admin/pages/BentoAdminAgentsPage.tsx` | **1521** | **P1** | Pelanggaran terparah, hotspot edit → ekstrak sub-komponen + custom hooks (data, dialog, tabel) |
| `features/client/pages/BentoCreateTicketPage.tsx` | 1306 | P2 | Pecah form sections + hooks |
| `features/reports/pages/BentoReportsPage.tsx` | 977 | P2 | Ekstrak chart blocks (sebagian sudah di `ReportsCharts.tsx`) |
| `features/ticket-board/components/BentoTicketKanban.tsx` | 971 | P2 | Ekstrak column / card / DnD logic |
| `features/dashboard/pages/BentoDashboardPage.tsx` | 920 | P2 | Ekstrak widget cards |

**Prinsip:** ekstraksi murni (tanpa ubah behavior), tiap unit punya satu tujuan jelas, interface eksplisit, bisa ditest independen. Smoke test setelah tiap pecah.

### WS4 — Performance pass (verifikasi terukur, bukan klaim)

Tidak ada klaim performa tanpa data. Pass ini menghasilkan pengukuran dulu, baru optimasi.

| Item | Prio | Alasan / metode |
|------|------|-----------------|
| Profil re-render & memoization di list/kanban besar | P2 | React Profiler pada Kanban, Ticket List, Reports — identifikasi re-render tak perlu, tambah `memo`/`useMemo`/`useCallback` hanya bila terbukti |
| Audit query backend (N+1, pagination) | P2 | Pass terpisah pada modul `ticketing`, `reports`, `workload` — cek eager/lazy relations TypeORM, pagination, index. Tidak diasersikan tanpa baca query aktual |

## 4. Arsitektur & Pendekatan Eksekusi

- **Setiap workstream = batch independen** dengan spec → plan → implementasi sendiri. Roadmap ini adalah induk; tiap batch yang dipilih user akan diturunkan jadi plan detail (via writing-plans).
- **Urutan rekomendasi:** WS3 item P1 (`BentoAdminAgentsPage`) + WS1 P1 (Client portal) duluan → impact tertinggi, lalu WS2 cleanup (cepat, low-risk), lalu sisanya.
- **Immutability & pola codebase:** ikuti pola Bento existing (Radix wrappers, TanStack Query, Zustand store, styles `consistency.css`/`glassmorphism.css`). Tidak ada refactor di luar scope item.
- **Testing:** smoke test setiap perubahan; untuk page upgrade tambahkan/perbarui test Vitest + axe-core sesuai pola existing.

## 5. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Halaman "legacy" ternyata sudah dipakai/modern | Verifikasi baca isi sebelum upgrade (langkah di tiap item WS1) |
| Hapus file yang masih di-import diam-diam | Grep referensi import sebelum delete (WS2) |
| Pecah file mengubah behavior | Ekstraksi murni + smoke test + diff review |
| Optimasi perf tanpa dampak nyata | Ukur dulu (Profiler/query log), optimasi hanya yang terbukti |

## 6. Definition of Done (roadmap)

- [ ] User memilih batch/workstream mana yang dieksekusi duluan.
- [ ] Batch terpilih diturunkan jadi implementation plan (writing-plans).
- [ ] Tiap item punya langkah verifikasi sebelum perubahan.
- [ ] Lint + test hijau (backend & frontend) sebelum tiap batch ditutup.

## 7. Out of Scope (YAGNI)

- Rewrite arsitektur besar / ganti framework.
- Refactor modul yang tidak terkait item roadmap.
- Penambahan fitur baru (roadmap ini murni improvement, bukan feature).
