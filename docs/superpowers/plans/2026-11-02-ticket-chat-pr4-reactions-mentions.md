# Chat Tiket PR 4 — Reaksi Tersimpan & Mention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reaksi emoji di chat tiket tersimpan dan terlihat semua peserta secara realtime (1 reaksi per orang per pesan), dan pengirim bisa menyebut orang dengan `@` (picker), tampil sebagai chip di bubble dan mengirim notifikasi hanya ke orang yang memang boleh disebut.

**Architecture:** Tabel `ticket_message_reactions` (unik `messageId,userId`). `TicketMessageReactionService` (set/clear, allowlist emoji, akses sama seperti pin). Reaksi disajikan sebagai agregat per pesan `{ emoji, count, userNames[], userIds[] }` lewat `presentThread`/`presentInThread`; klien menghitung `hasReacted` dari `userIds`. Event `ticket:reactionsChanged { ticketId, messageId, reactions }`. Mention: kolom `mentionedUserIds jsonb` di `ticket_messages`, endpoint kandidat, validasi server (kandidat yang sah saja yang disimpan + dinotifikasi), chip dirender dari `mentionedUserIds` + nama (pola `highlightMentions` di NoteDiscussion). Picker memakai ulang `MentionPicker`/`useMentionQuery` dari drawer Catatan (dipindah ke `ticket-detail/` sebagai modul bersama).

**Tech Stack:** NestJS + TypeORM + Postgres + socket.io (Jest); React + TanStack Query (Vitest).

**Spec:** `docs/superpowers/specs/2026-10-31-ticket-chat-upgrade.md` — Q5 (reaksi tersimpan + realtime; mention picker + chip + notifikasi), Q11 (edit tidak memicu mention baru), Q14 (1 reaksi per orang, ganti; set `EMOJI_REACTIONS`; tooltip nama), Q15 (siapa yang bisa disebut), Q19 (internal note arsip read-only → tidak bisa diberi reaksi).

## Global Constraints

- Emoji allowlist backend = `EMOJI_REACTIONS` frontend: `👍 ❤️ 😂 😮 😢 🎉 ✅ 👀`. Emoji lain → 400.
- Satu reaksi per orang per pesan: `PUT` mengganti; `DELETE` menghapus milik sendiri.
- Reaksi ditolak pada: pesan sistem, pesan terhapus, internal note (Q19), tiket `CLOSED`, pemanggil tanpa akses (USER wajib `isTicketRequesterSide`). Pesan dihapus → reaksinya tidak lagi disajikan (presenter mengosongkan).
- Requester tidak pernah menerima reaksi pada internal note (internal note memang tidak dikirim ke mereka).
- Kandidat mention (Q15):
  - pemanggil sisi requester → orang yang terlibat di tiket: requester (`userId`), pembuat (`createdById`), participant, agent ditugaskan (`assignedToId`).
  - pemanggil handler → yang terlibat + semua user aktif yang punya akses handler ke tiket (pola `TicketNoteQueryService.candidates`).
  - pemanggil sendiri tidak termasuk. Mention **tidak** menambah participant.
- Server menyaring `mentionedUserIds` ke kandidat sah sebelum menyimpan dan sebelum event `ticket.replied` (notifikasi). ID tak sah dibuang diam-diam (tidak error).
- Edit pesan tidak memicu notifikasi mention (Q11); `mentionedUserIds` lama dipertahankan saat edit.
- Pesan dihapus: `mentionedUserIds` dikosongkan oleh presenter.
- Format teks tetap polos `@Nama Lengkap` di `content` (email/iPop tetap terbaca); chip hanya dirender untuk nama yang ada di `mentionedUserIds` (+ nama dari daftar `mentions` yang disajikan server).
- Teks UI Bahasa Indonesia. Tes serial (jest `--runInBand`, vitest `--pool=forks`, satu file per kali; loop panjang boleh satu perintah background tanpa runner lain).

## Review Focus

1. Requester mengirim `mentionedUserIds` berisi staf acak / user site lain lewat API → tidak tersimpan, tidak ada notifikasi/email — tes Task 3.
2. Reaksi oleh dua orang + ganti reaksi: agregat benar, tidak ada baris ganda (unik index + upsert) — tes Task 2.
3. Pesan dihapus setelah diberi reaksi/mention: tidak ada nama pemberi reaksi/kandidat mention yang bocor dari pesan terhapus — tes Task 2/3.
4. Socket `ticket:reactionsChanged` untuk internal note tidak sampai ke room requester — tes Task 2.
5. Picker: ketik `@`, panah/Enter memilih, nama masuk ke teks; hapus nama dari teks → ID tidak ikut terkirim — tes Task 5.

---

### Task 1: Skema — reaksi dan mention

**Files:** Create `apps/backend/src/migrations/1794080000000-TicketMessageReactionsMentions.ts` (+ spec), `entities/ticket-message-reaction.entity.ts`; Modify `entities/ticket-message.entity.ts`, `ticketing.module.ts`.

**Produces:** `ticket_message_reactions(id uuid pk, messageId uuid FK cascade, userId uuid FK users cascade, emoji varchar(16), createdAt)`, `UNIQUE("messageId","userId")`, index `(messageId)`; `ticket_messages.mentionedUserIds jsonb NOT NULL DEFAULT '[]'`. Entity `TicketMessageReaction` dengan relasi `user`; `TicketMessage.reactions` (OneToMany) dan `mentionedUserIds: string[]`.

- [ ] Tes migrasi (up/down) gagal → implementasi → lulus; tsc bersih. Commit `feat(chat): schema for message reactions and mentions`.

### Task 2: Reaksi — service, endpoint, event, presenter

**Files:** Create `services/ticket-message-reaction.service.ts` (+ spec); Modify `utils/message-presenter.util.ts` (+ spec), `presentation/ticket-messages.controller.ts` (+ spec), `gateways/events.gateway.ts` (+ spec), `ticketing.module.ts`, jalur baca yang memuat pesan (query `findOne` relations `messages.reactions`, `messages.reactions.user`; messaging `getMessages`/paginated; edit service `present`).

**Produces:**
- `ReactionSummary = { emoji: string; count: number; userIds: string[]; userNames: string[] }`.
- `presentInThread/presentThread` menambah `reactions: ReactionSummary[]` (urut kemunculan pertama), dari `message.reactions` (relasi) bila dimuat; pesan terhapus → `[]`; field relasi mentah tidak keluar.
- `TicketMessageReactionService.react(ticketId, messageId, viewer, emoji)` / `unreact(ticketId, messageId, viewer)` → `ReactionSummary[]`; `REACTION_EMOJIS` (allowlist).
- Endpoint `PUT /tickets/:id/messages/:messageId/reaction` body `{ emoji }` (DTO `@IsIn(REACTION_EMOJIS)`), `DELETE …/reaction`.
- `EventsGateway.notifyReactionsChanged(ticketId, messageId, isInternal, reactions)` → `ticket:reactionsChanged` ke `ticket:{id}` (atau staff room bila internal).

- [ ] Tes gagal: presenter (`aggregates reactions per emoji with names and ids`, `a deleted message has no reactions`); service (`one reaction per person: a second emoji replaces the first`, `unreact removes only the caller's`, `refuses emojis outside the set`, `refuses on system, deleted, internal and closed`, `refuses a USER who is not on the ticket`, `broadcasts the new aggregate`); gateway (`reactions on an internal note go to staff only`); controller (`PUT/DELETE pass caller and emoji`); query `findOne` memuat relasi reaksi.
- [ ] Implementasi (upsert: `manager.upsert(TicketMessageReaction, …, ['messageId','userId'])` atau delete+insert dalam transaksi); semua spec terkait lulus satu per satu; tsc. Commit `feat(chat): stored reactions, one per person, live for everyone`.

### Task 3: Mention — kandidat, validasi, notifikasi

**Files:** Create `services/ticket-mention.service.ts` (+ spec); Modify `presentation/ticket-messages.controller.ts` → endpoint kandidat ada di controller pesan? **Tidak** — path `GET /tickets/:id/mention-candidates` (controller kecil baru `TicketMentionsController` atau tambahkan ke `TicketMessagesController` dengan path absolut tidak cocok; pakai controller baru `presentation/ticket-mentions.controller.ts`); `services/ticket-messaging.service.ts` (saring `mentionedUserIds`, simpan di pesan), `utils/message-presenter.util.ts` (keluarkan `mentions: {id, fullName}[]` untuk chip; kosong bila terhapus), `ticketing.module.ts`.

**Produces:**
- `TicketMentionService.candidates(ticketId, viewer, search?) → { id, fullName, avatarUrl }[]` (aturan Global Constraints).
- `TicketMentionService.filterAllowed(ticket, viewer, ids) → string[]` (dipakai di `replyToTicket`).
- Presenter: `mentions: { id; fullName }[]` dihitung dari `mentionedUserIds` + map nama (service memuat user yang disebut dalam satu query per daftar).

- [ ] Tes gagal: kandidat requester = yang terlibat saja; kandidat handler termasuk staf ber-akses handler, tanpa diri sendiri; `replyToTicket` menyimpan hanya ID sah dan event `ticket.replied` membawa ID tersaring; requester menyebut staf acak → dibuang; presenter `mentions` kosong untuk pesan terhapus.
- [ ] Implementasi; spec lulus; tsc. Commit `feat(chat): mention candidates and server-checked mentions`.

### Task 4: Frontend — data reaksi & mention, socket, kirim mention

**Files:** `ticket-detail/types.ts` (pesan: `reactions?: ReactionSummary[]`, `mentionedUserIds?`, `mentions?`), `lib/ticketMessageCache.ts` (+ test: `applyReactionsToCaches`), `hooks/useTicketSocket.ts` (+ test), `lib/ticketReplyForm.ts` (+ test: `mentionedUserIds` JSON), `TicketChat.tsx` (`onSendMessage(..., replyToId?, mentionedUserIds?)`), kedua halaman meneruskan.

- [ ] Tes gagal → implementasi → lulus. Commit `feat(chat): reactions and mentions on the client`.

### Task 5: UI — reaksi tersimpan, picker, chip

**Files:** Move `notes/MentionPicker.tsx` → `ticket-detail/MentionPicker.tsx` (re-export dari lokasi lama tidak perlu: perbarui import NoteDiscussion); Create `ticket-detail/useReactionActions.ts`, `ticket-detail/useMentionCandidates.ts`; Modify `TicketChat.tsx` (hapus state reaksi lokal; reaksi dari `message.reactions` + `user.id`), `MessageBubble.tsx` (chip mention di teks), `ChatComposer.tsx` (picker `@`, kumpulan ID terpilih, buang ID yang namanya dihapus dari teks), `index.css` (`.chat-mention`).

**Produces:** `toReactionChips(summaries, viewerId) → Reaction[]` (`hasReacted` = viewer di `userIds`, `users` = nama). Tooltip chip memakai nama (sudah didukung `ChatReactions`).

- [ ] Tes gagal (`TicketChat.reactions.test.tsx`, `TicketChat.mention.test.tsx`): reaksi dari server tampil dengan jumlah & "Anda"; klik emoji → `PUT`; klik chip sendiri → `DELETE`; ganti emoji → satu `PUT` emoji baru; ketik `@ja` → picker → Enter → teks `@Jason Kristanto ` dan kirim membawa ID; hapus nama dari teks → ID tidak terkirim; bubble merender chip untuk nama di `mentions`; requester tidak melihat staf non-terlibat di picker (kandidat dari API).
- [ ] Implementasi; jalankan semua tes TicketChat + NoteDiscussion + MentionPicker satu per satu; tsc + build. Commit `feat(chat): saved reactions, @mention picker and mention chips`.

### Task 6: Verifikasi

- [ ] Regresi backend & frontend serial; tsc; build.
- [ ] Cek visual (markup asli): chip reaksi dengan jumlah, chip mention di bubble keluar/masuk, picker terbuka di composer; light/dark, 1100/375.
- [ ] Review menyeluruh oleh reviewer terpisah; perbaiki Critical/Important dengan TDD; merge ke `main`.
