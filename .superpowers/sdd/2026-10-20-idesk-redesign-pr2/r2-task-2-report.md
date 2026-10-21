# R2 Task 2 — Queues + Kanban + My Tickets (production frontend)

Branch `HitterD/redesign-mockup`, commit `feat(tickets): round-2 queue actions, bulk bar, kanban and requester rows`.

## Perubahan
1. **Kanban | Tabel toggle** — `SegmentedControl` kini mendukung opsi `href` (render `<Link>`, `aria-current="page"`; klik biasa → thumb meluncur lalu navigasi setelah `--dur-2`; ctrl/meta-klik tetap link native). Komponen baru `QueueViewToggle.tsx` (label "Kanban"/"Tabel", ikon `Columns3`/`Rows3`, accessible name "Tampilan Kanban/Tabel", ikon saja ≤860px) mempertahankan semua query param (scope, filter) dan hanya men-set/hapus `?view=kanban`. Dipakai di `QueueHeader` (prop `onKanban` dihapus dari 4 halaman antrean). Kanban sekarang memakai `QueueHeader` yang sama (judul/ikon/tone antrean sama dengan Tabel, toggle di posisi yang sama); `/kanban` standalone memakai `tablePath`.
2. **Row quick actions** — `TicketRowActions.tsx` (Radix DropdownMenu). Desktop: "Tandai selesai" (ikon, `aria-label="Tandai selesai #no"`) + "⋯" (`aria-label="Aksi lainnya #no"`) mengambang di ujung sel judul saja (`.queue-title-cell` relative; gradient ke `--row-bg`), fade-in saat hover/focus-within/menu terbuka, tidak di-scale. Quick resolve memakai aturan lama hover-resolve (`canEditStatus && status !== 'RESOLVED'`) dan `ResolveTicketModal` yang sama. Menu: Buka tiket, Tandai selesai, Buka Hardware Request (jika `ictBudgetRequestId`), Ganti PIC (membuka popover PIC existing → konfirmasi reassign tetap), Salin nomor tiket, + di kartu mobile "Pilih untuk aksi massal / Batal pilih". Mobile card: ⋯ selalu tampil (36px). Semua event di dalam menu di-stopPropagation → tidak pernah navigasi. Badge "Hardware Installation" → `.queue-hw-link` "Hardware" (amber, ikon `MonitorSmartphone`) per mockup; navigasi sama. Chevron/hover-resolve lama di kolom Created dihapus. Checkbox cell tidak diubah.
3. **BulkActionsBar** — bar putih mengambang (sticky bottom 18px / 84px mobile, radius 16, `--queue-pop-shadow`, `queue-bar-in` dengan `--dur-3 --ease-spring`), `role="toolbar" aria-label="Aksi massal"`: badge jumlah + "tiket dipilih", **Status ▾** (menu: In Progress, Resolved — dua status bulk yang sudah ada), **PIC** (BulkAssignDialog existing), **Gabungkan** (MergeTicketsModal existing; disabled <2 dengan hint), **Hapus** (admin-only, BulkDeleteDialog existing), **✕ Batal pilih** + Esc (diabaikan saat dialog/menu terbuka). Takeover dialog (`requestBulk`) tetap. Mobile: ikon saja.
4. **Kanban** — card/column dipindah ke `KanbanBoardParts.tsx` (BentoTicketKanban 1124→748 baris). Kolom Open (sky) / In Progress (navy) / Waiting Vendor / Resolved (+Closed) sebagai panel tint `color-mix(--col 4%)`, dot + count pill, tombol ciut subtle (collapse tetap ada). Kartu: `#id` mono + kategori, ⋯ (pojok, hover/focus; selalu di touch) berisi Buka/Pratinjau cepat/Ganti PIC/Salin, judul, pill prioritas + SLA (Dijeda/Overdue/Due soon/Target/Selesai), footer PIC + pill status. Closed: ikon gembok "Hanya baca", `isDragDisabled` (aturan sama: hanya CLOSED). Drag: tetap `@hello-pangea/dnd`; ghost = `rotate 2deg scale 1.03` + shadow pop (properti independen agar transform library utuh), kolom target `is-over` highlight, placeholder bergaris (`[data-rfd-placeholder-context-id]`), landing `kanban-land` setelah status sukses. Takeover dialog, preview panel, mutasi, filter, site selector tidak berubah. Hint "Seret kartu…".
5. **My Tickets** — hint "Klik tiket untuk melihat percakapan, status terbaru, dan membalas petugas IT." (desktop, saat ada tiket), accessible name `Buka tiket #no: judul`, `.portal-open-cta` "Lihat detail ›" / "Lihat & balas ›" (jika `hasUnreadChat`; produksi hanya punya flag boolean, bukan jumlah), aksen kiri 3px + judul sapphire saat hover/focus, tombol full-width di bawah kartu mobile.
6. **Sky vs navy** — diverifikasi computed: dark In Progress `rgb(168,189,240)` vs Open `rgb(122,198,255)`; light navy #2D4A8C vs sky ink #0B6BB8; kolom Kanban dot sky vs navy.

CSS baru di `index.css` `@layer components` (blok "Round-2 queue actions", "Kanban", "Requester rows"); satu rule unlayered `.queue-title-cell > .inline-block` (harus mengalahkan utility `.inline-block` dari TicketQuickPreview agar judul ter-truncate).

## Aksi mockup yang tidak didukung produksi (tidak ditambahkan)
- **Bulk "Prioritas"** — tidak ada handler bulk priority di frontend (DTO backend `PATCH /tickets/bulk/update` menerima `priority`, tapi itu berarti menambah call baru → sesuai instruksi tidak ditambahkan). Perlu keputusan user.
- **Bulk status Open / Waiting Vendor** — bar produksi hanya punya In Progress & Resolved; menu Status hanya berisi dua itu.
- **Tombol status di kartu Kanban** (alternatif keyboard di mockup) — produksi tidak punya editor status inline di kartu; status kartu read-only pill, ubah via drag (termasuk keyboard DnD bawaan library: Space/Arrow) atau panel Pratinjau cepat.
- **Header checkbox state mixed** sudah ada (indeterminate) — tidak berubah.
- Menu Kanban tidak punya "Tandai selesai"/"Hardware" karena data/aturan kartu Kanban produksi tidak memuat itu (Resolve di Kanban = drag ke Resolved).

## Test (serial, satu file per invocation)
Baru: `BulkActionsBar.test.tsx` (4: muncul saat seleksi + ✕ clear, Esc clear, Gabungkan ≥2 & Hapus hanya jika diizinkan, menu Status = In Progress/Resolved). Ditambah: TicketListRow (+3: ⋯ berlabel & tidak navigasi, quick resolve hanya jika boleh, menu mobile Hardware + pilih bulk), BentoTicketKanban (+2: kartu CLOSED tidak draggable + gembok; kartu aktif draggable, ⋯ tidak membuka tiket), BentoMyTicketsPage (+1: accessible name, hint, Lihat detail/Lihat & balas, tombol mobile).
Diubah: 3 smoke (Oracle/WebDev/MobileDev) — Kanban kini menampilkan judul antrean yang sama, jadi assert region "Kanban tiket" + link "Tampilan Kanban" `aria-current`.
Hasil PASS: BulkActionsBar 4, TicketListRow 29, TicketListRow.memo 1, BentoTicketKanban 11, BentoTicketListPage.filters 10, Oracle 4, WebDev 5, MobileDev 4, BentoMyTicketsPage 6, useStatusTakeover 16, segmented-control 3, SelectCheckbox 2, StatsCard 2, ticket-tokens 3. `npx tsc -p tsconfig.app.json --noEmit` exit 0.

## Browser (Playwright, stub `**/v1/**`, ADMIN + USER; notifikasi di-grant agar NotificationPermissionGate lewat)
Screenshot `.superpowers/shots/r2t2-*.png`: list 1440 light (+menu, +bulk), list 1440 dark, list 390, kanban 1440 light/dark (+drag), kanban 390, my 1440 light/dark, my 390, pembanding mockup `r2t2-mock-kanban-1440-light.png`, `r2t2-mock-my-1440-light.png`.
- Row actions: bounding box aksi berakhir x=535 < kolom Prioritas x=545 → tidak menutupi PIC/SLA. Menu ⋯ tidak mengubah URL.
- Ditemukan & diperbaiki saat verifikasi: judul tidak ter-truncate (overflow ke Prioritas) karena wrapper `inline-block` TicketQuickPreview; nomor tiket kartu Kanban terbungkus; pill filter Kanban terbungkus di 390.
- Drag keyboard: ghost miring, kolom target highlight, placeholder bergaris tampil; drop tidak menetap di sesi stub karena refetch stub mengembalikan status lama (bukan bug — mutasi/rollback asli).
- Task 1 sanity: font body = stack SF/Inter ✓; satu "Buat Tiket Baru" (topbar) ✓; tab sidebar aktif & popover tampil normal. Requester portal membuka dialog "Panduan Penggunaan Portal" otomatis setiap load bersih (perilaku existing, bukan Task 1).
- Console: hanya socket.io yang di-abort stub dan `127.0.0.1:19876/pending-redirect` (helper lokal, tidak terkait).

## Concerns
- Kanban sekarang berjudul "IT Support Tickets" (bukan "IT Support Kanban") demi header identik mockup; deskripsi drag lama hilang → diganti hint bawah.
- `currentView`/`onToggleView` props Kanban dipertahankan tapi tidak dipakai (deprecated) agar pemanggil tetap kompatibel.
- DynamicTicketQueuePage memakai BulkActionsBar baru (otomatis), tapi tabelnya masih `<table>` legacy tanpa row actions/toggle (halaman modul kustom tanpa Kanban) — tidak direstruktur.
- Kanban mobile: kolom 82vw scroll-snap; pill filter tetap scroll horizontal.
- Collapsed column pakai `writing-mode` vertikal sederhana; belum dibandingkan visual (mockup tidak punya collapse).

## Fix round 1 — fidelity pass (`fix(tickets): round-2 fidelity pass for queues and my tickets`)

### Diperbaiki
- **Copy antrean (4 halaman):** search "Cari judul, nomor tiket, atau pemohon"; scope "Semua / Tugas Saya / Saya Buat"; filter `.pop` "Status Semua / Prioritas Semua / Site Semua" (`CustomDropdown filterKey`, `SiteSelector variant="pop"`; opsi prioritas Low/Normal/Urgent/Blocker); "More" → tombol ikon ⋯ (`aria-label`/tooltip "Lainnya"; isi: Filter tersimpan, Ekspor data, Reset filter) + ikon "Muat ulang"; header kolom sentence case Tiket · Prioritas · Site · Status · Pemohon · PIC · SLA; "Unassigned" → "Tetapkan PIC" bergaris putus; SLA "Dijeda · sisa 5j 20m", "Lewat 2j 0m", "Selesai", "Tanpa SLA", satuan h/j/m; "Pesan Baru (2)" → chip biru "2 pesan baru" di baris id; footer "Menampilkan X dari Y tiket"; pagination Indonesia.
- **Kolom:** grid = mockup (`26px minmax(200px,2.4fr) 104px 60px 150px minmax(160px,1.1fr) minmax(180px,1.3fr) 160px`, row 60px, thead 36px). Kolom Created & Target Date dihapus; SLA membawa target. Sort "Dibuat ↓" tetap di ujung header (mockup `.sort`); judul tidak lagi terpotong "E-KA…".
- **Row actions:** pill tinggi penuh sel, vertikal tengah, gradient 24px ke `--row-bg` menutupi judul (mockup fade), tidak menutupi Prioritas.
- **Mobile 390:** kartu per mockup (id·⋯ / judul / status + SLA / PIC di bawah garis), strip statistik horizontal, search full-width, ikon pop disembunyikan.
- **My Tickets:** "Tiket Saya", "Pantau tiket bantuan yang Anda ajukan", "Muat ulang" (`idesk-btn is-soft`), search "Cari judul atau nomor tiket", segmen "Semua / Open / Dalam penanganan / Selesai / Dibatalkan", stat "Total / Open / Dalam penanganan / Selesai" dengan angka kanan-atas, ikon kiri-atas, nama di bawah; live `.live` (titik hijau "Live", "Menghubungkan…" saat socket belum terhubung); "Baru saja / N menit lalu / N jam lalu / Kemarin / 19 Okt"; footer "Menampilkan X dari Y hasil" + pop "Per halaman" (5/10/25/50); status pill pakai titik.
- **Kanban:** header sama dengan Tabel (scope + toggle di tempat yang sama), 7 kartu statistik seperti Tabel (memfilter board), toolbar = `.filters` (search + pop), SLA kartu memakai bubble yang sama dengan Tabel ("2h 8j", "Lewat 2j 11m"), chip "2 pesan baru".

### Grouping produksi (dilaporkan, bukan dipalsukan)
- My Tickets **"Dalam penanganan" = IN_PROGRESS + WAITING_VENDOR** dan **"Selesai" = RESOLVED + CLOSED**, persis grouping mockup (`my-tickets-demo.js`). Produksi sebelumnya: In Progress saja / Resolved+Closed. Filter memakai `status=IN_PROGRESS,WAITING_VENDOR` — endpoint paginated sudah mendukung koma (`ticket-query.service.ts:307`), tidak ada perubahan backend. Stat ditambah satu probe `limit=1&status=WAITING_VENDOR`. "Dibatalkan" (CANCELLED) baru sebagai segmen; filter "Closed" lama digabung ke "Selesai".

### Perbedaan yang sengaja dipertahankan
1. **Toolbar mobile "Urutkan / Pilih semua"** (QueueCardToolbar) — mockup tidak punya, tetapi ini satu-satunya kontrol sort & select-all di kartu mobile produksi.
2. **Dropdown prioritas di kartu tablet (861–1099px)** — disembunyikan ≤860px seperti mockup; antara 860–1100 tetap tampil karena itu satu-satunya editor prioritas pada layout kartu.
3. **Kanban: "Saya Buat" tidak ada** di scope Kanban — query Kanban (`GET /tickets?queue=`) tidak punya filter created-by; menambahkannya = endpoint baru. Kanban scope: Semua / Tugas Saya.
4. **Kanban filter "Perhatian" (Overdue/Critical)** — filter cepat produksi lama dipindah ke pop; kartu Overdue/Critical juga memfilter.
5. **Kanban tanpa filter Status** — kolomnya sudah status; kartu statistik memfilter status.
6. **Status filter list menyimpan opsi produksi "Selesai (Resolved + Closed)" dan "Aktif"** — dipakai kartu statistik/saved filters.
7. **Requester "Pesan baru" tanpa jumlah** — API requester hanya `hasUnreadChat` (boolean), tidak ada `unreadMessageCount`.
8. **Jumlah pesan (💬 N)** — dulu di kolom Created; kini chip kecil di baris id (tidak ada di mockup, tetapi info ini tidak tampil di tempat lain).
9. **Footer list memakai pagination produksi** (server-side, 20/halaman) — mockup "Satu halaman data contoh" tidak berlaku.
10. **Tanggal dibuat** tidak lagi kolom; tetap tersedia di quick preview (hover judul: "Dibuat: …"), export CSV, dan sort "Dibuat".
11. **Topbar / sidebar** (Search tickets…, nav label, sapphire chrome) di luar scope Task 2 — tidak diubah; mockup topbar punya breadcrumb "Request Center".
12. **Label status/prioritas Inggris** (Open, In Progress, Waiting Vendor, Resolved, Normal/Urgent/Blocker) — sama dengan mockup.
13. **Requester help-banner** teks produksi ("…ke tim IT.") dipertahankan — PR2 menolak janji waktu respons ("Tim IT akan segera membantu").

### Test fix round 1 (serial, satu file per invocation)
Baru: `QueueTableHeader.test.tsx` (3). Diperbarui ke copy baru: TargetDateCell, TicketListRow, BentoMyTicketsPage, 3 smoke antrean. PASS: TicketListRow 29, memo 1, BulkActionsBar 4, BentoTicketKanban 11, QueueTableHeader 3, TargetDateCell 16, QueueCardToolbar 4, StatsCard 2, SelectCheckbox 2, BentoTicketListPage.filters 10, Oracle 4, WebDev 5, MobileDev 4, BentoMyTicketsPage 6, useStatusTakeover 16, ticket-dropdowns 6, site-selector 3, segmented-control 3, searchable-picker 8, ticket-tokens 3. `tsc -p tsconfig.app.json --noEmit` exit 0.

### Browser fix round 1
Screenshot `r2t2b-{list,kanban,my}-{1440,390}-{light,dark}.png` + pembanding `r2t2b-mock-*` (mockup via `file:///`, server 8765 mati). Catatan: Vite dev server di worktree ini tidak menangkap perubahan `index.css` otomatis (perlu `touch src/index.css`), sempat membuat CSS tampak tidak berlaku.
