# CSI HC — Audit pasca PR #96 (design)

Tanggal: 2026-11-11 · Grilling Q1–Q13 (semua rekomendasi diterima). Branch `fix/csi-hc-audit` dari main 1c39278f.

## A. Wizard survei HC (bug P1)
- Langkah "Orang yang dinilai" untuk SEMUA survei HC memakai pemilih PIC (`PicAssignment`), bukan pemilih akun user (`RateeAssignment`). Copy disesuaikan per mode (Ditentukan HC vs responden memilih).
- Tombol "Ambil dari template" di langkah Orang yang dinilai dan di empty state langkah Penilai (`HcPairsPanel`): pilih ≥1 lokasi template → pratinjau (pakai preview apply) → terapkan ke draft ini (sync). Jika draft punya ratee PERSON tanpa `picId`, dialog konfirmasi "N orang non-PIC akan diganti dengan PIC dari template" lalu ratee non-PIC (dan pasangannya) dihapus sebelum sync. Hanya untuk survei yang belum ada jawaban.
- Readiness backend + ✓ frontend: survei HC `ratees` ok hanya bila ≥1 ratee dengan `picId` atau TEAM; publish diblokir bila tidak.
- Wizard generik `?wizard=new` untuk scope HC dialihkan ke `HcSurveyWizard`.

## B. Semua orang masuk report
- Saat apply template (create/sync/preview): baris PIC tanpa master dibuatkan master `csi_pics` (alur createPicsFromDirectory / fallback NIK `TPL-`), site = lokasi template.
- PIC aktif tanpa penilai tetap menjadi ratee (0 pasangan). Report: daftar terpisah "Belum ada penilaian" (nilai "–") selain "Belum cukup penilai (< 5)". Apply report: `picsWithoutRaters` tetap dilaporkan sebagai peringatan (bukan dilewati).
- Tim custom ikut tabel "Nilai per layanan, bagian & PIC" sebagai baris bertanda "Tim" di bawah layanannya (recap HC tidak lagi mengecualikan TEAM custom). Jumlah "Yang dinilai" = isi tabel.
- Ranking: baris dengan penilai ≥ 5 tapi rata-rata null tidak boleh hilang diam-diam (masuk "Belum ada penilaian").

## C. Konsistensi angka
- HC: semua tempat (PDF, Excel, dashboard admin, report penanggung jawab) memakai rata-rata per-penilaian (hcRecap basis). ICT tetap rata-rata per respons.
- SLA: satu persentase "sudah mengisi = jawaban ÷ basis" vs target; kolom/label "% Pengisi (SLA)" (÷ target) dihapus dari PDF/Excel/dashboard/Rekap.
- PIC tanpa bagian → "Tanpa bagian" di semua tabel (bukan fungsi pelayanan); Pengaturan → PIC HC menampilkan peringatan "N PIC belum punya bagian".
- Halaman 1 (PDF) + Ringkasan Excel: baris "N penilai di template belum punya akun iDesk (tidak termasuk basis)" bila N > 0.

## D. Audit menyeluruh modul CSI (HC + ICT)
- Review kode + uji alur browser lokal: bug data, keamanan/otorisasi, anonimitas, performa, konsistensi angka, UX. Critical/Important langsung diperbaiki dengan tes; Minor/tampilan dilaporkan ke user.

## E. Excel baru
- Report utama (anonim), sheet bernomor: `1 Ringkasan` (judul, KPI, SLA, daftar isi dengan hyperlink), `2 Per layanan`, `3 Layanan-bagian-PIC`, `4 Peringkat`, `5 Partisipasi & SLA` (per site + per departemen), `6 Rekap responden`, `7 Per pertanyaan`, `8 Komentar`. ICT: sheet yang relevan saja (tanpa 2/3/6 HC), tetap bernomor.
- File kedua "Data mentah (rahasia)": jawaban mentah per tim/orang, Penilai x Subjek, HC Jawaban Responden; label RAHASIA di header dan nama file; endpoint/tombol terpisah (admin). Untuk penanggung jawab layanan: file report utama layanan (anonim) + file data mentah layanannya (boleh nama, keputusan sebelumnya).
- Gaya baru (modul gaya CSI tersendiri; tidak menyentuh report tiket): header navy `#1F3A5F` teks putih, zebra `#F5F7FA`, border `#D9DEE7`, font Calibri 10/11, band nilai teal-pucat `#D7F2EC`, amber-pucat `#FFF1CC`, coral-pucat `#FBDDD7` (teks gelap), baris total tebal dengan latar `#E8EDF5`, angka 2 desimal, persen sebagai format persen asli, tanggal sebagai Date, freeze + autofilter (total di luar range filter), lebar kolom otomatis, wrap, siap cetak (landscape, fit width, judul berulang). Template impor kosong & export pasangan ikut gaya baru.
- Contoh file simulasi dikirim ke user sebelum finalisasi.
