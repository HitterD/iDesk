# Prototype interaktif iDesk

Mockup statis untuk review UI, bukan aplikasi produksi. Buka melalui static server dari root repository agar asset `apps/frontend/public` tetap ditemukan. Ikon memakai Lucide CDN; font fallback Inter dimuat dari Google Fonts. Tidak ada dependency npm baru.

## Halaman

- `list.html` — daftar agent (Tabel). `?queue=oracle`, `web`, atau `mobile` mengganti konteks contoh.
- `kanban.html` — antrian yang sama dalam tampilan Kanban: kolom Open / In Progress / Waiting Vendor / Resolved (Resolved juga menampung Closed, hanya baca). Header, statistik, filter, dan data identik dengan `list.html` karena keduanya memakai `queue.js`.
- `ticket.html` — inspector agent; `?as=user` menampilkan portal pemohon hanya baca.
- `my-tickets.html` — portal pemohon, pencarian dan filter tiket saya.
- `new.html` — katalog jenis bantuan; `?as=user` mempertahankan navigasi pemohon.
- `form.html?type=service` — form contoh; tipe lain: `oracle`, `web`, `mobile`. Tambahkan `&as=user` untuk portal pemohon.
- `?theme=dark` / `?theme=light` dapat dipakai pada semua halaman.

## Interaksi yang berfungsi

- Semua dropdown memakai `dropdown.js`: popover dipasang langsung di body, posisi fixed, flip/clamp viewport, daftar dapat digulir, selected check, pencarian opsional, ArrowUp/ArrowDown, Home/End, Enter, Escape, klik luar, dan pengembalian fokus. Tombol mempunyai `aria-haspopup`/`aria-expanded`.
- Status, prioritas, site, pencarian, scope dan kartu statistik daftar memfilter baris secara kumulatif. Reset membersihkan filter. Angka statistik dihitung dari **10 record contoh**, bukan jumlah produksi.
- Prioritas/status/PIC inline dan properti inspector agent mengubah record lokal. PIC dan takeover saat memulai tiket milik PIC lain memerlukan dialog dengan alasan minimal tiga karakter. Batal/Escape tidak mengubah state. Actor contoh: **RM Bagastyo Anggoro**.
- `RESOLVED`, `CLOSED`, `CANCELLED` hanya baca; inspector pemohon tidak mempunyai editor. Site dan SLA bukan dropdown. Pilihan status biasa mengikuti empat status editor: Open, In Progress, Waiting Vendor, Resolved; pembatalan tersedia melalui action khusus inspector.
- Inspector memperbarui label header/properti dan menambahkan catatan perubahan PIC lokal. Waktu SLA dan pesan historis tetap ilustrasi, bukan kalkulasi SLA produksi.
- Form service: kategori/perangkat/aplikasi; semua form: urgensi, pemohon sendiri/orang lain, penghitung judul/detail, template cepat, validasi wajib, reset judul/detail/nama, dan pratinjau submit. Submit **tidak membuat tiket**, tidak menghasilkan nomor tiket, dan tidak mengirim data.
- Portal pemohon: pencarian, statistik, filter status dan ukuran halaman. “Dalam penanganan” mencakup In Progress dan Waiting Vendor. Empat sampel tidak membutuhkan halaman lanjutan.
- Menu profil: ganti tema, buka demo agent/pemohon, informasi prototype. Status Online/Sibuk/Tidak tersedia diberi label **demo**, hanya lokal. Tidak ada logout atau simulasi keamanan/auth.

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
