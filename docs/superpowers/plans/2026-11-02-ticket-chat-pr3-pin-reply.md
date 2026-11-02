# Chat Tiket PR 3 — Pin Pesan & Reply via FK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Peserta tiket bisa menyematkan (pin) maksimal 3 pesan yang tampil di bar atas chat, dan balasan terhubung ke pesan aslinya lewat `replyToId`, sehingga kutipan tetap akurat dan pesan asli yang dihapus tampil "Pesan telah dihapus".

**Architecture:** Kolom `pinnedAt`/`pinnedById`/`replyToId` di `ticket_messages`. Logika pin di `TicketMessagePinService` (izin + batas 3 + system message). `presentMessage` ditambah ringkasan `replyTo` (dihitung dari pesan lain di tiket yang sama, bukan join baru) dan pembersihan kutipan teks lama milik pesan terhapus. Event socket `ticket:pinsChanged`. Frontend: komponen `PinnedMessagesBar` terpisah, reply mengirim `replyToId`, quote via FK dengan fallback parser lama.

**Tech Stack:** NestJS + TypeORM + Postgres + socket.io (Jest); React + TanStack Query (Vitest).

**Spec:** `docs/superpowers/specs/2026-10-31-ticket-chat-upgrade.md` — Q4, Q9, Q10, Q16, Q19 (internal note arsip read-only), ditambah ruling PR 2 I3 (kutipan pesan terhapus di balasan lain diselesaikan di PR ini).

## Global Constraints

- Pin: semua peserta tiket (handler, atau requester/filer/participant). Maks 3 pin aktif per tiket (`MAX_PINS = 3`); pin ke-4 melepas pin **terlama** (`pinnedAt` paling awal).
- Unpin: pemasang, `ADMIN`, atau agent yang ditugaskan (`ticket.assignedToId`).
- Pin/unpin ditolak bila: tiket `CLOSED`, pesan sistem, pesan terhapus, internal note (Q19: arsip read-only), atau pemanggil tanpa akses (USER harus `isTicketRequesterSide`).
- Pin/unpin membuat system message ringkas: `"{nama} menyematkan pesan"` / `"{nama} melepas sematan pesan"` (tanpa isi pesan).
- Menghapus pesan yang di-pin melepas pin-nya otomatis (tanpa system message tambahan) dan memancarkan `ticket:pinsChanged`.
- `replyToId` wajib menunjuk pesan di tiket yang sama, bukan system message; selain itu diabaikan (balasan tetap tersimpan tanpa FK). Pesan dari pihak requester tidak boleh membalas internal note.
- Ringkasan `replyTo` yang dikirim ke klien: `{ id, senderName, snippet, isDeleted }`; `snippet` kosong bila pesan asli dihapus. Kutipan teks lama (`↩ Nama: cuplikan`) di `content` sebuah balasan diganti `↩ Nama: Pesan telah dihapus` bila `replyToId` menunjuk pesan terhapus (server-side, di presenter).
- Konten pesan tetap disimpan dengan format kutipan teks yang sama (`buildQuotedContent`) agar email, iPop, dan klien lama tetap terbaca.
- Teks UI Bahasa Indonesia. Tes serial: backend `npx jest --runInBand <file>`, frontend `npx vitest run --pool=forks <file>`, satu file per kali; loop panjang boleh satu perintah background, tanpa runner lain bersamaan.
- File < 800 baris: bar pin di komponen sendiri.

## Review Focus

1. Requester membuka tiket yang punya pin pada internal note lama: pin itu tidak boleh terlihat (bar maupun event socket) — tes Task 2/3.
2. Balasan ke pesan yang kemudian dihapus: semua jalur baca (detail, messages, socket, merge) tidak lagi memuat cuplikan lama — tes Task 2.
3. Pin ke-4: pin terlama lepas, bar menampilkan 3 terbaru, urutan stabil — tes Task 3.
4. `replyToId` dari tiket lain / pesan sistem / internal note (oleh requester): tidak tersimpan, tidak bocor — tes Task 3.
5. Klik pin yang pesannya belum termuat (paginasi): tidak error, beri tahu pengguna — tes Task 5.

---

### Task 1: Skema — pin dan replyToId

**Files:** Create `apps/backend/src/migrations/1794070000000-TicketMessagePinReply.ts` (+ `.spec.ts`); Modify `entities/ticket-message.entity.ts`.

**Interfaces — Produces:** `TicketMessage.pinnedAt: Date | null`, `pinnedById: string | null`, `replyToId: string | null` (FK ke `ticket_messages` ON DELETE SET NULL; `pinnedById` FK `users` ON DELETE SET NULL). Index parsial `IDX_ticket_messages_pinned` pada `("ticketId") WHERE "pinnedAt" IS NOT NULL`.

- [ ] Tes gagal: `up` memuat `ADD COLUMN "pinnedAt" timestamp`, `"pinnedById" uuid`, `"replyToId" uuid REFERENCES "ticket_messages"`, `WHERE "pinnedAt" IS NOT NULL`; `down` menghapus ketiganya + index, tidak `DROP TABLE`.
- [ ] Implementasi, tes lulus, `npx tsc --noEmit -p tsconfig.json` bersih. Commit `feat(chat): schema for pinned messages and reply links`.

### Task 2: Presenter — ringkasan replyTo dan kutipan pesan terhapus

**Files:** Modify `utils/message-presenter.util.ts` (+ spec); pemakai `presentMessage` (query `findOne`, messaging `getMessages`/`getMessagesPaginated`, merge, edit service, `notifyNewMessage` di reply).

**Interfaces — Produces:** `presentThread<T>(messages: T[]): Presented<T>[]` — memetakan seluruh daftar pesan satu tiket: tiap pesan lewat `presentMessage`, ditambah `replyTo` (dari pesan lain di daftar yang sama, by `replyToId`) dan `isPinned`/`pinnedAt`/`pinnedBy` (nama). Bila pesan asli terhapus: `replyTo.snippet = ''`, `replyTo.isDeleted = true`, dan kutipan teks di `content` balasan diganti `QUOTE_MARK + ' ' + nama + ': Pesan telah dihapus'`. `pinnedById` tidak keluar. Untuk satu pesan tanpa daftar (socket new message/edit) pakai `presentMessage(m, { replyTo })` dengan ringkasan yang dimuat service.

- [ ] Tes gagal (util): `links a reply to its original with sender and snippet`, `blanks the quote of a reply whose original was deleted, in content and replyTo`, `ignores a replyToId that is not in the thread`, `exposes pin state without pinnedById`.
- [ ] Tes gagal (pemakai): `findOne` — balasan ke pesan terhapus tidak memuat cuplikan lama; requester tidak melihat pin pada internal note (internal note sudah tersaring → tidak ada di daftar).
- [ ] Implementasi; jalankan spec util, query, messaging, merge, edit satu per satu → PASS. Commit `feat(chat): reply links and pin state in every message view`.

### Task 3: Pin service, endpoint, event; replyToId saat membalas

**Files:** Create `services/ticket-message-pin.service.ts` (+ spec); Modify `presentation/ticket-messages.controller.ts` (+ spec), `gateways/events.gateway.ts` (+ spec), `ticketing.module.ts`, `services/ticket-messaging.service.ts` (opsi `replyToId`), `presentation/tickets.controller.ts` (`@Body('replyToId')`), `services/ticket-message-edit.service.ts` (hapus → lepas pin + event).

**Interfaces — Produces:**
- `TicketMessagePinService.pin(ticketId, messageId, viewer): Promise<PinnedMessageSummary[]>` dan `unpin(...)`; `listPins(ticket, access)` untuk event.
- `PinnedMessageSummary = { id, senderName, snippet, pinnedAt, pinnedByName, isInternal }`.
- Endpoint `POST` / `DELETE /tickets/:id/messages/:messageId/pin` (di `TicketMessagesController`).
- `EventsGateway.notifyPinsChanged(ticketId, pins: PinnedMessageSummary[])` → ke `ticket:{id}` hanya pin non-internal; ke `ticket:{id}:staff` daftar lengkap. Event `ticket:pinsChanged` `{ ticketId, pins }`.
- `replyToTicket(..., options?: { replyToId?: string })` (parameter ke-10, setelah `authorizePrivateShare`).

Aturan: lihat Global Constraints. Pin ulang pesan yang sudah di-pin → no-op. Batas 3 di dalam transaksi (lepas terlama sebelum menyematkan). System message dibuat lewat `manager.create(TicketMessage, { isSystemMessage: true, content, senderId })` dan dikirim lewat `notifyNewMessage` setelah commit.

- [ ] Tes gagal (pin service): `any participant can pin`, `a fourth pin releases the oldest`, `pinning again is a no-op`, `refuses pin on closed, system, deleted and internal messages`, `unpin by pinner, admin or assigned agent only`, `writes a short system message without the message text`, `refuses a USER who is not on the ticket`.
- [ ] Tes gagal (gateway): `sends requesters only public pins and staff all pins`.
- [ ] Tes gagal (messaging): `stores replyToId when it points to a public message of the same ticket`, `drops a replyToId from another ticket, a system message or (for the requester side) an internal note`.
- [ ] Tes gagal (edit service): `deleting a pinned message releases the pin and announces the new pins`.
- [ ] Tes gagal (controllers): pin/unpin meneruskan caller; reply meneruskan `replyToId`.
- [ ] Implementasi; spec satu per satu PASS; tsc bersih. Commit `feat(chat): pin up to three messages and link replies to their original`.

### Task 4: Frontend — data, socket, kirim replyToId

**Files:** `ticket-detail/types.ts` (pesan: `replyToId?`, `replyTo?`, `isPinned?`, `pinnedAt?`, `pinnedByName?`; tiket: tidak berubah), `hooks/useTicketSocket.ts` (+ test), `lib/ticketMessageCache.ts` (+ test), `TicketChat.tsx` props `onSendMessage(content, files, isInternal, onProgress, replyToId?)`, kedua halaman (`BentoTicketDetailPage.tsx`, `ClientTicketDetailPage.tsx`) menambahkan `formData.append('replyToId', …)`.

**Interfaces — Produces:** `applyPinsToCaches(queryClient, ticketId, pins: PinnedMessageSummary[])` — set `isPinned/pinnedAt/pinnedByName` pada pesan yang ada di daftar pin, hapus pada yang tidak. Socket `ticket:pinsChanged` → `applyPinsToCaches`.

- [ ] Tes gagal: cache `marks exactly the listed messages as pinned`; socket `applies pin changes to the open ticket`, `ignores pins of another ticket`; halaman klien `sends replyToId with a reply` (ClientTicketDetailPage test).
- [ ] Implementasi; tes PASS; tsc bersih. Commit `feat(chat): pins and reply links on the client`.

### Task 5: UI — bar pin, menu Sematkan, quote via FK

**Files:** Create `ticket-detail/PinnedMessagesBar.tsx`, `ticket-detail/usePinActions.ts`; Modify `MessageActionMenu.tsx` (item "Sematkan"/"Lepas sematan", ikon `Pin`/`PinOff`), `MessageBubble.tsx` (props `onPin?`, `onUnpin?`, ikon pin kecil di meta bila `isPinned`; quote dari `message.replyTo` bila ada, fallback `parseQuote`), `TicketChat.tsx` (render bar di bawah bar laporan awal, `jumpToMessage(id)` bersama untuk quote & pin), `index.css`.

**Interfaces — Produces:**
- `PinnedMessagesBar({ pins, onJump(id), onUnpin?(id) })`: menampilkan pin terbaru; bila >1, klik berputar ke pin berikutnya (gaya WhatsApp) dengan indikator `n/total` (`aria-label="Pesan disematkan 1 dari 3"`); tombol lepas (`aria-label="Lepas sematan"`) hanya bila `onUnpin`. Tidak dirender bila `pins` kosong.
- `jumpToMessage(id)`: scroll + highlight; bila elemen tidak ada → `toast.info('Pesan belum dimuat, gulir ke atas untuk melihatnya')`.
- Menu: "Sematkan" untuk peserta bila pesan bisa di-pin; "Lepas sematan" bila pesan di-pin dan viewer boleh unpin (`canUnpin`: pemasang tidak diketahui klien → tampil untuk ADMIN, agent ditugaskan, atau `pinnedById === viewer` — klien menerima `pinnedById`? **Tidak**; maka server mengirim `canUnpin` per pin di `PinnedMessageSummary` dihitung untuk viewer? Event broadcast tidak per-viewer → **ruling:** tombol lepas tampil untuk semua peserta; server menolak yang tidak berhak dengan pesan jelas).
- Quote: `message.replyTo` → `QuoteSnippet` dengan `replyTo.isDeleted ? 'Pesan telah dihapus'`; klik → `jumpToMessage(replyTo.id)`.

- [ ] Tes gagal (`TicketChat.pin.test.tsx` baru): `shows the latest pin and cycles through pins with a counter`, `menu offers Sematkan and calls the API`, `Lepas sematan calls the API`, `no pin bar without pins`, `pin of an unloaded message tells the user`, `a reply quotes its original through replyTo and jumps to it`, `a reply to a deleted message says so`, `requester view does not offer Sematkan on internal or system messages`.
- [ ] Implementasi; jalankan `TicketChat.pin`, `TicketChat.edit`, `TicketChat.actions`, `TicketChat.reply`, `TicketChat.surface` satu per satu PASS; tsc + build bersih. Commit `feat(chat): pinned messages bar, pin from the menu, quotes follow reply links`.

### Task 6: Verifikasi

- [ ] Regresi backend serial (semua spec yang disentuh + yang terkait chat dari PR 1–2) dan tsc.
- [ ] Regresi frontend serial + build.
- [ ] Cek visual (markup asli): bar pin 1 dan 3 pin, ikon pin di bubble, quote "Pesan telah dihapus"; light/dark, 1100/375.
- [ ] Review menyeluruh oleh reviewer terpisah; perbaiki Critical/Important dengan TDD.
