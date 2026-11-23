# Ticket Unify Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup seluruh gap audit Hardware dan E-Form antara aplikasi dan mockup, dari pengajuan sampai konfirmasi akhir.

**Architecture:** Pertahankan shell, chat, API dan state machine yang sudah ada; perbaiki kontrak pada titik yang tidak cocok, alih-alih menyalin JavaScript mockup atau mengganti seluruh halaman. Satu pengendali aksi detail untuk bar, tab dan panel kanan agar izin serta dialog tidak bercabang. Gunakan data nyata untuk semua ringkasan.

**Tech Stack:** React, React Router, TanStack Query, Vitest, NestJS, TypeORM, PostgreSQL, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-hardware-eform-unify-design.md`; referensi visual `mockups/ticket-unify.html` dan `mockups/ticket-unify.js`; cakupan tambahan adalah tabel gap audit terakhir.

## Global Constraints

- Jangan longgarkan batas role/site, akses kredensial, atau kunci dokumen final.
- Pertahankan chat dan form tiket bantuan biasa; jangan menyalin data atau penghitung dummy mockup.
- Tes satu file per giliran; Jest `--runInBand`, Vitest satu worker. Uji browser dan SQL pada database lokal terpisah, bukan produksi.
- Jangan ubah riwayat migrasi yang sudah dikirim. Jika perlu perbaikan data, gunakan perubahan aditif yang dibuktikan di PostgreSQL terpisah.
- Tidak commit, push, merge, atau deploy tanpa instruksi yang berlaku untuk pekerjaan ini.

## Review Focus

- Preset tanpa kedua key lama: pemohon dan Ops Support tetap bisa membuka kedua form; tujuan submit sesuai portal (task 1).
- Tiket lama dengan flow tetapi tipe lama tetap memiliki satu identitas, satu chat, dan masuk filter; tiket biasa tetap biasa (task 2).
- Barang sudah tiba atau fase sudah terkunci: editor tidak mengizinkan penggantian yang ditolak backend; role/site tetap terjaga (task 3).
- Permintaan jadwal ulang tidak menawarkan slot lama; tiket RESOLVED hanya memiliki satu jalur konfirmasi (task 4).
- Bukti unggahan bisa dibaca oleh pihak yang berhak, tidak hanya tampil sebagai angka; pengulangan pemasangan tidak membuat aset ganda (task 5).

### Task 1: Katalog pengajuan dan tujuan setelah submit

**Files:** `apps/frontend/src/features/client/components/create-ticket/{createTicketConfig.ts,TicketTypeCard.tsx}`, `apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx`, `apps/frontend/src/features/client/components/create-request/{RequestFormScreen,HardwareRequestForm}.tsx`, `apps/frontend/src/index.css`.

- [ ] RED: preset tanpa key lama tetap menampilkan kedua kartu dan pencarian VPN menemukan E-Form; submit sebagai USER membuka `/client/tickets/:id`, staf membuka `/tickets/:id`; draf lama tidak ditimpa default penerima.
- [ ] GREEN: hapus ketergantungan kartu pengajuan pada izin halaman lama, tampilkan tag tipe dan deskripsi yang terbaca, sesuaikan grid dan tujuan submit, isi penerima awal pada draf hardware baru.
- [ ] Jalankan spec katalog, halaman buat tiket dan form masing-masing; cek regresi form bantuan biasa.

### Task 2: Identitas tiket lama dan filter daftar

**Files:** `apps/backend/src/modules/ticketing/services/ticket-query.service.ts`, `apps/backend/src/modules/request-flow/services/request-flow-list-fields.ts`, `apps/frontend/src/features/ticket-board/{pages/BentoTicketListPage,components/BentoTicketKanban}.tsx`, halaman detail staf dan pemohon.

- [ ] RED: tiket `SERVICE` yang memiliki flow Hardware masuk filter Hardware dan membuka detail flow dengan chat asli; `SERVICE` tanpa flow tidak ikut. Filter tipe tetap berlaku saat beralih Tabel ↔ Kanban, termasuk hitungan.
- [ ] GREEN: gunakan jenis flow otoritatif untuk tiket yang sudah memiliki flow, dengan klasifikasi biasa untuk tiket lain. Teruskan filter tipe ke Kanban dan query statistik; pertahankan filter site backend.
- [ ] Verifikasi dengan fixture PostgreSQL tiket baru, lama dan tiket biasa di dua site; jalankan spec tabel/Kanban dan tes query serial.

### Task 3: Detail, dokumen, dan editor barang

**Files:** `apps/frontend/src/features/ticket-board/components/request-flow/{RequestFlowPanel,RequestItemsCard,DocumentPane}.tsx`, `dialogs/ReviewDialog.tsx` pada folder yang sama; `apps/frontend/src/features/ticket-board/components/ticket-detail/DetailTabs.tsx`; halaman detail staf dan pemohon.

- [ ] RED: tombol `Ubah barang` membuka editor yang sama dari kartu dan Review IT untuk Hardware di fase yang diizinkan; tidak muncul untuk pemohon/approver, E-Form, atau fase terkunci. Dialog gagal simpan tidak bergerak ke langkah berikutnya. Tab baru tidak menggeser chat.
- [ ] GREEN: sediakan aksi edit dari kartu kanan dan Review, dengan pengendali dialog tunggal dan aturan fase yang sama seperti backend. Tambahkan Rincian dan Dokumen khusus request; pratinjau PDF resmi, unduh/cetak versi terbaru, impor hanya pada fase persetujuan oleh IT, riwayat versi, dan navigasi `tabDoc` ke tab Dokumen. Pertahankan chat, aktivitas dan panel responsif.
- [ ] Jalankan tes kartu, editor, Review, dokumen dan detail per file. Verifikasi aksi serta posisi chat di browser.

### Task 4: Jadwal ulang dan konfirmasi pemohon

**Files:** `apps/frontend/src/features/ticket-board/components/request-flow/{nextStep,RequestFlowPanel}.tsx` (`nextStep.ts`), `apps/frontend/src/features/client/pages/ClientTicketDetailPage.tsx`, `apps/frontend/src/features/devices-access/tabs/ScheduleTab.tsx`.

- [ ] RED: `RESCHEDULE_REQUESTED` tidak menampilkan pilih slot kepada pemohon dan memberi IT aksi usul ulang; backend hanya menerima pilihan pada proposal yang aktif. Banner konfirmasi umum tidak muncul pada request; pada tiket biasa tetap ada. Jadwal saya hari ini tidak hilang ketika melihat minggu lain.
- [ ] GREEN: tentukan aksi dari status jadwal dan slot yang tersedia, bukan `chosen` saja; request memakai jalur konfirmasi khusus; ambil jadwal hari ini dari minggu berjalan dan tampilkan status jadwal sesuai maknanya.
- [ ] Verifikasi urutan usul → pilih → minta jadwal ulang → usul ulang → konfirmasi. Uji `Ada kendala` dan konfirmasi akhir tanpa duplikasi aset.

### Task 5: Bukti pengajuan dan pemasangan

**Files:** `apps/frontend/src/features/client/components/create-request/{EformTypeFields,eformRules,EformRequestForm}.*`, `apps/frontend/src/features/ticket-board/components/request-flow/dialogs/InstallDoneDialog.tsx`, kontrak DTO dan service E-Form/instalasi di `apps/backend/src/modules/request-flow/`.

- [ ] RED: screenshot NAS yang diunggah punya referensi yang disimpan dan dapat ditampilkan kembali; foto serah terima opsional ikut laporan; scan mengisi kode unit yang benar; salinan bukti tidak terlihat oleh peran yang tidak berhak.
- [ ] GREEN: gunakan jalur unggah dan scanner yang sudah tersedia, simpan referensi bukti dengan validasi dan otorisasi yang sama dengan lampiran tiket. Jangan menciptakan aset baru untuk unit yang sudah tercatat. Pisahkan draf perpanjangan dari draf pengajuan baru dan isi ulang rincian jenis akses yang relevan.
- [ ] Jalankan spec form/unggah, DTO dan install report serial; verifikasi unggah, akses ulang dan pembatalan pada database salinan.

### Task 6: Persetujuan dan Perangkat & Akses

**Files:** `apps/frontend/src/features/client/pages/ApprovalsPage.tsx`, `apps/backend/src/modules/request-flow/services/devices-access.service.ts`, `apps/frontend/src/features/devices-access/tabs/{CatalogTab,ScheduleTab,SummaryTab}.tsx`, `apps/frontend/src/components/layout/BentoSidebar.tsx`.

- [ ] RED: pencarian dan filter tipe bekerja di Persetujuan; riwayat selesai hanya memuat keputusan milik pengguna yang login. Katalog bisa disaring per kategori; penghapusan memakai aturan katalog yang sudah ada dan tidak merusak riwayat. Sidebar Ops Support konsisten dengan izin `devices_access`, tanpa memberi akses pada preset yang menolaknya.
- [ ] GREEN: lengkapi tampilan pending/selesai dan filter; tampilkan antrean dan ringkasan sesuai data nyata, termasuk tautan tiket aktif yang relevan. Lengkapi aksi katalog dan rapikan perbedaan visual mockup di keempat tab.
- [ ] Verifikasi Atasan dan GM, serta Ops Support dua site; tes kasus kosong, loading dan gagal API. Jalankan spec terkait secara serial.

### Task 7: Gerbang penerimaan keseluruhan

- [ ] Buat matriks per layar (Buat Tiket, daftar, detail, dialog, Perangkat & Akses) × peran (IT, Pemohon, Atasan, GM) × desktop/ponsel. Bandingkan dengan mockup dan catat pemeriksaan yang lulus, gagal, atau belum dapat diuji.
- [ ] Boot aplikasi lokal utuh terhadap salinan database; buktikan pengajuan Hardware dan semua enam jenis E-Form tersedia, chat dan dokumen dapat dibuka, stok/pengadaan, pergantian barang, atasan/GM, jadwal ulang, instalasi, konfirmasi. Jangan memakai akun atau data produksi untuk aksi tulis.
- [ ] Typecheck, lint, build, jalankan tes serial. Laporkan hasil nyata dan sisa gap; jangan menyatakan tuntas jika masih ada skenario yang belum diuji.
