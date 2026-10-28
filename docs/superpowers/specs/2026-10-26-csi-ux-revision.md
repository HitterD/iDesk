# CSI — Revisi UX (wizard admin + form bertahap)

Hasil grilling 2026-10-26, disetujui user. Melengkapi `2026-10-25-csi-design.md`; bila bertentangan, dokumen ini yang berlaku.

## Admin — wizard "Buat Survei"
- Halaman Admin CSI = daftar survei + tombol utama "Buat Survei". Dimensi, Departemen, Penilai pindah ke menu "Master data" (sekunder).
- Wizard 6 langkah, stepper bisa diklik untuk lompat ke langkah mana pun:
  1. Info survei — "Mulai kosong" atau "Salin dari survei sebelumnya" (menyalin teks, orang dinilai + dimensi, penilai; tanggal dikosongkan dan wajib diisi ulang). Field: site, judul, kalimat pembuka, kalimat terima kasih, tanggal mulai/selesai, mode responden.
  2. Dimensi — pilih dari master, atau buat dimensi baru langsung di langkah ini.
  3. Orang yang dinilai — pilih orang, pasang dimensi.
  4. Penilai — hanya untuk mode "Hanya penilai terdaftar".
  5. Departemen — semua departemen aktif master dipakai; langkah ini untuk meninjau dan menambah departemen baru.
  6. Tinjau & terbitkan — checklist kelengkapan + tombol "Pratinjau" (form persis seperti user, tidak bisa disubmit).
- Tiap "Lanjut" menyimpan sebagai **Draft**; admin bisa menutup dan melanjutkan dari langkah terakhir.
- Status **Draft / Terbit**. Survei tampil ke user hanya jika Terbit **dan** hari ini dalam rentang tanggal.
- "Terbitkan" aktif hanya jika: ≥1 orang dinilai, setiap orang punya ≥1 dimensi, ≥1 departemen aktif, dan (mode terdaftar) ≥1 penilai.
- Setelah terbit dan belum ada jawaban: masih bisa diubah langsung. Setelah ada jawaban: susunan terkunci (teks dan tanggal tetap bisa diubah).
- Halaman detail survei: checklist ringkas + tombol "Ubah" per bagian (membuka wizard pada langkah tersebut).
- Periode yang sudah ada sebelum revisi ini otomatis berstatus Terbit.

## Responden — form bertahap (section ala Google Form)
- Layar pembuka: judul, kalimat pembuka, "Anda akan menilai N orang · sekitar M menit" (≈10 detik per penilaian bintang, dibulatkan ke atas ke menit, minimal 1), "Tersedia sampai <tanggal selesai>", nama (otomatis), dropdown departemen.
- Satu layar per orang dinilai: foto (`avatarUrl`, data user saat ini) atau inisial berwarna, nama, jabatan, bintang per dimensi dengan deskripsi dimensi sebagai teks bantu, saran opsional. Progress "Orang 2 dari 5" + chip orang yang bisa diklik (centang bila lengkap). Tombol "Lanjut" menempel di bawah layar pada mobile.
- Bintang terlewat: tidak ada error umum; dimensi yang kurang disorot, auto-scroll ke yang pertama, pesan "Beri bintang untuk N penilaian lagi".
- Layar tinjau → kirim → terima kasih.
- Jawaban yang sedang diisi tersimpan otomatis di browser (per survei, per user); refresh/tutup tidak menghilangkan isian. Dihapus setelah berhasil terkirim.

## Ditunda
Notifikasi lonceng saat survei terbit.
