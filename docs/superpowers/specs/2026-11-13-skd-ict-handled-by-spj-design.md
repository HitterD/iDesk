# Permintaan ICT dari Sukodono ditangani Sepanjang (design)

Tanggal: 2026-11-13. Branch `fix/ticket-skd-to-spj` dari main 0c518e9a.

## Aturan
- Master site punya kolom `handledBySiteId` (nullable, FK ke sites). SKD.handledBySiteId = SPJ. Site lain null (ditangani sendiri).
- "Site penanganan" sebuah permintaan = `handledBySiteId ?? siteId` dari site pemohon.
- Dipakai saat membuat: tiket (semua jalur lewat createTicket, termasuk atas nama user dan iPop), access request (tiketnya), hardware request, e-form request.
- Akun user TIDAK berubah (tetap SKD) — CSI tetap memakai site akun.

## Akses pemohon
- Pemohon selalu bisa melihat/membatalkan/menindaklanjuti permintaannya sendiri walau site permintaan ≠ site akun: batal tiket, daftar & detail hardware request, jadwal instalasi, mutual scheduling, kredensial e-form.
- Agent tetap dibatasi oleh site permintaan (isolasi site tidak berubah).

## Data lama
- Migrasi additive: kolom + set SKD→SPJ + pindahkan tiket/hardware request/e-form/workload yang terlanjur SKD ke SPJ.

## Di luar cakupan
- CSI ICT: survei Sepanjang sebaiknya mencakup site SKD agar user Sukodono bisa mengisi (catatan untuk admin, tidak diubah).
