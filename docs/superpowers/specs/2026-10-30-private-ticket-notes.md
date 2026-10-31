# Catatan Internal Tiket Privat

Disepakati melalui grilling Q1–Q23, 2026-10-30.

## Tujuan
Pisahkan internal note manual dari chat tiket menjadi drawer kanan dengan dokumen bersama dan diskusi ICT privat. Satu tiket dapat memiliki banyak note dengan grup berbeda; note pribadi diizinkan.

## Akses
Pembuat otomatis anggota, tidak dapat keluar. Kandidat hanya user aktif yang sudah memiliki akses handler ke tiket menurut policy tim/site/service-scope existing. Keanggotaan tidak memberikan akses tiket tambahan. Setiap read/write/download/notifikasi membutuhkan anggota AND akses handler terkini; ADMIN tidak bypass membership. Nonanggota tidak tahu note ada, termasuk melalui badge/count/audit/notification/export/socket. Semua anggota boleh menambah anggota; hanya pembuat mengeluarkan orang lain dan soft-delete note.

## Dokumen dan diskusi
Dokumen rich text TipTap: bold, list, checklist, code block, paste gambar privat. Edit bergantian melalui lease server 60 detik, heartbeat 15 detik, autosave debounce 1 detik. Satu revisi per sesi berubah; autosave durable, stale session/version ditolak. Diskusi teks dengan mention anggota eligible dan gambar privat. Semua anggota dapat menandai satu pesan sebagai solusi dipakai, mengganti/mencabut, dengan actor/time. Penandaan solusi tidak resolve tiket. Publikasi teks solusi hanya melalui tombol, preview/konfirmasi dan hak public reply existing; gambar privat tidak ikut.

## Notifikasi dan Action Center
Bell/web push generik (tanpa isi/judul note) saat undangan, pesan/mention, solusi ditandai; bukan kepada pelaku; autosave tidak menotifikasi. Email hanya undangan. Action Center satu item per note dengan pesan orang lain belum dibaca: NORMAL, HIGH bila mention belum dibaca. Mark read hanya sampai sequence yang telah dimuat dalam drawer aktif, bukan saat sekadar membuka tiket. Cache/count/delivery difilter live access; URL deep link berisi ID saja.

## Siklus hidup dan kompatibilitas
CLOSED/CANCELLED read-only; reopen editable. Merge memindahkan note dengan ID/grup/riwayat tetap, akses dihitung ke tiket tujuan. Internal chat lama tetap arsip, toggle manual dihapus, automation ADD_INTERNAL_NOTE tetap. Perbaiki gating frontend role sesuai handler existing dan merge lama agar isInternal tidak hilang. Note privat tidak disertakan di search, report/export, manager activity, webhook/IPOP, automation, TV. Audit metadata saja dan tidak tampil di proyeksi audit global.

## Verifikasi dan batas operasi
Test foreground satu file serial, Jest --runInBand, Vitest maxWorkers=1. Uji akses/nonanggota/revocation, lease konkuren, read race, private attachment, notifikasi, merge, readonly, browser dua sesi. Real DB test hanya disposable yang diizinkan; laporkan skip bila tidak tersedia. Tidak commit/push/deploy atau migrasi produksi otomatis.

Rencana: ../plans/2026-10-30-private-ticket-notes.md.
