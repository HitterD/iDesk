# Catatan Internal Tiket — Implementation Plan

## Context
Internal note saat ini menyatu dengan chat tiket dan aksesnya berbasis staf, bukan anggota yang dipilih. User menyetujui penggantian alur penulisan manual menjadi ruang privat per tiket: dokumen bersama, diskusi, penandaan solusi, serta notifikasi dan Action Center. Tujuan utamanya adalah kolaborasi ICT tanpa mengekspos keberadaan maupun isi note kepada staf di luar anggota.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans untuk implementasi native bertahap, atau superpowers:subagent-driven-development bila metode tersebut dipilih user. Langkah memakai checkbox.

**Goal:** Menghadirkan banyak catatan privat per tiket dengan kontrol akses anggota, edit bergantian, diskusi, solusi, notifikasi dan Action Center.

**Architecture:** Modul note terpisah dari `ticket_messages`; akses wajib membership AND akses handler tiket saat ini. Gunakan Postgres/TypeORM untuk konsistensi lock, versi dan read-state; Socket.IO hanya menjadi sinyal pembaruan ke penerima yang masih berhak, bukan sumber otorisasi.

**Tech Stack:** NestJS, TypeORM/PostgreSQL, React, TipTap yang sudah tersedia, Socket.IO, notification center existing; tanpa CRDT/Yjs.

**Spec:** Keputusan Q1–Q23 dalam percakapan ini, dikonfirmasi user. Pada implementasi, simpan spesifikasi ini ke `docs/superpowers/specs/2026-10-30-private-ticket-notes.md` dan rencana ke `docs/superpowers/plans/2026-10-30-private-ticket-notes.md` agar executor memiliki sumber permanen. Belum membuat berkas repo selama plan mode.

## Global Constraints / spesifikasi disepakati
- Banyak note per tiket; note pribadi satu anggota diizinkan. Pembuat otomatis anggota dan tidak boleh keluar.
- Kandidat anggota hanya staf yang sudah punya akses handler ke tiket (termasuk batas tim/site). Tidak ada perluasan akses tiket lewat membership.
- Membaca/mengubah/mengunduh/menerima notifikasi memerlukan anggota AND akses handler saat ini; admin tidak mendapat bypass membership.
- Nonanggota tidak melihat isi, keberadaan, jumlah, badge, notifikasi atau aktivitas note. Audit hanya metadata, bukan konten.
- Semua anggota boleh menambah anggota; hanya pembuat boleh mengeluarkan orang lain dan soft-delete note.
- Dokumen TipTap: bold, list, checklist, code block dan tempel gambar. Satu editor dengan lease 60 detik, autosave, heartbeat, dan riwayat satu versi per sesi edit.
- Diskusi: teks, @mention dan lampiran gambar. Satu pesan solusi per note; semua anggota boleh mengganti/mencabut; catat pelaku/waktu.
- Solusi privat; publikasi hanya melalui aksi manual dengan konfirmasi, tunduk hak membalas publik yang sudah ada.
- Bell/web push: anggota ditambahkan, pesan diskusi, mention dan solusi ditandai; tanpa isi note dan tanpa notifikasi kepada pelaku. Email hanya undangan anggota. Autosave tidak menotifikasi.
- Action Center: diskusi belum dibaca NORMAL, mention belum dibaca HIGH; hilang setelah terbaca. Hitungan dan daftar hanya milik anggota berhak.
- Drawer kanan di detail tiket; tombol `Catatan Internal (n)` menghitung note milik viewer dan indikator unread.
- CLOSED/CANCELLED membuat note read-only; reopen mengaktifkan lagi; merge memindahkan note dengan anggota tetap.
- Internal note lama tetap sebagai arsip chat; toggle penulisan manual dihapus; automation `ADD_INTERNAL_NOTE` tetap bekerja seperti sekarang.
- Note privat tidak masuk global search, report/export, manager activity, webhook/IPOP, automation atau TV board.
- Semua test foreground, serial, satu file per perintah; Jest `--runInBand`. Tidak commit/push tanpa permintaan user.
- Ikuti style repo, sanitasi input, parameterized SQL; fungsi <50 baris, file <800 baris, nesting <=4. Jangan refactor lintas fitur tanpa kebutuhan.

## Review Focus
1. Membership dicabut/perubahan tim atau site ketika drawer masih terbuka: cache, socket, unduhan dan notifikasi lama tidak boleh membuka kembali konten.
2. Dua tab/editor atau heartbeat/save yang terlambat: satu pemilik lease yang valid; save lama tidak menimpa editor baru dan draft lokal tidak hilang diam-diam.
3. Read acknowledgement bersamaan pesan baru: hanya pesan sampai watermark yang benar-benar dimuat yang ditandai terbaca.
4. URL gambar/attachment, email, push, audit dan public reply: tidak mengungkap dokumen atau lampiran privat secara tidak sengaja.
5. Merge/close/delete bersamaan autosave/notifikasi: transaksi konsisten, note tujuan tetap tersaring, readonly diterapkan server.

## Fakta kode aktual yang menentukan desain
- Akses existing: `apps/backend/src/modules/ticketing/services/ticket-oracle-access.ts:45–58` mengecek handler terlebih dahulu, lalu requester. Gunakan fungsi ini dengan user dari database; jangan menyalin daftar role.
- Batas departemen ICT existing: `apps/backend/src/shared/core/utils/service-scope.util.ts:20–60`; kandidat anggota memakai hasil akses handler yang sama, bukan sekadar `role !== USER`.
- Frontend lama membatasi note ke ADMIN/AGENT (`apps/frontend/src/features/ticket-board/components/ticket-detail/TicketChat.tsx:154,246`); koreksi tampilan arsip menggunakan akses handler yang dikirim server.
- `Sheet` kanan sudah tersedia (`apps/frontend/src/components/ui/sheet.tsx:34–74`); reuse focus trap, Escape dan portal, bukan overlay baru.
- Merge menyalin pesan tanpa `isInternal` (`apps/backend/src/modules/ticketing/services/ticket-merge.service.ts:132–141`): perbaiki minimal dengan regression test agar arsip lama tidak berubah publik.
- Endpoint audit global termasuk list/stats/export/timeline/recent dan entity (`apps/backend/src/modules/audit/audit.controller.ts:18–141`). Metadata audit note tetap harus dikecualikan dari proyeksi global agar admin nonanggota tidak tahu keberadaannya; tidak cukup hanya menghapus isi note.

- Lampiran biasa memiliki fallback publik (`apps/backend/src/modules/ticketing/presentation/middleware/uploads-file.handler.ts:30–32,81–101`); tambahkan direktori `ticket-notes` ke daftar private dan gunakan endpoint berotorisasi khusus. Jangan menyimpan gambar note sebagai orphan attachment chat.
- User/ticket PK UUID. User role/site/isActive harus dibaca dari DB, bukan hanya JWT yang bisa stale.

## Batas modul dan model yang direkomendasikan
Semua path berikut relatif terhadap `apps/`.

Backend: buat subfolder `backend/src/modules/ticketing/notes/` dengan `entities/`, `dto/`, controller, policy, query, command, document/lease, discussion, attachment dan notification services terpisah. Register melalui `ticketing.module.ts`; pakai `EntityManager` dari transaksi pemanggil untuk merge, bukan event sesudah commit.

Tabel baru:
- `ticket_notes`: UUID id/ticketId/createdById, judul opsional, dokumen JSONB, contentVersion, eventSequence, selectedSolutionMessageId/selectedById/selectedAt, deletedAt.
- `ticket_note_members`: unique noteId+userId, addedById, lastReadSequence. Membership tercabut dihapus; bergabung kembali mulai watermark saat masuk agar riwayat mention lama tidak menghasilkan tugas palsu.
- `ticket_note_edit_sessions`: UUID sessionId/token, noteId/userId, leaseUntil (DB time), baseVersion, state, finalVersion. Satu sesi aktif/note; token berbeda untuk dua tab user yang sama.
- `ticket_note_revisions`: noteId, sessionId unique, dokumen akhir, contentVersion, actorId, closedAt. Autosave mengubah draft tersimpan; tutup/expiry/takeover memfinalisasi tepat satu revisi jika ada perubahan.
- `ticket_note_messages`: UUID, noteId, authorId, content teks, monotonik sequence per note, mentionedUserIds tervalidasi.
- `ticket_note_attachments`: UUID, noteId, uploaderId, storage key privat, originalName/mime/size; asosiasi ke dokumen atau pesan, tanpa URL publik.
- `ticket_note_deliveries`: UUID eventId, noteId, recipientId, sequence, kind, notificationId nullable, state, attemptCount, dedupKey unique. Outbox ini ditulis bersama transaksi event; worker retry idempotent memvalidasi akses sebelum kirim. Relasi ini juga memberi filter akses dan watermark untuk row bell tanpa bergantung payload.data yang tidak dipersist.
- Foreign key solusi wajib memastikan message berasal dari note yang sama; sessionId unique pada revision; batasi counter sequence ke integer aman (atau serialize bigint sebagai string konsisten) dan dokumentasikan tipe API.

JSON TipTap dibatasi schema node/mark yang diizinkan; image node menyimpan attachmentId milik note, bukan arbitrary src/data URL. Render dari struktur valid, bukan arbitrary HTML. Jika membutuhkan ekstensi image/task-list, gunakan versi kompatibel TipTap 3 yang terpasang; baca dokumentasi resmi sebelum menambahkan dependency. Beri batas ukuran/panjang memakai konstanta dan ikuti limit upload existing; jangan memperluas tipe lampiran selain gambar untuk fitur ini.

### Kontrak API/service lintas task
Prefix `GET/POST /tickets/:id/notes`; route detail `.../:noteId`. Semua ID UUID dan semua endpoint memvalidasi ticketId-noteId match.
- Policy `assertHandler(ticketId, actorId, manager?): Promise<{ticket,user}>`; `assertMember(noteId, actorId, manager?, writable?): Promise<NoteAccess>`; nonanggota/objek hilang mengembalikan 404 identik, mutasi readonly 409.
- Query `list(ticketId,actorId)`, `detail(noteId,actorId,cursor?)`, `candidates(ticketId,actorId,search,page)`; kandidat aktif difilter helper handler, sertakan ADMIN/MANAGER bila eligible.
- CRUD create `{title?,memberIds}`, update title, soft delete; membership add/remove terpisah.
- Lease acquire/heartbeat/release `{sessionId,expectedVersion?}`; acquire response `{sessionId,leaseUntil,contentVersion,document}`; heartbeat setiap 15 detik, TTL 60 detik; autosave debounce 1 detik dan simpan sebelum release. DB time + lock ticket lalu note, compare token dan version. 409 => jangan overwrite; pertahankan draft in-memory, minta reload/takeover.
- Document save `{sessionId,expectedVersion,document}`; revisions list/detail read-only. Expired lease tidak bisa renew/save/release sesi baru. Expiry finalisasi idempotent via lazy recovery sebelum acquire/read serta cleanup periodik, tanpa revisi setiap autosave.
- Discussion post `{content,mentionedUserIds,attachmentIds,clientRequestId}`; server alokasi sequence dan validasi mention subset anggota aktif/eligible. Gunakan idempotency key untuk retry jaringan.
- Mark solution `{messageId|null}` memvalidasi pesan milik note; serialized di note row. Public share endpoint `{messageId,clientRequestId}` hanya mengirim teks melalui jalur public reply existing setelah aksi konfirmasi; jangan menyalin lampiran/URL privat.
- Mark read `{throughSequence}` maksimum sequence yang ditampilkan/dimuat, tidak memakai waktu browser. Unread hanya pesan orang lain; HIGH bila mention setelah watermark.
- Socket `ticket-note:changed` berisi invalidation minimal, tanpa judul/isi/member list; hanya `user:{id}` penerima yang sudah dicek ulang. Frontend refetch API dan purge cache saat akses dicabut. Tidak menambah private payload ke room tiket/staf/site.

## Task implementasi (berurutan, tiap task test-first)
Untuk tiap task: tulis failing test → jalankan satu file → implementasi minimal → jalankan ulang file yang sama → review diff. Jangan commit tanpa permintaan user. Paket fitur baru baru diaktifkan setelah rangkaian backend+frontend lolos verifikasi.

### Task 1 — Schema dan kebijakan akses
**Files:** buat entities/DTO dan `notes/ticket-note-access.service.ts`, `notes/ticket-note-access.service.spec.ts`; migrasi timestamp baru di `backend/src/migrations/`; ubah `ticketing.module.ts`.
**Consumes:** helper `resolveTicketViewerAccess`, User/Ticket repositories, TypeORM EntityManager.
**Produces:** model dan policy sesuai kontrak di atas; FK/index dan down migration; query scope terpusat yang juga dipakai Action Center.
- [ ] Test anggota eligible lolos; nonanggota termasuk ADMIN, USER/requester, user nonaktif, stale role/site, wrong ticketId, note deleted => tidak terlihat; eligible developer cross-site mengikuti helper tiket existing.
- [ ] Implementasi schema, unique constraints, index membership/read dan note ticket, policy fresh DB, DTO validasi/schema JSON.
- [ ] Test migrasi up/down pada DB test disposable; tidak jalankan migrasi produksi.

### Task 2 — CRUD note dan anggota
**Files:** `notes/ticket-notes.controller.ts`, `ticket-note-command.service.ts`, `ticket-note-query.service.ts`, `ticket-note-command.service.spec.ts`, `ticket-note-query.service.spec.ts`.
**Consumes:** Task 1 policy/entities. **Produces:** create/list/detail/candidates/title/delete/membership API.
- [ ] Test note pribadi, multi-note/grup, dedup anggota, creator wajib, hanya creator menghapus/mengeluarkan, anggota dapat mengundang, kandidat ineligible ditolak atomik, pagination tidak bocor total.
- [ ] Implementasi transaksi; tidak menulis `ticket_messages`, ticket.updatedAt, SLA/first-response, participant atau event chat.
- [ ] Test CLOSED/CANCELLED read-only untuk semua mutasi; detail/riwayat tetap terbaca oleh anggota eligible; reopen bisa edit.

### Task 3 — Lease, autosave dan riwayat
**Files:** `notes/ticket-note-document.service.ts`, `ticket-note-document.service.spec.ts`, `ticket-note-lease.integration.spec.ts`.
**Consumes:** Task 1 policy + Task 2 note. **Produces:** acquire/heartbeat/save/release/revisions API.
- [ ] Test acquire bersama dua koneksi hanya satu menang, dua tab user sama tetap berbeda token; stale token/version => 409; readonly/revocation dicek sebelum write.
- [ ] Implementasi short transaction pessimistic locks konsisten; schema JSON allowlist; 60s expiry menggunakan DB time; heartbeat tidak mengubah versi konten. Dokumentasikan lock order user (UUID urut, shared saat validasi), ticket (UUID urut), note, session/member; gunakan protokol yang sama saat merge/forward/close dan role/site update agar fresh read tidak kalah race dengan pencabutan akses. Jangan menahan lock sepanjang sesi 60 detik; hanya per request/transaksi. Uji deadlock/retry terbatas tanpa swallowed error.
- [ ] Test autosave crash tetap tersimpan; release/expiry/takeover membuat tepat satu revisi per changed session; sesi tanpa perubahan tidak membuat versi; rollback save tidak meninggalkan revision parsial.

### Task 4 — Lampiran privat
**Files:** `notes/ticket-note-attachment.service.ts`, controller upload/download, `ticket-note-attachment.service.spec.ts`; ubah `presentation/middleware/uploads-file.handler.ts` dan spec-nya.
**Consumes:** Task 1/2 policy, validasi magic bytes/limit existing attachment interceptor (bukan storage/fallback aksesnya). **Produces:** upload gambar => attachmentId; authorized GET/HEAD => stream privat.
- [ ] Test private dir tidak dapat diakses `/uploads/...`, filename traversal/double encoding/range/head; pemohon dan admin nonanggota ditolak meski tahu ID/path.
- [ ] Implementasi direktori `ticket-notes`, DB ownership, cleanup upload gagal, private/no-store headers; validasi konten sebenarnya, tolak SVG/script; inline document hanya referensi attachment note sendiri.
- [ ] Test HTML/JS URL/data URL/external src/foreign attachment ID ditolak; revocation memutus unduhan berikutnya; jangan persist blob privat di localStorage/service-worker cache.

### Task 5 — Diskusi, mention dan solusi
**Files:** `notes/ticket-note-discussion.service.ts`, `ticket-note-discussion.service.spec.ts`, `ticket-note-public-share.service.ts`, `ticket-note-public-share.service.spec.ts`; register endpoint controller.
**Consumes:** Tasks 1–4; public reply existing khusus publikasi sadar. **Produces:** messages pagination, read watermark, solusi, publikasi teks.
- [ ] Test mention hanya anggota eligible; author tidak mendapat unread sendiri; markRead watermark tidak menelan pesan yang datang bersamaan; HIGH tetap selama mention belum dibaca.
- [ ] Implementasi sequence atomik + idempotency; message/solution dalam note transaction.
- [ ] Test satu solusi/note, foreign message ditolak, mark/revoke catat actor/time; public share perlu hak public reply, menolak readonly, retry tidak duplikat, tidak menyalin image privat. Tidak mengubah status tiket hanya karena solusi ditandai.

### Task 6 — Merge, routing tiket dan audit privat
**Files:** ubah `services/ticket-merge.service.ts` + spec; integrasi invalidation di forward/update route tiket; `audit/audit.service.ts` + spec, enum `AuditAction`.
**Consumes:** Tasks 1–5 transaction helpers. **Produces:** note relocation atomik + metadata audit tanpa kebocoran.
- [ ] Regression test merge mempertahankan `isInternal` arsip chat; rollback merge tidak memindahkan sebagian note.
- [ ] Pindahkan note.ticketId menggunakan EntityManager transaksi merge, ID/member/revision/attachment tetap; finalisasi/revoke lease; lock tiket deterministik; re-evaluasi akses tujuan. Tidak membuat system message yang menyebut jumlah/judul note.
- [ ] Test forward/site/team change menghilangkan akses dan menutup editing; merge bersamaan save tidak menghasilkan konten tertulis ke konteks akses lama.
- [ ] Tulis audit metadata tanpa konten untuk create/delete/member/solution/public share; kecualikan entityType note dari seluruh audit list/stats/export/timeline/recent/entity dan debug log identifier privat. Test semua proyeksi global tetap tidak mengungkap note.

### Task 7 — Realtime dan delivery notifikasi
**Files:** `notes/ticket-note-events.service.ts`, `ticket-note-notification.service.ts` dan specs; gateway/notification enums/templates dan registrasi terkait.
**Consumes:** Task 5 domain event post-commit + Task 1 live policy. **Produces:** per-user invalidation dan generic invite/message/mention/solution notifications.
- [ ] Test bukan pelaku, bukan nonanggota, bukan anggota kehilangan akses; message+mention tidak menduplikasi notifikasi untuk penerima sama; autosave tidak mengirim bell/push/email.
- [ ] Tulis outbox delivery pada transaksi event; worker retry ber-dedupKey dan revalidasi akses live sebelum setiap channel. Reuse notification center send dan per-user gateway emission; override channels untuk invitation-only email serta generic push; jangan mengambil semua staf/assignee tiket sebagai penerima. Verifikasi send existing yang dispatch push sebelum resolve channels; note-specific adapter harus menghormati preferensi yang berlaku dan tidak mengirim email selain undangan.
- [ ] Gunakan NotificationType note khusus dan `referenceId=noteId` dengan deep link; jangan mengisi `ticketId` pada row notifikasi privat karena halaman tiket menjalankan `useMarkNotificationsRead({ticketId})` saat mount. Jangan mengandalkan `payload.data/priority` untuk persistence; simpan relasi notificationId–noteId–sequence eksplisit di tabel note event/notification bila perlu untuk read/visibility filter.
- [ ] Tambahkan filter otorisasi private-notification yang sama ke bell list/count/detail/read serta delivery; note row tidak boleh terungkap ketika akses dicabut walau generic. Endpoint mark-read note hanya mengakui notification sequence <= watermark yang dimuat; membuka tiket biasa tidak mengakui note. Jangan generic reference-prefix read memakan event lebih baru.
- [ ] Test perubahan anggota/akses membuang note-related persisted bell rows dan pending tasks pada read/delivery; old deep link dicek lagi. Generic push/email yang sudah terkirim tidak bisa ditarik—tidak pernah berisi judul/isi/diskusi/lampiran. Override suppression webpush khusus note: sedang melihat tiket tidak sama dengan membuka note; suppress hanya bila note yang bersangkutan aktif terbaca, bukan room tiket biasa.

### Task 8 — Action Center dan navigasi
**Files:** query helper baru note unread; ubah `notifications/notification-center.service.ts`, DTO entity/category/snooze, specs; frontend action type/filter/row/deep-link.
**Consumes:** Task 5 watermark + Task 1 access policy; Task 7 invalidation. **Produces:** item `TICKET_NOTE` per note, NORMAL/HIGH, link detail tiket+note.
- [ ] Test eligible membership AND current handler, HIGH mention, NORMAL unread, markRead hilang hanya sampai sequence; self message tidak muncul, removed member/deleted note tidak ada count/item.
- [ ] Query terindeks dan parameterized; jangan menambahkan note ke shared ticket cache. Hindari cache 30s untuk private-note items: hitung/filter segar tiap request dan komposisikan dengan cached existing items; refresh pada event/read/revocation.
- [ ] Extend frontend type mapping/category/snooze validation dan count; klik bell/Action Center membuka drawer note lewat URL query param, tanpa memasukkan isi/judul privat di URL.

### Task 9 — Frontend data dan drawer daftar/anggota
**Files:** buat `frontend/src/features/ticket-board/components/ticket-detail/notes/` (types/api/query hook/NotesDrawer/NoteList/NoteMembers); ubah `BentoTicketDetailPage.tsx` dan header existing; tests per komponen/hook.
**Consumes:** Tasks 2,7,8 API. **Produces:** tombol per-viewer count/unread dan drawer daftar/detail.
- [ ] Reuse Sheet/ConfirmationDialog/UserAvatar/query client/API auth existing; hook query key mencakup current user+ticket+note, cache dibersihkan saat logout/403/404/revocation.
- [ ] Test kandidat eligible, anggota pribadi, nonanggota tanpa badge/judul/count, link dari Action Center, mobile full-width, keyboard focus/Escape, loading/empty/error/retry; creator-only removal/delete buttons.
- [ ] Perbaiki gating arsip chat sesuai `viewerAccess === handler`; hapus toggle Internal Note manual tanpa menghapus bubble arsip dan jalur automation/backend legacy.

### Task 10 — Editor dan riwayat
**Files:** `notes/NoteDocumentEditor.tsx`, `NoteRevisionList.tsx`, `useNoteEditSession.ts` dan tests.
**Consumes:** Tasks 3/4 document/lease/attachment API. **Produces:** editable/read-only document, save-state, takeover dan revision viewer.
- [ ] Adapt TipTap khusus JSON note tanpa mengubah kontrak HTML RichTextEditor global; tambah extension yang belum tersedia setelah cek docs resmi; render gambar via authorized fetch->object URL, revoke URL saat unmount.
- [ ] Test acquire/15s heartbeat/1s debounce/flush release, expired lease/two tab/409, draft belum tersimpan tidak ditimpa refetch, close drawer memberi kesempatan save dan release; browser crash ditangani TTL. Tampilkan `Sedang diedit oleh ...`, `Tersimpan`, error dan `Ambil alih` hanya setelah expiry.
- [ ] Test rich formatting/checklist/code/paste-image, revisi read-only, CLOSED/CANCELLED readonly, akses dicabut membersihkan editor tanpa silent background save.

### Task 11 — UI diskusi dan solusi
**Files:** `notes/NoteDiscussion.tsx`, `NoteDiscussionComposer.tsx`, `NoteSolution.tsx` dan tests.
**Consumes:** Task 5 APIs dan Task 8 navigation. **Produces:** chat internal note terpisah, mention anggota, upload gambar, solusi dan konfirmasi share publik.
- [ ] Test urutan/pagination, mention picker hanya anggota eligible, optimistic retry idempotent, own message tidak unread; markRead hanya drawer aktif/visible dengan watermark terakhir yang dimuat.
- [ ] Tombol `Solusi dipakai`/cabut dan pinned solution dengan actor/waktu. Tombol `Kirim ke pemohon sebagai balasan publik` membuka preview teks + peringatan publik; publish hanya setelah konfirmasi, tanpa gambar privat; tombol tetap tunduk hak reply existing.
- [ ] Test readonly, akses hilang, selected message dari halaman sebelumnya, socket reconnect/refetch, tidak ada payload note masuk timeline chat kecuali public share yang disengaja.

### Task 12 — Integrasi, regression dan bukti verifikasi
**Files:** `backend/test/ticket-notes.e2e-spec.ts`, test UI terkait dan bukti `docs/superpowers/evidence/2026-10-30-private-ticket-notes.md` (dibuat saat execution).
**Consumes:** semua task. **Produces:** matriks akses/functional/regression yang lulus atau laporan blocker jujur.
- [ ] Test API+DB+socket dengan 4 akun: anggota A/B, handler nonanggota C, pemohon D; admin nonanggota dan anggota kehilangan akses termasuk matriks. Uji undangan->diskusi->Action Center/bell->read->solusi->public share; C/D tidak tahu note ada.
- [ ] Test tidak terekspos global search/report/export/manager/IPOP/webhook/automation/TV/audit; legacy chat note dan automation tetap bekerja.
- [ ] Concurrency Postgres sungguhan: lease dua koneksi, stale save, revoke/forward/merge/close bersamaan save. Bila TEST_DATABASE_URL tidak tersedia, tandai SKIPPED; jangan klaim concurrency terbukti dari mocks.
- [ ] Browser smoke dua sesi: keyboard/mobile/dark, drawer/editor/image, unread dan deep link, reload/reconnect, readonly, public share. Pakai skill run + browser testing pada execution; jangan menggunakan akun produksi tanpa izin.

## Perintah verifikasi
Jalankan dari direktori aplikasi yang sesuai, satu perintah selesai sebelum berikutnya. Jangan seluruh suite/direktori sekaligus. Per task pilih satu file yang ditargetkan, lalu regression file paling relevan; minta persetujuan sebelum rangkaian banyak file sesuai preferensi user.
- Backend: `npx jest src/modules/ticketing/notes/ticket-note-access.service.spec.ts --runInBand`; ganti path dengan SATU spec task. Expected PASS (atau RED sebelum implementasi).
- Concurrency: `npx jest src/modules/ticketing/notes/ticket-note-lease.integration.spec.ts --runInBand` dengan TEST_DATABASE_URL disposable yang disetujui. Gagal/skip dicatat.
- E2E: `npx jest --config ./test/jest-e2e.json --runInBand --runTestsByPath test/ticket-notes.e2e-spec.ts` setelah fixture environment siap.
- Frontend: `npx vitest run src/features/ticket-board/components/ticket-detail/notes/NotesDrawer.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism`; ganti dengan satu file target.
- Build backend `npm run build`, kemudian frontend `npm run build` (serial). Lint hanya file berubah tanpa --fix, dengan konfigurasi repo; jangan menjalankan script backend lint yang melakukan --fix ke seluruh repo.
- Migrasi up/down hanya DB disposable, plus `migration:show`; produksi bukan bagian eksekusi otomatis.
- Final review diff, type/API konsistensi, log/payload privacy, tidak ada secret. Laporkan command/hasil dan yang belum diuji; tidak commit/push/deploy otomatis.

## Batas eksekusi dan rollout
Rekomendasi implementasi native berurutan karena kontrak akses/lease/read-state saling bergantung, dengan review keamanan independen sebelum diaktifkan. Tidak ada kode produk atau migration yang diubah selama planning. Setelah rencana disetujui, salin spec/rencana ke docs repo, implementasi task pertama test-first, dan lanjut bertahap; jangan merilis backend-only UI parsial. Backup DB dan persetujuan eksplisit diperlukan sebelum migrasi lingkungan aktif. Email/push yang pernah diterima tidak bisa ditarik kembali; pembatasan akses mengatur pengiriman berikutnya dan pembacaan data server, bukan menghapus apa yang sudah pernah dilihat anggota.
