# CSI HC — Revisi report PDF (design)

Tanggal: 2026-11-10 · Hasil grilling Q1–Q17 (rekomendasi diterima; "Perlu perhatian" & "3 tertinggi" dihapus).
Branch: `feat/csi-hc-template-multisite` (lanjutan).

## Anonimitas
- Lampiran D (nama/email/departemen penilai + Sudah/Belum) DIHAPUS dari PDF untuk semua scope.
- Diganti tabel angka "Partisipasi per departemen": Departemen | Sudah | Total | % | ✓/✗ (terhadap target). Tanpa nama.
- Departemen dengan total penilai < 3 digabung jadi satu baris "Departemen kecil (gabungan)" — berlaku untuk tabel partisipasi per departemen DAN "Rekap per divisi/departemen/bagian responden" di rekap HC. Konstanta `CSI_ANON_MIN_GROUP = 3` (samakan dengan CSI_SELF_RESULT_MIN_RATERS).
- Nama yang belum mengisi tetap hanya di layar admin (tidak berubah).

## Partisipasi & SLA (halaman 1)
- Blok "Partisipasi & SLA": `<sudah>/<basis> sudah mengisi (<pct>%)`, `Target <t>% = <n> orang`, status: "Memenuhi SLA" (hijau) atau "Belum memenuhi SLA — kurang <k> jawaban" (merah).
- Per departemen hanya informatif (✓/✗); status resmi = total survei.
- Default target SLA untuk survei HC baru = 90% (`CSI_SLA_TARGET_DEFAULT_HC = 90`); ICT tetap 80%. Survei lama tidak diubah.

## Batas warna nilai (per survei)
- Kolom baru `csi_periods.scoreFairMin` (default 4.0) dan `scoreGoodMin` (default 4.5), numeric(2,1).
- Aturan: nilai < fair → merah, fair ≤ nilai < good → oranye, ≥ good → hijau. Predikat: ≥ good "Sangat puas", ≥ fair "Puas", lainnya "Perlu perbaikan".
- Validasi 1 ≤ fair < good ≤ 5, langkah 0,1. Default disalin dari survei sumber saat copy; survei lama mendapat 4.0/4.5 lewat default kolom.
- Input di form survei (dekat target SLA) dengan pratinjau 3 warna.
- Dipakai di: PDF report, Excel export, memo PDF, dashboard admin, report per layanan (penanggung jawab), "Hasil penilaian saya", heatmap/rekap HC di layar. Backend mengirim `scoreBands {fairMin, goodMin}` di setiap payload report/hasil; frontend `scoreTone(avg, bands)`.

## Struktur PDF (HC)
1. **Ringkasan** (halaman 1): skor total + predikat, blok Partisipasi & SLA, kalimat sorotan tingkat LAYANAN (tanpa nama orang: "Layanan tertinggi: HCD 4,41 · terendah: HCS 4,05"), catatan & tindak lanjut.
2. **Nilai per layanan**: tabel dimensi per layanan (5 dimensi nama lengkap, Rata-rata, Penilai, Δ jika ada periode lalu) + tabel per lokasi (layanan × lokasi).
3. **Nilai per layanan, bagian & PIC**: satu tabel bertingkat (layanan → bagian → PIC), kolom 5 dimensi + Rata-rata + Penilai + Δ. Menggantikan "Per layanan - bagian - PIC" + "Per dimensi untuk setiap layanan, bagian dan PIC" + Lampiran A2 (dihapus untuk HC).
4. **Peringkat per layanan**: untuk tiap layanan, peringkat PIC/tim dengan penilai ≥ `CSI_RANK_MIN_RATERS = 5`; skor sama → peringkat sama (1,2,2,4) memakai rata-rata 2 desimal; urut rata-rata asli. Kolom: #, Nama, Bagian/fungsi, Penilai, Nilai, Predikat, (Lalu, Δ jika ada). Di bawahnya daftar "Belum cukup penilai (< 5)" dengan nilai, tanpa nomor. Tanpa kotak 3 tertinggi / perlu perhatian. Peringkat orang/tim umum (lintas layanan) dihapus untuk HC.
5. **Rekap responden** per divisi/departemen (dengan aturan gabungan < 3).
6. **Komentar** anonim dikelompokkan per layanan (tanpa tanggal, urutan acak deterministik).
7. **Lampiran**: nilai per pertanyaan per layanan (bukan per orang), jawaban pilihan, partisipasi per departemen (angka saja), pengesahan.
- Setiap tabel: satu kalimat "cara membaca" (abu, 1 baris). Kolom tanpa singkatan terpotong (header boleh 2 baris). Kolom "Bintang" dihapus. Kolom Lalu/Δ hanya muncul jika periode lalu ada.
- ICT: hanya perubahan lintas-scope (Lampiran D dihapus → partisipasi per departemen angka; blok SLA; batas warna; tanpa kotak spotlight; peringkat dengan minimal 5 penilai & ties) — struktur lain ICT tetap.

## Simulasi
- Script `apps/backend/scripts/csi-simulate-hc-report.ts`: di DB lokal (menolak jalan jika DB_DATABASE bukan `idesk_csi_demo`), buat survei "SIMULASI – CSI HC 2026 (SMG + SPJ)" dari template SMG + SPJ via service apply, publish, isi jawaban acak deterministik (seed) ±85% penilai, sebaran realistis, 1 PIC dengan 2–3 penilai, ±30 komentar generik; tanpa periode lalu.
- PDF diekspor dengan banner "SIMULASI — data jawaban fiktif, bukan hasil survei sebenarnya" di setiap halaman (flag `simulation` di period: nama diawali "SIMULASI" → banner otomatis; konstanta prefix).
- Output: `Downloads/CSI HC 2026 - SIMULASI report.pdf`.
