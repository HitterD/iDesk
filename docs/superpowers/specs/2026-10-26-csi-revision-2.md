# CSI — Revisi 2 (jenis pertanyaan, tim + per orang, multi-site, report format 2025)

Hasil grilling 2026-10-26, disetujui user. Melengkapi `2026-10-25-csi-design.md` dan `2026-10-26-csi-ux-revision.md`; bila bertentangan, dokumen ini yang berlaku.

## Pertanyaan (pengganti "Dimensi")
- Jenis: `STAR` (bintang 1–5), `SCALE` (pilihan berkalimat dengan poin 1–5), `CHOICE` (pilihan tanpa nilai, informasi saja), `TEXT` (jawaban teks bebas). Setiap pertanyaan punya `required` (default true).
- Nilai dihitung hanya dari `STAR` dan `SCALE`. Semua nilai berskala 1–5.
- Editor ala Google Form: satu kartu per pertanyaan (judul, deskripsi, jenis, daftar pilihan + poin, wajib), inline tanpa popup.
- Preset skala:
  - Kepuasan: Sangat puas 5, Puas 4, Netral 3, Tidak puas 2, Sangat tidak puas 1.
  - Kualitas: Sangat baik 5, Baik 4, Cukup 3, Buruk 2, Sangat buruk 1.
  - Frekuensi (tanpa poin): `< 5 kali`, `5 - 10 kali`, `> 10 kali`.
- Tombol "Gunakan template CSI 2025" membuat 9 pertanyaan (urutan dan teks persis, "E-Services" diganti "iDesk"):
  1. CHOICE Frekuensi — "Dalam 1 tahun terakhir, berapa kali Bapak/Ibu meminta bantuan IT Support melalui platform iDesk / Whatsapp / Telepon?"
  2. SCALE Kepuasan — "Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini [Kecepatan respon IT Support terhadap laporan dari pengguna]"
  3. SCALE Kepuasan — "… [IT Support bersikap ramah dan mampu menerima penjelasan terhadap masalah yang dihadapi dengan baik]"
  4. SCALE Kepuasan — "… [Kemampuan diagnosa IT Support terhadap permasalahan yang dilaporkan]"
  5. SCALE Kepuasan — "… [Kemampuan IT Support dalam memberikan solusi atau menyelesaikan permasalahan]"
  6. SCALE Kepuasan — "… [Kecepatan IT Support dalam memberikan solusi atau menangani permasalahan sesuai target yang disepakati]"
  7. STAR — "Bagaimana Anda menilai kemampuan komunikasi IT Support?"
  8. SCALE Kualitas — "Jika anda meminta penjelasan terhadap masalah yang dihadapi. Bagaimana penilaian anda terhadap penjelasan yang diberikan tim IT Support kepada anda?"
  9. STAR — "Bagaimana penilaian anda terhadap kualitas pelayanan tim IT Support secara keseluruhan?"
  ("…" = awalan "Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini ".)
- Dimensi lama otomatis menjadi pertanyaan `STAR`.

## Master data & urutan
- Pertanyaan dan departemen: tambah/ubah inline, tanpa popup. Item baru selalu di urutan paling bawah.
- Drag & drop untuk: pertanyaan, departemen, orang yang dinilai dalam survei, pilihan di dalam pertanyaan.

## Struktur survei
- Bagian **Penilaian tim** (label bisa diubah, default "Tim IT Support") dan **Penilaian per orang**, masing-masing bisa diaktifkan/dimatikan (minimal satu aktif), dengan set pertanyaan berbeda. Responden mengisi bagian tim dulu.
- Satu survei bisa mencakup **beberapa site**. Larangan tanggal bertabrakan berlaku per site. Survei terlihat oleh user yang site-nya termasuk.
- Target SLA per survei (default 80%).

## Responden
- Area isi lebih lebar (max 1024px), padding kartu lebih lega, pertanyaan bergaya Google Form (judul → deskripsi → pilihan di bawahnya), chip nama turun baris.
- Nama bisa diubah (terisi otomatis dari akun, wajib). Satu akun boleh mengisi sekali **per nama** (akun bersama bisa dipakai beberapa orang).

## Report
- Rata-rata satu jawaban responden = rata-rata semua jawaban bernilai (STAR + SCALE), skala 5. Average lokasi/survei = rata-rata dari rata-rata jawaban responden. Format `4,52` tanpa %.
- **Excel**: sheet "Rekap", "Penilaian Tim", "Penilaian Per Orang". Format tahun lalu: Timestamp, Nama, Area Kerja, Departemen, lalu per pertanyaan kolom jawaban (+ kolom Point bila bernilai), Average. Header teal, teks terbungkus, border, baris berselang.
- **PDF memo** (pilih beberapa survei dalam satu unit):
  - Halaman 1: "Interoffice Memo", Kepada, CC, Nomor, Dari, Perihal, Tanggal, "Dengan hormat,", paragraf pembuka (bisa diedit, terisi otomatis), tabel Lokasi | Nama | Average | % Pengisi (SLA), penutup, "Hormat kami," / "Mengetahui," dengan nama + jabatan dan ruang tanda tangan.
  - Halaman berikutnya: tabel jawaban per lokasi (format Excel).
  - Lampiran SLA per lokasi: daftar pelapor (Email, Departemen, Nama) + ringkasan Total pelapor iDesk, Target (= target% × pelapor, dibulatkan ke atas), Total responden CSI, % Responden (= responden / pelapor).
  - Isian header memo terakhir disimpan per unit.
- **% Pengisi (SLA)** di memo = min(100%, responden / target).
  - Mode "Hanya penilai terdaftar": basis = penilai terdaftar aktif di site survei (target = basis × target%).
  - Mode "Semua user di site": basis = user unik yang membuat tiket iDesk di site survei dalam 12 bulan sebelum tanggal mulai survei.
- Word (.docx) ditunda.

## Catatan verifikasi
Rumus Average dicek terhadap data CSI 2025: baris "titi yusliyanti" (P1–P5 = 4,5,4,4,4; komunikasi 5; P6 4; keseluruhan 4) → 34/8 = 4,25, sama dengan kolom Average di file 2025. % Pengisi 2025 memakai min(100%, responden / (80% × pelapor)): 216 responden / 65 target → 100%.
