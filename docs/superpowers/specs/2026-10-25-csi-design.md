# CSI (Customer Satisfaction Index) — Design

Hasil sesi grilling 2026-10-25. Semua keputusan di bawah sudah dikonfirmasi user.

## Unit & akses
- Dua unit memakai `ServiceScope` yang sudah ada (`apps/backend/src/shared/core/utils/service-scope.util.ts`): `ICT`, `HC`.
- Admin CSI per unit = user dengan role `ADMIN` atau `MANAGER` **dan** page key `csi_admin_ict` / `csi_admin_hc` di pageAccess efektifnya (preset atau default role).
- Isolasi total antar unit. ADMIN iDesk **tidak** otomatis punya `csi_admin_hc`; default role ADMIN hanya `csi_admin_ict`. HC diberikan lewat preset.
- Admin unit mengelola semua site.

## Master data (per unit)
- Dimensi penilaian: nama, deskripsi, aktif, urutan.
- Departemen CSI: nama, aktif, urutan. Dipakai sebagai dropdown di form. Terpisah dari Department HRIS.
- Penilai (khusus dipakai HC, tersedia untuk kedua unit): daftar User iDesk.

## Periode (per unit + per site)
- Field: judul, kalimat intro, kalimat terima kasih, tanggal mulai, tanggal selesai (tanggal WIB, inklusif), mode responden `OPEN` (semua user aktif di site) / `LISTED` (hanya penilai yang dipasang). Default ICT=`OPEN`, HC=`LISTED`.
- Admin memasang orang yang dinilai (User iDesk) dan dimensi per orang; bisa memasang satu set dimensi ke banyak orang sekaligus. Untuk `LISTED`, admin memasang penilai periode (dari master penilai).
- Rentang tanggal periode untuk unit+site yang sama tidak boleh overlap (= satu periode aktif).
- Buat periode baru boleh menyalin dari periode sebelumnya (teks, orang dinilai + dimensi, penilai).
- Setelah ada ≥1 jawaban, susunan orang dinilai/dimensi/penilai dikunci. Teks dan tanggal tetap bisa diubah (perpanjang / tutup lebih awal).
- Di luar rentang tanggal survei tidak tampil di sisi user (tab, kartu, dan endpoint form).

## Form responden (gaya Google Form, desain Apple)
- Wajib login. Nama terisi otomatis (read-only), departemen dipilih dari dropdown master departemen CSI.
- Satu kartu per orang yang dinilai: bintang 1–5 per dimensi (semua wajib), komentar opsional per orang.
- Progress bar, layar konfirmasi ringkas sebelum submit, submit sekali.
- Responden tidak menilai dirinya sendiri (disembunyikan).
- Satu submission per responden per periode; setelah submit tampil kalimat terima kasih / status "sudah mengisi".
- Muncul sebagai tab di topbar portal requester + item sidebar staf + kartu "Ada survei menunggu" hanya bila ada periode aktif yang eligible.

## Report (tidak anonim)
- Per orang dinilai: rata-rata per dimensi, rata-rata total = rata-rata dari rata-rata dimensi (skala 1–5) dan indeks % = total/5×100, jumlah responden. Drill-down per responden: nama, departemen, nilai, komentar.
- Status responden: daftar sudah mengisi; untuk mode `LISTED` juga daftar belum mengisi beserta total.
- Daftar periode bisa difilter per site. Export Excel.
- Admin boleh reset jawaban satu responden dengan alasan wajib; tercatat di audit log.

## Ditunda (YAGNI)
Bobot dimensi, kategori nilai, grup tim KPI (nilai tim = rata-rata individu, dihitung belakangan), pengingat push/email.
