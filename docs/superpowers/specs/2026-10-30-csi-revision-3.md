# CSI — Revisi 3 (foto & tagline, penilai per subjek, tim per site, laporan & dashboard)

Hasil grilling 2026-10-30, disetujui user. Melengkapi `2026-10-25-csi-design.md`, `2026-10-26-csi-ux-revision.md`, dan `2026-10-26-csi-revision-2.md`; bila bertentangan, dokumen ini yang berlaku.

Mockup yang disetujui: `mockups/csi-redesign.html` (+ `.css`, `.js`), versi v3. Mockup adalah acuan tampilan dan interaksi; data di dalamnya dummy.

## Keputusan (ringkas)

| # | Keputusan |
|---|---|
| Q1 | Mockup HTML statis dulu, baru implementasi React. |
| Q2 | Responden mengisi **satu subjek per layar**, tim dulu, lalu individu, lalu ringkasan "Terima kasih". |
| Q3 | Subjek tim punya **foto tim** yang diupload (bukan avatar user). Tanpa foto → fallback inisial/warna site. |
| Q4 | **Admin CSI** yang mengisi caption/tagline. Tagline melekat ke subjek di master, bisa di-override per periode. |
| Q5 | Animasi halus + reaksi emoji di bintang (lihat "Form responden"). Emoji **hanya** di reaksi bintang; di tempat lain pakai ikon garis. |
| Q6 | Responsif sampai 360 px. Di layar sempit foto pindah ke atas. |
| Q7 | Mode `OPEN` dan `LISTED` tetap ada; **default ICT menjadi `LISTED`**. |
| Q8 | Pemetaan penilai→subjek diatur lewat **matriks** (penilai × subjek) dengan pencarian dan aksi massal. |
| Q9 | Pemetaan disimpan sebagai **template di master** (per scope), disalin ke periode baru, bisa diubah per periode. |
| Q10 | Site subjek **otomatis dari `User.siteId`**, bisa di-override per periode. **Satu tim per site.** |
| Q11 | Default "penilai menilai subjek di site yang sama"; **lintas site = centang manual** di matriks (sel berwarna amber). |
| Q12 | Dashboard CSI baru: tab **Periode aktif** dan **Tren**. |
| Q13 | Pertanyaan punya **label singkat** (mis. "Kecepatan respon") untuk laporan; kosong → teks lengkap dipotong. |
| Q14 | Laporan: skor keseluruhan, kartu per subjek, drawer rincian, tab heatmap "Perbandingan". |
| Q15 | Status responden: progres terhadap target per site, daftar Semua/Belum/Sudah, tombol "Ingatkan". |
| Q16 | Warna: per site, per pertanyaan, dan per nilai (lihat "Bahasa warna"). |

## Model data

### Subjek: foto, tagline, site

Subjek = baris `csi_period_ratees` (per periode). Master untuk orang = `User`; master untuk tim = entitas baru.

- **`csi_teams`** (baru, master per scope + site): `id`, `scope`, `siteId`, `name` (default "Tim {nama site}"), `photoUrl`, `tagline`, `jobTitle`, `isActive`, timestamps. Unik `(scope, siteId)`.
- **`csi_subject_profiles`** (baru, master per scope untuk orang): `id`, `scope`, `userId`, `photoUrl` (null → pakai `User.avatarUrl`), `tagline`, `jobTitle`. Unik `(scope, userId)`.
- **`csi_period_ratees`** (ubah):
  - Tambah `siteId` (wajib; disalin dari `User.siteId` atau `csi_teams.siteId`, bisa diubah per periode).
  - Tambah `teamId` (nullable, untuk `kind = TEAM`).
  - Tambah `photoUrl`, `tagline` (nullable, **override per periode**; null → pakai master).
  - Index unik `UQ_csi_period_ratees_team` (`periodId` saja) diganti menjadi unik `(periodId, siteId)` where `kind = 'TEAM'` → **satu tim per site per periode**.
- Kolom `period.teamLabel` tidak lagi dipakai untuk nama tim (nama ada di `csi_teams.name`). Tetap disimpan untuk kompatibilitas data lama; migrasi mengisi `csi_teams` dari periode yang sudah ada.

### Pemetaan penilai → subjek

- **`csi_rater_assignments`** (baru, template master per scope): `id`, `scope`, `raterUserId`, `subjectKey` (`user:{userId}` atau `team:{teamId}`). Unik `(scope, raterUserId, subjectKey)`.
- **`csi_period_rater_ratees`** (baru, per periode): `id`, `periodId`, `periodRaterId` → `csi_period_raters`, `periodRateeId` → `csi_period_ratees`. Unik `(periodRaterId, periodRateeId)`. Cascade delete dari keduanya.
- Aturan:
  - Penilai tidak boleh dipetakan ke dirinya sendiri (validasi server; sel dikunci di UI).
  - Periode **tanpa satu pun** baris pemetaan → perilaku lama (penilai menilai semua subjek yang terlihat kecuali dirinya). Begitu ada satu baris, periode memakai pemetaan secara ketat.
  - "Isi otomatis: sama site" = setiap penilai terdaftar dipetakan ke semua subjek dengan `siteId` sama.
  - Lintas site = pasangan dengan `rater.user.siteId ≠ ratee.siteId`; tidak ada toggle terpisah.
- Periode baru: pemetaan disalin dari template master (hanya pasangan yang penilai dan subjeknya ada di periode).

### Pertanyaan

- `csi_dimensions` dan `csi_period_ratee_dimensions` tambah `shortLabel varchar(40) null`.
- Laporan, heatmap, Excel kolom ringkas, dan drawer memakai `shortLabel ?? name`.

### Upload foto

- Pakai preset `MULTER_OPTIONS.image` (`apps/backend/src/shared/core/config/upload.config.ts`), folder `uploads/csi/`.
- Pola hapus-file-lama mengikuti avatar (`user-crud.service.ts`).
- JPG/PNG/WebP, ≤ 5 MB. Rasio yang disarankan 4:5; UI memakai `object-position: center 25%`.

## Kelayakan responden (perubahan)

Urutan cek (di `csi-respondent.service.ts`):
1. Periode `PUBLISHED`, hari ini (WIB) di antara `startDate`–`endDate`.
2. Mode `LISTED`: user ada di `csi_period_raters`. Mode `OPEN`: `user.siteId` termasuk site periode (perilaku lama).
3. Daftar subjek yang harus dinilai:
   - Ada pemetaan untuk periode → hanya ratee yang dipetakan ke penilai ini.
   - Tidak ada pemetaan → semua ratee yang terlihat (perilaku lama).
   - Selalu: buang ratee yang `userId` = penilai.
4. Urutan: semua TEAM dulu (site penilai lebih dulu), lalu individu menurut `sortOrder`.

## UI

### Bahasa warna
- **Site**: SPJ teal, KRW cokelat, SMG hijau, JKT sky. Dipakai di badge kode site, header grup matriks, kartu target, garis tren, dan pill kind di foto.
- **Pertanyaan**: titik warna per pertanyaan (urutan tetap: sky, teal, cokelat, amber, lalu berulang) — konsisten di form, laporan, heatmap.
- **Nilai**: ≥ 4,5 hijau · 4,0–4,49 amber · < 4,0 merah — badge skor, cincin, heatmap, kartu pertanyaan setelah dijawab.
- Sapphire hanya untuk tombol primary dan fokus (DESIGN.md). Jangan ungu/indigo.
- Semua warna dari token `--ticket-*` / `--dash-*` yang sudah ada.

### Form responden (`/csi/:id`)
- Layout dua kolom: **foto besar kiri** (min ±520 px tinggi, Ken Burns halus, gradien bawah), **form kanan** (scroll sendiri). Container query < 780 px → satu kolom, foto di atas (rasio 4:3,8, maks 64vh).
- Di atas foto: chip kind ("Penilaian tim · SPJ" / "Penilaian individu · SPJ") berwarna site, nama, jabatan, **tagline tepat di bawah nama** dengan garis aksen pendek di atasnya. Pojok kiri atas: "3 / 15".
- **Rail subjek** (pengganti chip): avatar 42 px dengan cincin progres (amber sebagian, hijau selesai + badge centang), nomor urut. Hanya subjek aktif yang membuka nama + status. Pemisah antara tim dan individu. Overflow → panah geser + fade tepi + auto-center. Tombol **"Semua N"** membuka popover grid semua subjek dengan status. Harus rapi untuk 4, 8, dan 15+ subjek.
- Baris atas: "Subjek X dari N · Y selesai", progress bar (hijau = selesai, amber = subjek saat ini), "Tersimpan otomatis".
- Pertanyaan bintang: hover = bintang menyala + emoji pratinjau samar + label; klik = bintang pop berurutan, riak, emoji memantul (1 😞 · 2 😕 · 3 😐 · 4 😊 · 5 🤩), label ("Sangat kurang" … "Luar biasa!"), latar kartu berubah merah/amber/hijau.
- Pertanyaan skala: pill berwarna merah→hijau sesuai poin.
- Tombol "Lanjut · {nama berikutnya}" (nama disembunyikan di layar sempit), hint "N pertanyaan wajib belum dijawab".
- Selesai: centang tergambar + konfeti + ringkasan bintang per subjek.
- Semua animasi mati saat `prefers-reduced-motion`.
- **Catatan bug mockup (sudah diperbaiki)**: nama class animasi bintang tidak boleh bentrok dengan class komponen lain (mis. `.pop`); di React pakai class ber-prefix modul.

### Admin — Subjek & foto (tab baru di halaman admin CSI)
- Dikelompokkan per site (header berwarna site: kode, nama, jumlah tim/individu, peringatan "N belum ada tagline", "Tambah subjek").
- Kartu: foto 4:3 dengan pill Tim/Individu, nama (2 baris), jabatan, tagline atau "Tambah tagline" (amber).
- Klik kartu → drawer: pratinjau persis seperti form responden (live saat mengetik), dropzone foto, tagline (maks 90 karakter + counter), jabatan, checkbox "Hanya untuk periode ini".

### Admin — Matriks "Siapa menilai siapa" (di dalam periode)
- Stat: penilai terpilih, subjek (tim · individu), pasangan penilaian, lintas site.
- Toolbar: cari penilai (nama, departemen; dari user aktif — sekaligus cara menambah penilai), filter site, legenda (hijau sama site, amber lintas site, abu diri sendiri).
- Aksi: "Isi otomatis: sama site", "Kosongkan", "Salin dari template", "Simpan sebagai template".
- Tabel: kolom dikelompokkan per **site ICT** (header berwarna + tombol "✓ Penilai {site}"), baris dikelompokkan per site penilai. Header & kolom nama sticky. Klik nama = satu baris, klik foto subjek = satu kolom; klik ulang = lepas.

### Admin — Laporan
- Hero: cincin skor keseluruhan (warna sesuai nilai) + kata ("Sangat puas"/"Puas"/"Perlu perbaikan") + indeks + tren vs periode lalu; Jawaban masuk; "Paling kuat"; "Perlu perhatian" (dihitung dari rata-rata per pertanyaan).
- Filter site.
- Kartu per subjek urut nilai: foto + medali peringkat, nama 2 baris, badge site, badge skor berwarna, indeks, bar sebaran bintang, pill pertanyaan terkuat (+ terlemah bila < 4,5).
- Klik kartu → drawer: foto, cincin, bar per pertanyaan (warna pertanyaan), sebaran bintang, komentar (dengan departemen + tanggal).
- Tab "Perbandingan": heatmap subjek × pertanyaan (label singkat, tooltip teks lengkap).
- Export Excel/Memo PDF tetap (revisi 2).

### Admin — Status responden
- Hero: cincin "x/y sudah mengisi", kalimat "Butuh N jawaban lagi untuk target 90%", garis target, kartu per site (warna site).
- Daftar: tab Semua/Belum/Sudah (dengan jumlah), filter site, cari. Urut: belum dulu. Kolom: avatar, nama, departemen, badge site, status, waktu isi / tombol "Ingatkan".
- "Ingatkan semua yang belum" (header) dan "Ingatkan" per orang → notifikasi in-app iDesk (+ Web Push bila aktif). Batasi: satu pengingat per orang per 24 jam.

### Dashboard CSI (halaman baru)
- **Periode aktif**: stat (survei aktif, jawaban masuk, skor rata-rata + tren, site belum capai target), kartu target per site (cincin %, x/y, skor, sisa hari), "Belum mengisi — paling mendesak" (+ ingatkan), komentar terbaru.
- **Tren**: garis skor per site 5 periode terakhir (warna site), perubahan per orang (periode ini vs sebelumnya).
- Akses: sama dengan admin CSI scope bersangkutan (page key `csi_admin_ict` / `csi_admin_hc`).

## Di luar cakupan
- Word (.docx) export.
- Responden mengunggah foto sendiri.
- Penilaian anonim.

## Pertanyaan terbuka
- Tidak ada.
