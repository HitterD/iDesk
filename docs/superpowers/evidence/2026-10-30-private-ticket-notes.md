# Private ticket notes — bukti sementara 2026-10-30

Status: IMPLEMENTASI BERJALAN, belum release-ready. Tidak commit/push/deploy, tidak menjalankan migrasi ke database aktif.

## Verifikasi yang dijalankan
Semua foreground, satu file serial, Jest --runInBand / Vitest --maxWorkers=1 --no-file-parallelism.

| File test | Hasil terakhir diamati |
|---|---:|
| ticket-oracle-access.spec.ts (baseline existing) | 28 PASS |
| notes/ticket-note-access.service.spec.ts | 15 PASS |
| notes/ticket-note-document.validation.spec.ts | 10 PASS |
| notes/dto/ticket-note.dto.spec.ts | 3 PASS |
| migrations/1794050000000-CreatePrivateTicketNotes.spec.ts | 2 PASS (SQL contract, bukan live DB) |
| notes/ticket-note-command.service.spec.ts | 7 PASS |
| notes/ticket-note-query.service.spec.ts | 1 PASS |
| notes/ticket-note-document.service.spec.ts | 4 PASS |
| notes/ticket-note-discussion.service.spec.ts | 6 PASS |
| notes/ticket-note-attachment.service.spec.ts | 4 PASS |
| notes/ticket-note-notification.service.spec.ts | 3 PASS |
| notes/ticket-note-visibility.service.spec.ts | 2 PASS |
| notes/ticket-note-action-items.service.spec.ts | 2 PASS |
| notes/ticket-note-public-share.service.spec.ts | 2 PASS |
| ticket-merge.service.spec.ts | 2 PASS |
| ticket-messaging.service.spec.ts | 17 PASS |
| uploads-file.handler.spec.ts | 13 PASS |
| audit/audit.service.spec.ts | 5 PASS |
| notifications/notification-center.action-items.spec.ts | 5 PASS |
| notifications/web-push.spec.ts | 8 PASS |
| frontend NotesDrawer.test.tsx | 1 PASS |
| frontend NoteDocumentEditor.test.tsx | 2 PASS |
| frontend NoteDiscussion.test.tsx | 1 PASS |
| frontend TicketHeader.test.tsx | 10 PASS |
| frontend ActionCommandCenter.test.tsx | 1 PASS |

Build backend PASS. Build frontend PASS (CSS unknown @property --seg-fade-l/--seg-fade-r warnings existing). git diff --check PASS saat dijalankan. Impeccable mechanical detector pada notes UI: [].

Sebagian test baru awalnya gagal karena modul belum tersedia, lalu PASS setelah implementasi; ini tidak sama dengan membuktikan setiap assertion melalui behavioral RED. Behavioral RED->GREEN diamati untuk akses transaction lock, stale pre-lock snapshot, upload static deny, legacy merge privacy, note relocation, public share selected solution/idempotency forwarding, codeBlock language default dan stable notification ID.

## Review awal dan perbaikan
Fresh reviewer baca-saja menemukan stale note snapshot setelah lock, mark-read race, multipart authz terlambat, public-share retry/selection race, outbox duplikasi, note tidak ikut merge, enum migration naming dan lease expiry behavior. Perbaikan berjalan: latest locked snapshot; transactional read locking; upload guard sebelum interceptor; selected-solution check + authorization callback dalam reply transaction; stable notification ID + claim SKIP LOCKED/capped retry; move note stable ID+finalize session saat merge; dukung kedua nama enum; recovery cron. Belum final independent review.

## Belum diuji / belum selesai
- PostgreSQL nyata (container sementara terpisah, sudah dihapus): `ticket-note-lease.integration.spec.ts` 3 PASS — migrasi up/down, dua acquire lease konkuren hanya satu menang, FK solusi lintas-note ditolak (23503), claim outbox SKIP LOCKED hanya sekali. Belum: concurrency layanan penuh (merge/forward/revoke vs save) dan migrasi pada salinan skema produksi.
- API end-to-end/DI boot dengan DB sungguhan, dua akun browser, mobile/dark/keyboard belum diuji.
- Fully atomic public-share idempotency race / notification channel crash recovery masih perlu test nyata.
- Bell list/count authorization sudah dihubungkan, tetapi query masih in-memory filtering seluruh notifikasi dan belum memenuhi target efisiensi/pagination.
- Dokumentasi lock order perlu dibuktikan pada forward/status/role/site update konkuren; integration coverage belum cukup.
- Realtime document invalidation/presence dan immediate revocation/cache purge belum lengkap; sekarang ada generic event dan polling fallback.
- Editor unmount flush/error preservation/lock-owner/takeover dan discussion pagination/solution provenance masih perlu penguatan.
- Audit metadata sudah ditulis/dikecualikan global; seluruh projection/export tests dan integration exclusions belum lengkap.
- Total test di tabel bukan satu full-suite run; beberapa file berubah setelah run sebelumnya, perlu rerun selektif sebelum klaim final.

Ledger rinci: `.superpowers/sdd/snug-meandering-sutton/progress.md` (ignored). Plan: `../plans/2026-10-30-private-ticket-notes.md`.

## Uji browser (2026-10-30, stack lokal terisolasi)
Backend :5150 + Vite :4150 terhadap Postgres/Redis container sementara (sudah dihapus); `idesk-postgres` dan dev server :5050 tidak disentuh. Akun seed + `agent.ops2` (AGENT_OPERATIONAL_SUPPORT, SPJ).

Lulus: tombol `Catatan Internal (n)` hanya untuk handler; toggle composer hilang; buat catatan + pilih anggota; edit dokumen dengan checklist + autosave; diskusi + mention; outbox → bell generik tanpa ticketId hanya ke anggota (bukan pelaku), email hanya INVITE; Action Center HIGH untuk mention lalu hilang setelah dibaca; deep link `?noteId=` membuka drawer; solusi dipakai + kirim balasan publik (teks saja, clientRequestId tersimpan); revisi 1 per sesi; tidak ada sesi edit tertinggal; mobile 390px rapi.
Isolasi API: pemohon, admin, manager non-anggota → 404 untuk list/detail/pesan/kirim; agent.oracle (tim lain) → 404; `/uploads/ticket-notes/...` → 404; respons tiket & notifikasi pemohon tidak memuat isi dokumen/judul catatan. Audit tercatat (CREATE/SOLUTION/PUBLIC_SHARE).

Bug ditemukan & diperbaiki:
1. Outbox worker menyimpan tuple `[rows, count]` dari driver → delivery tak pernah terkirim (eventId null). Fix + regression test Postgres nyata RED→GREEN (4 PASS).
2. Mark-read SQL `uuid = text` → "Database error". Fix cast eksplisit; diverifikasi di browser.
3. Status "Belum disimpan" palsu setelah Selesai edit (`setEditable` memicu update TipTap). Fix; diverifikasi di browser.
4. `synchronize` dev gagal karena nama index otomatis bentrok → index diberi nama eksplisit sesuai migrasi.

Catatan lingkungan: native `bcrypt`/`sharp` perlu `npm rebuild` setelah `npm ci --ignore-scripts`; backend butuh Redis (Bull queue `emails`) untuk boot.
Belum diuji: dark mode, navigasi keyboard penuh, dua editor bersamaan di dua browser, pencabutan akses saat drawer terbuka.
