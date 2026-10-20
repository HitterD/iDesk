# Prototype interaktif iDesk

Mockup statis untuk review UI, bukan aplikasi produksi. Buka melalui static server dari root repository agar asset `apps/frontend/public` tetap ditemukan. Ikon memakai Lucide CDN yang sudah ada; tidak ada dependency baru.

## Halaman

- `list.html` — daftar agent. `?queue=oracle`, `web`, atau `mobile` mengganti konteks contoh.
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

## Kontrak data dan batasan

Semua edit tiket/form hanya di memori halaman; reload atau pindah halaman mengembalikan sampel. Halaman daftar/detail sengaja memiliki fixture terpisah: membuka baris menuju **satu detail contoh**, bukan detail persisten record tersebut. Hanya preferensi tema disimpan di localStorage.

Tidak ada panggilan backend/API, WebSocket, autentikasi, upload, penyimpanan draft, email, push notification, atau tiket server. Permintaan asset statis dan ikon CDN tetap terjadi. Search global, percakapan, aktivitas, Kanban, forward, SLA extension/reminder, anggota, lampiran dan menu di luar halaman yang tersedia adalah tampilan contoh; aksi yang ditekan memberikan penjelasan, bukan keberhasilan palsu. “Muat ulang” hanya merender ulang state lokal; reload browser memulihkan fixture. Scope “Saya Buat” kosong karena fixture tidak memuat tiket yang dibuat actor demo.

Input pengguna (pencarian, judul, nama, alasan PIC) ditampilkan dengan DOM `textContent`/`value`; tidak diinterpolasikan ke HTML. Dialog native menjaga fokus modal; pemeriksaan izin produksi tetap wajib di server saat diimplementasikan.

## Pemetaan implementasi produksi (sudah diperiksa)

- `apps/frontend/src/components/ui/popover.tsx`: Radix Popover dengan Portal untuk picker di luar overflow.
- `apps/frontend/src/components/ui/command.tsx`: Command berbasis **cmdk**, bukan paket Radix Command; dipadukan dengan Popover untuk pencarian PIC/perangkat/aplikasi.
- `apps/frontend/src/components/ui/dialog.tsx`: Radix Dialog untuk alasan reassign/takeover dan fokus modal.
- `apps/frontend/src/features/ticket-board/components/TicketDropdowns.tsx`: dropdown daftar yang ada menggunakan wrapper Radix Select; kosakata/status dan alur perubahan sebaiknya tetap satu sumber ketika UI produksi dipetakan.
- `apps/frontend/src/features/ticket-board/components/ticket-detail/constants.ts` dan `TicketSidebar.tsx`: daftar terminal serta lock requester/terminal. Prototype mengikuti lock inspector untuk semua editor.

`mock-state.js` menyatukan kosakata dan aturan edit demo; adapter `*-demo.js` menghubungkan halaman ke shared controls. Tidak ada file produksi yang diubah. Syntax external/inline dan tes DOM serial telah dijalankan; verifikasi visual browser/responsif dilakukan terpisah sebelum sign-off.
