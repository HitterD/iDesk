# Unifikasi Hardware Request & E-Form ke Tiket IT Support — Design

Disetujui user 2026-11-22 lewat mockup `mockups/ticket-unify.html` (+ `ticket-unify*.css/js`). Mockup adalah acuan visual & perilaku; dokumen ini merangkum keputusan.

## Prinsip
- Satu antrean: setiap Hardware Request / E-Form **adalah tiket IT Support** (`tickets.ticketType = HARDWARE_REQUEST | EFORM_REQUEST`) dengan satu record detail (`hardware_requests` / `eform_requests`, `sourceTicketId` = tiket induk). State machine, tanda tangan, PDF, kredensial lama tetap dipakai.
- Pemohon hanya mengisi yang ia tahu. Keputusan teknis (sumber barang, siapa menyetujui) milik IT.
- Satu tombol utama per layar; aksi jarang di menu "Lainnya"; label "Giliran Anda" / "Bukan giliran Anda".
- UI lama (halaman list/detail/create Hardware & E-Form) tidak dipakai lagi; URL lama redirect ke tiket.

## List tiket (agent)
- Tag tipe di samping nomor: Hardware (oranye, icon `MonitorSmartphone`), E-Form (hijau mint, icon `FileText`); IT Support tanpa tag.
- Dropdown baru **Tipe**: Semua / IT Support / Hardware Request / E-Form Request (dengan jumlah). KPI mengikuti filter.
- Kolom Status = status tiket + sub-label fase (mis. "Menunggu Atasan"). SLA tampil "Dijeda" selama fase bukan giliran IT (approval, pembelian, pengiriman).
- Kanban: tag + sub-fase di kartu.

## Portal pemohon (/client) & approver
- Tab Hardware & E-Form dihapus; semua di **Tiket Saya** + filter tipe (Semua/IT Support/Hardware/E-Form).
- Baris "Perlu tindakan Anda" untuk tiket yang menunggu pemohon.
- Kartu **Akses aktif Anda**: per akses E-Form selesai — sisa hari, tombol Kredensial, tombol **Perpanjang** (≤30 hari).
- Atasan/GM (role apa pun) mendapat tab **Persetujuan** (badge jumlah) berisi tiket yang menunggu tanda tangannya.

## Buat Tiket
- Katalog asli tetap. Seksi "Pengajuan layanan & akses": **Hardware Request** dan **E-Form Request** membuat tiket (form di halaman yang sama).
- Hardware (4 langkah): 1 barang (katalog + keranjang, kategori & cari, qty 1–50, catatan, isian tambahan wajib per barang, "Tulis manual"); 2 untuk siapa (banyak orang, pilih user atau ketik nama, "Untuk saya sendiri", penerima per barang bila >1), divisi penerima (default departemen sendiri), atasan; 3 judul + alasan; 4 tanda tangan. Tidak ada pilihan jenis budget.
- E-Form (5 langkah): 1 jenis (VPN, Website, Network, Flashdisk, Email, Synology NAS); 2 detail per jenis (VPN: Remote PC / Jaringan kantor; Website: daftar domain; Network: tujuan; Flashdisk: hostname, RO/RW, info; Email: local-part + `@kapalapi.co.id`, Pribadi/Bersama; NAS: akun baru/lama + nama akun, server multi SPJ/JKT/KRW/SMG, folder+hak per folder, maks 5 screenshot); 3 masa berlaku (preset +1h/+1mg untuk Flashdisk, +1/+3/+6 bln, +12 bln atau Permanen untuk Website/Email/NAS; maks 12 bulan untuk VPN/Network/Flashdisk); 4 keperluan (chip template) + departemen + atasan; 5 S&K (harus di-scroll sampai bawah) + tanda tangan.
- Mode perpanjangan `?renewFrom=<ticketId>`: isian disalin, mulai = tanggal akhir lama (bila masih di depan) atau hari ini.

## Detail tiket Hardware / E-Form
- Header: nomor, tag tipe, **satu** chip fase, chip SLA (atau "SLA dijeda"), prioritas. Tidak ada Teruskan/Selesaikan; Batalkan + Unduh PDF di menu "⋯".
- Tab: Percakapan · Rincian · Dokumen (vN) · Aktivitas. Chat sama dengan tiket biasa; approver boleh chat.
- Bar "langkah berikutnya" di atas chat: tahap (Tahap n/5), judul, penjelasan, satu tombol utama (+ maks satu sekunder + "Lainnya").
- Panel kanan: kartu **Progres** 5 tahap (Pengajuan, Review & persetujuan, Pengadaan/Pemberian akses, Pemasangan, Selesai) — hanya tahap aktif dibuka; Barang diminta (dengan "Ubah barang" untuk IT) / Akses diminta; Dokumen; Detail tiket (PIC, status tiket, prioritas, alur, no. dokumen dapat diubah IT, sumber barang, divisi).

## Alur Hardware
1. Pemohon kirim → tiket TODO, fase `review`.
2. IT "Tinjau sekarang": ubah/ganti/tambah/hapus barang (katalog + Ganti), pilih **sumber**: Budget tahunan / Non-budget / Ambil dari stok IT; pilih alur: Tanpa / Atasan saja / Atasan + GM (+ pilih atasan & GM); pesan opsional.
3. Persetujuan: atasan/GM buka ringkasan → Setuju (tanda tangan) / Kembalikan ke IT (alasan, fase kembali `review`) / Tolak (alasan). IT bisa "Ingatkan" atau "TTD kertas" (unduh PDF ber-QR → unggah scan; QR harus versi terbaru).
4. Pembelian (dilewati bila stok): per barang Beli/Batal beli + vendor, harga/unit, no & tgl invoice (opsional). Semua batal → minta alasan, tiket ditolak.
5. Barang tiba: centang per barang.
6. Jadwal: barang yang dipasang, teknisi (beban minggu ini; cek bentrok), 1–3 pilihan (preset hari, jam 08–16, durasi 1–4 jam). Pemohon pilih atau "minta waktu lain" (maks 3×).
7. Pemasangan: Mulai → Selesaikan: kode aset per unit (scan kamera / ketik; wajib, unik), foto opsional, tanda tangan teknisi.
8. Pemohon: "Ya, sudah berfungsi" (tiket CLOSED, dokumen FINAL) / "Ada kendala" (kembali ke pemasangan). Tanpa respons: ditutup otomatis 540 menit kerja.
- IT bisa "Ubah barang" sejak review sampai jadwal (alasan wajib; tercatat di chat sebelum→sesudah + versi dokumen).

## Alur E-Form
1. Pemohon kirim → fase `review`. Default alur saat review: VPN Atasan+GM, NAS Tanpa, lainnya Atasan saja.
2. Persetujuan sama seperti Hardware.
3. Pemberian akses: mode "Kirim username & password" (terenkripsi; Email tanpa server) atau "Akses dibuka tanpa kredensial" (nama akun + catatan wajib). Default tanpa kredensial untuk NAS/Website/Flashdisk.
4. Pemohon: "Ya, berhasil" / "Ada kendala". Kredensial: tersamar, tombol mata & salin per baris; tiap buka tercatat.
- Pengingat H-7, H-3, H-0 tetap.

## Dokumen (1 truth file)
- Satu dokumen per tiket, versi naik di setiap tanda tangan/perubahan barang/alur; QR `ticketNumber/vN`. Impor kertas ditolak bila QR bukan versi terbaru. Selesai → FINAL terkunci.

## Menu agent "Perangkat & Akses" (ganti menu Hardware Requests & E-Form Access)
- **Jadwal Pemasangan**: KPI (minggu ini, belum dijadwalkan, menunggu pemohon pilih, jadwal ulang), kalender minggu per teknisi (filter teknisi), antrean "Perlu dijadwalkan", "Jadwal saya hari ini", beban teknisi.
- **Masa Berlaku Akses**: KPI/filter Segera berakhir (≤7 hari) / Kedaluwarsa / Aktif / Permanen, timeline, aksi Ingatkan / Cabut akses (buat tiket pencabutan) / buka tiket.
- **Katalog Hardware**: KPI, cari, filter kategori & status (termasuk nonaktif), tambah/ubah (nama, kode unik huruf besar, kategori, spesifikasi singkat, urutan, tampil di form, isian tambahan teks/angka/pilihan + wajib), toggle tampil, hapus.
- **Ringkasan**: request aktif/pembelian/menunggu pemasangan/selesai bulan ini, posisi request, barang terbanyak 30 hari, beban teknisi, umur request.

## Data lama
- Migrasi: setiap `hardware_requests` / `eform_requests` tanpa `sourceTicketId` (selain DRAFT/CANCELLED proposal) dibuatkan tiket induk; nomor HR/F-ICT tetap sebagai nomor dokumen.
- URL `/hardware-requests/:id`, `/eform-access/:id`, `/eform/:id` → redirect ke tiket induk.
- Auto-tiket `[Hardware Installation]` dimatikan untuk request baru.

## Bug lama yang ikut diperbaiki
Filter kategori list diabaikan backend; katalog admin tanpa `includeInactive`; event pengadaan selesai tidak ter-emit (`HR_EVT.PROCUREMENT_DONE`); aging reminder tanpa listener; isian wajib katalog tidak divalidasi; catatan pengadaan/jadwal tidak tersimpan; nama akun Synology tidak terkirim; aturan pembaca kredensial tidak konsisten (disatukan: pemohon + ICT_ROLES).

## Di luar cakupan
Register VPN Renewal Hub; editor S&K admin; browse folder NAS otomatis; drag-drop kalender; modul `access-request` & `vpn-access`.
