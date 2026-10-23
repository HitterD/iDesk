# Prototype interaktif iDesk

Mockup statis untuk review UI, bukan aplikasi produksi. Buka melalui static server dari root repository agar asset `apps/frontend/public` tetap ditemukan. Ikon memakai Lucide CDN; font fallback Inter dimuat dari Google Fonts. Tidak ada dependency npm baru.

## Halaman

- `list.html` — daftar agent (Tabel). `?queue=oracle`, `web`, atau `mobile` mengganti konteks contoh.
- `kanban.html` — antrian yang sama dalam tampilan Kanban: kolom Open / In Progress / Waiting Vendor / Resolved (Resolved juga menampung Closed, hanya baca). Header, statistik, filter, dan data identik dengan `list.html` karena keduanya memakai `queue.js`.
- `ticket.html` — inspector agent; `?as=user` menampilkan portal pemohon hanya baca.
- `ticket-actions.html` — **mockup review saja**: dialog Selesaikan tiket / Teruskan tiket, desktop utility form dan mobile bottom sheet. `?dialog=resolve|forward&theme=light|dark` membuka contoh langsung. Submit hanya menampilkan pratinjau lokal, tidak mengubah tiket. Solusi wajib (keputusan redesign; produksi saat ini masih mengizinkan lampiran saja). Lampiran: maks. 5, 10 MB/file, JPEG/PNG/WebP/GIF/PDF, dapat dihapus; file tidak diunggah. Empat tim dan tujuh alasan mengikuti `TicketForwardDialog.tsx`; tim saat ini tidak dapat dipilih, Lainnya mewajibkan catatan. Native dialog menangani fokus/Escape; CSS/JS baru terisolasi. Warna aksi mengikuti revisi user: selesai hijau, teruskan sapphire, batalkan/hapus merah, reminder amber, perpanjang SLA teal, tambah anggota netral; tanpa ungu. Strip sampel visual mencakup state normal, disabled, dan loading ilustratif (tidak menjalankan aksi tambahan). **Perlu persetujuan user sebelum implementasi produksi.**
- `my-tickets.html` — portal pemohon, pencarian dan filter tiket saya.
- `new.html` — katalog jenis bantuan; `?as=user` mempertahankan navigasi pemohon.
- `form.html?type=service` — form contoh; tipe lain: `oracle`, `web`, `mobile`. Tambahkan `&as=user` untuk portal pemohon.
- `?theme=dark` / `?theme=light` dapat dipakai pada semua halaman.
- `dashboard-me.html` — Dashboard Saya (AgentDashboardPage): KPI pribadi, perlu perhatian, tren ditugaskan vs diselesaikan, performa, workload & instalasi, rating. Periode 7/30/90 hari mengganti angka contoh.
- `dashboard-team.html` — Dashboard Tim (BentoDashboardPage): total, aktivitas 7/14/30 hari, status/prioritas (donut), kategori, aktivitas live, agent terbaik.
- `hardware.html` — Hardware Requests dengan tab Daftar Request / Overview / Jadwal Instalasi / HR Catalog (`?tab=dashboard|calendar|catalog`).
- `eform.html` — E-Form Access: statistik, filter jenis, Tabel / Kalender & Timeline.
- `zoom.html` — Zoom Calendar: minggu (3 akun), Matriks Semua Akun, Bookingan Saya, upcoming meetings.
- `kb.html` + `kb-article.html` — Pusat Panduan (topik, pencarian, populer/terbaru) dan detail artikel (daftar isi, progres solusi, feedback).
- `workloads.html`, `reports.html` (tab Monthly / Agent / Volume / Scheduled), `notifications.html`, `renewal.html` (Contracts / VPN Access / Sync Settings).
- `agents.html`, `automation.html`, `audit-logs.html`, `system-health.html` (Vitals / Service Map / Storage), `settings.html` (tab Personal + Administration seperti BentoSettingsPage; `?tab=security` dsb.).
- Semua halaman di atas memakai `pages.css` + `pages.js` (chart SVG/HTML dari token, tab dengan transisi arah, switch, tooltip chart, aksi `data-demo`). Hanya "Hapus Data" di sidebar yang sengaja tetap tautan mati.


## Interaksi yang berfungsi

- Semua dropdown memakai `dropdown.js`: popover dipasang langsung di body, posisi fixed, flip/clamp viewport, daftar dapat digulir, selected check, pencarian opsional, ArrowUp/ArrowDown, Home/End, Enter, Escape, klik luar, dan pengembalian fokus. Tombol mempunyai `aria-haspopup`/`aria-expanded`.
- Status, prioritas, site, pencarian, scope dan kartu statistik daftar memfilter baris secara kumulatif. Reset membersihkan filter. Angka statistik dihitung dari **10 record contoh**, bukan jumlah produksi.
- Prioritas/status/PIC inline dan properti inspector agent mengubah record lokal. PIC dan takeover saat memulai tiket milik PIC lain memerlukan dialog dengan alasan minimal tiga karakter. Batal/Escape tidak mengubah state. Actor contoh: **RM Bagastyo Anggoro**.
- `RESOLVED`, `CLOSED`, `CANCELLED` hanya baca; inspector pemohon tidak mempunyai editor. Site dan SLA bukan dropdown. Pilihan status biasa mengikuti empat status editor: Open, In Progress, Waiting Vendor, Resolved; pembatalan tersedia melalui action khusus inspector.
- Inspector memperbarui label header/properti dan menambahkan catatan perubahan PIC lokal. Waktu SLA dan pesan historis tetap ilustrasi, bukan kalkulasi SLA produksi.
- Form service: kategori/perangkat/aplikasi; semua form: urgensi, pemohon sendiri/orang lain, penghitung judul/detail, template cepat, validasi wajib, reset judul/detail/nama, dan pratinjau submit. Submit **tidak membuat tiket**, tidak menghasilkan nomor tiket, dan tidak mengirim data.
- Portal pemohon: pencarian, statistik, filter status dan ukuran halaman. “Dalam penanganan” mencakup In Progress dan Waiting Vendor. Empat sampel tidak membutuhkan halaman lanjutan.
- Menu profil: ganti tema, buka demo agent/pemohon, informasi prototype. Pill ketersediaan "Online · demo" di topbar agent **dihapus** (tidak dibawa ke produksi). Tidak ada logout atau simulasi keamanan/auth.

## Keputusan round 2 (mengikat untuk produksi)

### Font
- Stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text"/"SF Pro Display", "Inter", system-ui, sans-serif`. Perangkat Apple memakai SF Pro bawaan sistem; perangkat lain memakai Inter.
- SF Pro **tidak** di-self-host (lisensi Apple melarang distribusi web). Inter variable dimuat dari Google Fonts `wght@400..800&display=swap` dengan `preconnect`; subset latin dipilih otomatis lewat `unicode-range`.
- `font-feature-settings: "cv11", "ss01"` (diabaikan oleh SF Pro). Tracking rapat yang sudah ada tetap.
- Mono: `"SF Mono", ui-monospace, "JetBrains Mono", "Cascadia Mono", monospace`.

### Satu CTA "Buat Tiket Baru"
- Hanya tombol amber di topbar (desktop) dan FAB amber di tabbar mobile. Tidak ada tombol create lain di header antrian, menu tiket, sidebar, atau command palette (perintah "Buat tiket baru" di palette dihapus).
- Banner bantuan pemohon tetap, tetapi aksinya berupa tautan teks "Buat tiket →" (bukan tombol amber).

### Motion
- Token di `:root` (`idesk.css`): `--ease-out: cubic-bezier(.22,1,.36,1)`, `--ease-spring: cubic-bezier(.34,1.36,.64,1)`, `--dur-1: 120ms`, `--dur-2: 200ms`, `--dur-3: 280ms`. Semua animasi/transisi memakai token ini.
- Satu blok `@media (prefers-reduced-motion: reduce)` di akhir `idesk.css`: token menjadi 0ms, semua animasi/transisi dipendekkan, shimmer berhenti. `motion.js` juga memeriksa media query ini (tab slide dilewati).
- Inventaris: konten halaman fade+rise saat load; item sidebar hover/press; tab putih aktif meluncur dari item sebelumnya saat navigasi (via `sessionStorage`, desktop saja); popover dropdown scale+fade dari trigger (`transform-origin` dihitung di `dropdown.js`); dialog scale-in + backdrop blur-in; kartu statistik terangkat saat hover; baris tabel tint saat hover; checkbox baris fill + gambar centang; toast slide-in; tombol press `scale(.96)`; thumb segmented control meluncur (`motion.js`); skeleton shimmer saat "Muat ulang"; pesan chat masuk berurutan; kartu Kanban lift, ghost, placeholder, dan landing.
- **Larangan:** jangan pernah men-scale stretched hit target (`.ct-link`, kartu katalog `.svc`, `.help-banner`, baris/sel tabel). Hit box yang mengecil membuat klik jatuh ke elemen di belakangnya (bug produksi UAT-1 B1). Tombol di dalam baris juga dikecualikan.

### Kanban
- Toggle `Kanban | Tabel` adalah segmented control berisi tautan; thumb meluncur lalu pindah halaman dengan mempertahankan `?queue` (dan `?theme`). Di mobile tampil sebagai ikon saja.
- Drag kartu dengan pointer (mouse langsung; sentuh tahan 260ms): ghost terangkat mengikuti pointer, placeholder bergaris terbuka di posisi drop, kolom target ter-highlight, board auto-scroll horizontal di tepi. Lepas di kolom lain memanggil `iDeskMock.change` yang sama dengan tabel, sehingga memindahkan ke In Progress tiket milik PIC lain memunculkan dialog takeover berisi alasan. Batal/Escape mengembalikan kartu. Kartu terminal hanya baca (ikon gembok, tidak bisa diseret). Alternatif keyboard/tanpa drag: tombol status pada kartu.

### Sistem aksi (round 2 · tiket list, Kanban, detail, chat)
- Kelas di `idesk.css` (blok "Action system"); helper di `actions.js` (tooltip `data-hint` + `data-kbd`, grid picker reaksi/sticker, field dialog, dialog Resolve, salin), `queue-actions.js` (aksi baris/kartu + bulk bar), `ticket-chat.js` (pesan + composer). `dropdown.js`: opsi `tone: 'danger'`, `busy()` (spinner), `confirm({ danger, body, busyLabel, cancelLabel })`.
- **Hierarki:** tepat satu `.btn.primary` per permukaan (Resolve / "Masalah sudah selesai" di detail). Sekunder `.btn` (surface lembut, ikon + label). Tersier `.btn.ghost` / `.btn.icon` (ikon saja wajib `data-hint` + `aria-label`). Destruktif `.btn.danger` (teks merah lembut) selalu lewat dialog konfirmasi dengan tombol `.btn.danger.solid`. Amber tetap hanya "Buat Tiket Baru".
- **Ukuran:** 32px desktop, min 40px pada pointer kasar; radius 10px (`--r-ctl`), pill untuk chip; jarak ikon-label 6px; ikon 16px stroke 1.9. Focus-visible: ring `--ring` 3px. Disabled opacity .5 tanpa press; loading = `aria-busy` + spinner (`.spin`).
- **Pengelompokan:** header detail `.act-row` = Batalkan · Teruskan | Resolve · toggle panel. Container query `head` ≤680px: sekunder + destruktif pindah ke menu "⋯ Aksi lainnya". Tooltip menampilkan pintasan (Kirim ⏎, Batal Esc).
- **Baris:** `.row-acts` (Tandai selesai + ⋯) fade-in saat hover/focus, menumpang di ujung sel judul saja (tidak menutupi PIC/SLA), tidak di-scale. Touch/mobile: ⋯ selalu tampil; menu berisi Buka, Tandai selesai, Hardware Request, Salin nomor, Pilih untuk aksi massal. Badge `.hw-link` membuka Hardware Request. Kanban: `.card-acts` ⋯ di pojok kartu.
- **Bulk bar** `.bulk-bar`: sticky mengambang di bawah, jumlah terpilih, Status / Prioritas / PIC (dropdown) / Gabungkan (≥2, pilih tiket utama) / Hapus (konfirmasi) / tutup (Esc). Header checkbox memilih semua yang tampil (state mixed). Slide-up `bar-in`.
- **Pesan:** `.msg-tools` pill (reaksi, balas, ⋯) di sisi luar bubble saat hover/focus; touch = tahan 450ms. ⋯ = Salin, Balas, Edit (pesan sendiri), Hapus (pesan sendiri, merah, konfirmasi). Reaksi `.react` chip di bawah bubble, toggle + pop.
- **Composer:** segmented Public Reply / Internal Note (agent saja) di atas input; Internal mewarnai composer amber-soft + ikon gembok + "Hanya terlihat oleh staf IT"; pesan internal berlabel gembok. Input pill: + (Lampirkan file, Sticker), textarea, ⚡ balasan cepat (agent). Kirim bulat primary, disabled saat kosong, spinner saat mengirim. Enter kirim, Shift+Enter baris baru, Esc batal balas/edit. Chip konteks balasan/edit; tray lampiran (maks 5) dari menu, seret-lepas, atau tempel.
- **Inspector:** Perpanjang SLA dan Set Reminder = pasangan `.btn` sekunder (dialog pilihan); Tambah anggota = ghost + menu cari.
- **Pemohon (`?as=user`):** tidak ada Internal Note, pesan internal, balasan cepat, Teruskan, Resolve, Perpanjang SLA, atau Reminder.

## Kontrak data dan batasan

Semua edit tiket/form hanya di memori halaman; reload atau pindah halaman mengembalikan sampel. Halaman daftar/detail sengaja memiliki fixture terpisah: membuka baris menuju **satu detail contoh**, bukan detail persisten record tersebut. Hanya preferensi tema disimpan di localStorage.

Tidak ada panggilan backend/API, WebSocket, autentikasi, upload, penyimpanan draft, email, push notification, atau tiket server. Permintaan asset statis dan ikon CDN tetap terjadi. Search global, percakapan, aktivitas, forward, SLA extension/reminder, anggota, lampiran dan menu di luar halaman yang tersedia adalah tampilan contoh; aksi yang ditekan memberikan penjelasan, bukan keberhasilan palsu. “Muat ulang” hanya merender ulang state lokal; reload browser memulihkan fixture. Scope “Saya Buat” kosong karena fixture tidak memuat tiket yang dibuat actor demo.

Input pengguna (pencarian, judul, nama, alasan PIC) ditampilkan dengan DOM `textContent`/`value`; tidak diinterpolasikan ke HTML. Dialog native menjaga fokus modal; pemeriksaan izin produksi tetap wajib di server saat diimplementasikan.

## Pemetaan implementasi produksi (sudah diperiksa)

- `apps/frontend/src/components/ui/popover.tsx`: Radix Popover dengan Portal untuk picker di luar overflow.
- `apps/frontend/src/components/ui/command.tsx`: Command berbasis **cmdk**, bukan paket Radix Command; dipadukan dengan Popover untuk pencarian PIC/perangkat/aplikasi.
- `apps/frontend/src/components/ui/dialog.tsx`: Radix Dialog untuk alasan reassign/takeover dan fokus modal.
- `apps/frontend/src/features/ticket-board/components/TicketDropdowns.tsx`: dropdown daftar yang ada menggunakan wrapper Radix Select; kosakata/status dan alur perubahan sebaiknya tetap satu sumber ketika UI produksi dipetakan.
- `apps/frontend/src/features/ticket-board/components/ticket-detail/constants.ts` dan `TicketSidebar.tsx`: daftar terminal serta lock requester/terminal. Prototype mengikuti lock inspector untuk semua editor.

`mock-state.js` menyatukan kosakata dan aturan edit demo; `queue.js` memegang data, header, statistik, dan filter antrian untuk Tabel dan Kanban; `motion.js` menangani thumb segmented control dan slide tab sidebar; adapter `*-demo.js` menghubungkan halaman ke shared controls. Tidak ada file produksi yang diubah. Syntax external/inline dan tes DOM serial telah dijalankan; verifikasi visual browser/responsif dilakukan terpisah sebelum sign-off.
