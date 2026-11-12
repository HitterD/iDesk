# CSI HC — Sukodono, template rapi, edit nama PIC (design)

Tanggal: 2026-11-12 · Grilling Q1–Q9 + tambahan (semua rekomendasi diterima). Branch `feat/csi-hc-sukodono` dari main 395da04c.

## A. Site Sukodono (SKD)
- Migrasi additive: site baru `code = 'SKD'`, `name = 'Sukodono'`, aktif (insert jika belum ada).
- Peta lokasi report: `SJA3 ↔ SKD` (bukan SPJ lagi); `SPJ ↔ SJA1` tetap. Fallback akun site SKD → SJA3.
- Semua daftar kode site yang di-hardcode ikut SKD: auth (UUID→code bila ada map; utamakan lookup DB), template locations BE/FE, import user (VALID_SITES + template Excel petunjuk/dropdown), warna site (SITE_TONES, SiteSelector, BulkSiteChangeDialog), dan tempat lain yang ditemukan grep. JKT/JTB tone diperbaiki agar Jakarta tidak neutral.
- Akun karyawan dipindah admin (ubah site massal) — tidak ada migrasi data akun.

## B. Lokasi template & hint
- Urutan dan hint: Sepanjang "SJA 1", Karawang "SJA 2", Sukodono "SJA 3", Semarang "SJA Semarang", Jakarta "SJA Jatibaru".
- Dipakai di tab Template penugasan, grup "Orang & foto" ("HC Sukodono (SJA 3)" dll.), wizard survei (pilih lokasi), dialog Ambil dari template, ringkasan Penilai.

## C. Impor template = ganti total
- Commit impor: hapus semua baris PIC/tim (+ penilai) template lokasi itu lalu tulis isi file; pin akun (`userId`) + `confirmedAt/confirmedById` penilai yang namanya (normalised) sama pada PIC/tim yang sama dibawa ke baris baru.
- Pratinjau: "Template <lokasi> akan diganti: X PIC / Y penilai lama → A PIC / B penilai baru; N konfirmasi dipertahankan". Opsi prune lama dihapus (BE + FE). Survei lama tidak terpengaruh. Master PIC/tim tidak dihapus.

## D. Kartu template responsif (15–16")
- Grid kartu: 1 kolom < md, 2 kolom md–2xl, 3 kolom ≥ ~1440px (container-aware bila mungkin, mempertimbangkan sidebar 230px).
- Baris penilai: tanpa scroll horizontal (overflow-y saja), nama truncate + title; badge status penuh bila muat, jadi titik warna + tooltip/aria-label saat kartu sempit (container query atau breakpoint).
- Header template (ringkasan + tombol) membungkus rapi. Verifikasi visual 1280×720, 1366×768, 1920×1080.

## E. Hapus tim
- Tim SITE juga bisa dihapus (UI tombol Hapus di sheet edit tim site).
- Tim (SITE/CUSTOM) yang dipakai survei DRAFT/belum mulai tanpa jawaban: boleh dihapus; ratee tim itu (+ pasangan/dimensi) dikeluarkan dari survei tsb; konfirmasi menyebut jumlah/nama survei.
- Diblokir bila dipakai survei yang sedang berjalan atau sudah ada jawaban (pesan menyebut nama survei). Survei selesai/batal → tim dinonaktifkan (bukan dihapus).

## F. Edit nama PIC (satu sumber)
- Endpoint ubah nama PIC master (`csi_pics.fullName`) dipakai dari: ikon ✏ nama di kartu template, sheet edit "Orang & foto" (kunci pic:), menu PIC HC.
- Efek: master PIC + semua baris template yang tertaut (`picId`) memakai nama baru; tampilan Orang & foto, PIC HC, wizard; ratee survei DRAFT/belum mulai tanpa jawaban ikut diperbarui (`displayName`); survei berjalan/selesai tetap.
- Impor ulang mencocokkan master lewat NIK/link, sehingga nama hasil edit tidak memunculkan PIC ganda (nama baru di file atau nama lama di file tetap tersambung bila NIK sama; tanpa NIK, alias nama lama dikenali dari baris template sebelumnya).

## G. Orang yang dinilai dari template
- Langkah "Orang yang dinilai" HC: filter lokasi template (multi, default = site survei), daftar hanya PIC/tim dari template lokasi terpilih dengan nama terkini; opsi "Semua PIC". "Ambil dari template" tetap (PIC + penilai).

## H. Bagian penilaian otomatis
- Saat template diterapkan (create, sync, apply-many) atau PIC/tim dipilih manual: nyalakan "Penilaian tim" bila ada ratee TEAM dan "Penilaian per orang" bila ada ratee PERSON.
- Mematikan bagian yang masih berisi ratee → konfirmasi "N tim/PIC tidak akan tampil ke penilai"; readiness memberi peringatan bila ada ratee di bagian yang mati.
