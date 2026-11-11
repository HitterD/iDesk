# CSI HC — Template penugasan multi-site (design)

Tanggal: 2026-11-10 · Hasil grilling Q1–Q25 (semua rekomendasi diterima user).
Lanjutan dari PR #94 (template SMG) dan #95 (ICT parity).

## Lokasi
- Empat lokasi template: `SMG` Semarang, `KRW` Karawang, `SPJ` Sepanjang, `JTB` Jakarta (kode site Jakarta = `JTB`, bukan JKT).
- Tab lokasi selalu tampil. Lokasi tanpa template: state kosong dengan "Impor Excel" dan "Unduh template kosong".
- Satu template per lokasi berisi banyak layanan (HCD/HCC/HCS); file per bagian (mis. Comben) menambah ke template lokasi.

## Format Excel (dua-duanya dikenali otomatis)
1. **Daftar (layout Semarang)** — sheet pertama yang bukan `Karyawan*`/`Tim`/`Petunjuk`; header baris 1:
   `Area`, `Nama Lengkap Karyawan (HC)`, `Jabatan`, `Fungsi pelayanan`, `Nama Lengkap Penilai`,
   `Jabatan (akan terisi otomatis)`, opsional NIK penilai: `NIK HRIS (dikosongkan saja)` atau `NIK Penilai`.
2. **Matriks centang (layout Comben)** — sheet `List PIC` + `List Penilai`; baris header berisi `NIK`, `NAMA`, `JABATAN`,
   `LOKASI`; baris di atasnya berisi grup layanan (`HC Services`→HCS, `Comben`→HCC, `HC Development`→HCD, carry-forward
   ke kanan); setiap kolom setelah `Sum` adalah satu pelayanan; sel berisi apa pun selain kosong/0 = dicentang.
   - Fungsi pelayanan PIC = nama kolom yang dicentang digabung `" · "`.
   - Pasangan = penilai × PIC yang berbagi ≥1 pelayanan; dihitung sekali; tidak menilai diri sendiri (NIK sama).
   - NIK ganda di List Penilai digabung (union centang). NIK dinormalisasi 8 digit (zero-pad).
   - Sheet lain (mis. `Matrix Format ICT`) diabaikan.
- Sheet opsional `Karyawan <apa saja>` (Nama, Jabatan[, NIK]) → jabatan per nama (bukan hardcode `Karyawan SMG`).
- Sheet opsional `Tim`: `Nama Tim | Anggota | NIK` (satu anggota per baris).

## Identitas PIC / tim di kolom PIC
Urutan: (1) cocok karyawan/PIC master/direktori → PIC; (2) cocok tim custom yang ada di site → tim; (3) diawali
`Tim`/`Team` → tim custom baru; (4) sisanya **unresolved** → admin memilih di pratinjau: tim baru / PIC baru /
salah ketik → pilih PIC (saran nama mirip). Commit ditolak selama ada unresolved.
PIC yang belum ada di master dibuat otomatis saat commit (pratinjau menampilkan jumlahnya).

## Penilai
- Status: **Terkonfirmasi** (admin konfirmasi/pilih akun, ditambah manual lewat akun, atau NIK cocok `User.employeeId`)
  · **Cocok otomatis** (nama sama persis 1 akun) · **Nama ganda** · **Belum punya akun**.
- Pencocokan: NIK dulu, lalu nama.
- Saran akun (fuzzy, site lokasi di atas; tampil departemen/site/email) untuk ganda / belum punya akun / ganti akun.
- Konfirmasi per baris, per kartu PIC, dan per orang (tampilan "Per penilai" — berlaku ke semua PIC orang itu).
- Panel "N perlu dicek" di header template, aksi per baris; tidak ada "terima semua".
- Tambah penilai manual: ketik nama → saran akun; dipilih dari akun = langsung Terkonfirmasi.
- Cocok otomatis tetap ikut survei (peringatan di pratinjau, tidak memblokir).

## Impor ulang
Pratinjau diff `+ ditambah / − tidak ada lagi / ~ berubah`. Opsi "Hapus yang tidak ada di Excel" (cakupan: hanya
layanan yang ada di file); penilai terkonfirmasi dan tim custom aman kecuali opsi kedua "termasuk yang terkonfirmasi"
dicentang. Survei berjalan hanya berubah lewat "Sinkronkan".

## Orang & foto (HC)
- PIC template otomatis tampil per site (PIC tanpa akun tetap kartu, badge "Belum punya akun", bisa diberi foto).
- Tim: per site boleh 1 tim `SITE` + banyak tim `CUSTOM` (nama, layanan wajib, anggota akun/nama bebas).
- Tombol utama: "Impor Excel" (ke template) dan "+ Tim custom"; tambah manual = link cadangan.
- Foto: unggah per kartu + unggah massal (banyak file / ZIP) — nama file dicocokkan ke nama PIC/tim, pratinjau dulu.
- Hasil tim tampil di "Hasil penilaian saya" tiap anggota, label "Tim X", aturan ≥3 penilai.

## Tab Penilai (HC)
Ringkasan hanya-baca penilai dari template per lokasi (jumlah per status) + link ke template untuk memperbaiki.

## Survei
Survei HC selalu dari template: nama & periode → centang lokasi (ringkasan tiap lokasi) → pratinjau yang dilewati →
buat. Penilai lintas lokasi dihitung sekali. Sinkronkan lokasi tambahan ke survei existing menambah site-nya otomatis.

## Template kosong
Unduhan per lokasi: `List Penilai 2026` (header), `Tim`, `Karyawan <KODE>` (user aktif site: nama, jabatan, NIK),
`Petunjuk`.

## Data uji
Excel dummy KRW (beberapa PIC + 1 tim custom 3 orang) hanya di DB lokal; konversi Comben ada di
`Downloads/CSI HC 2026 (sepanjang - comben).xlsx` (3 PIC, 271 pasangan).
