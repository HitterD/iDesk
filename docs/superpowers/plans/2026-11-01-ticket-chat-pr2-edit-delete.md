# Chat Tiket PR 2 — Edit & Hapus Pesan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengirim bisa mengedit pesan publiknya ≤15 menit dan menghapusnya (soft delete untuk semua); admin bisa menghapus pesan orang lain; semua peserta melihat perubahan realtime.

**Architecture:** Kolom `editedAt`/`deletedAt`/`deletedById` di `ticket_messages` + tabel audit `ticket_message_edits`. Aturan izin di service baru `TicketMessageEditService`. Konten pesan terhapus dikosongkan **di server** oleh satu helper `presentMessage()` yang dipakai di semua jalur baca (REST detail, REST messages, socket, iPop). Event socket `ticket:messageUpdated` mengganti pesan di cache frontend.

**Tech Stack:** NestJS + TypeORM + Postgres + socket.io (Jest); React + TanStack Query (Vitest + Testing Library).

**Spec:** `docs/superpowers/specs/2026-10-31-ticket-chat-upgrade.md` (Q1, Q2, Q3, Q10, Q11, Q18) + keputusan Q19 (2026-11-01): **internal note arsip read-only** — edit/hapus hanya untuk pesan publik. PR #78 (`docs/superpowers/specs/2026-10-30-private-ticket-notes.md`) memindahkan internal note baru ke drawer Catatan; drawer itu di luar scope.

## Global Constraints

- Edit: hanya pengirim, `now - createdAt <= 15 menit` (`EDIT_WINDOW_MS = 15 * 60 * 1000`), konten trim 1–5000 karakter. Admin tidak boleh mengedit pesan orang lain (Q18).
- Hapus: pengirim kapan saja, atau `ADMIN` untuk pesan siapa pun (Q2, Q3).
- Keduanya ditolak bila: tiket `CLOSED`, `isSystemMessage`, `source === 'EMAIL'`, `isInternal` (Q19), pesan sudah dihapus, atau pemanggil tidak punya akses ke tiket.
- Pesan terhapus: `content = ''`, `attachments = []`, `attachmentInfo = null` di **setiap** respons/event; file tetap di storage (Q10). Data asli tetap di DB.
- Placeholder: pengirim sendiri → "Pesan ini telah dihapus"; dihapus orang lain (admin) → "Dihapus oleh admin".
- Label edit: "diedit" di samping jam.
- Edit/hapus **tidak** mengirim push, tidak memicu notifikasi mention, tidak mengubah `lastMessageAt` atau penanda baca (Q11).
- Teks UI Bahasa Indonesia. Tes serial: backend `npx jest --runInBand <file>`, frontend `npx vitest run --pool=forks <file>`, satu file per kali.
- Migrasi tidak dijalankan ke production otomatis (Coolify compose terpisah).

## Review Focus

1. Requester membuka tiket lewat REST setelah pesan dihapus: respons `GET /tickets/:id` dan `GET /tickets/:id/messages(/paginated)` tidak boleh memuat isi lama — tes di Task 2.
2. URL lampiran pesan terhapus yang masih tersimpan di browser requester: download harus ditolak untuk requester (handler tetap boleh, untuk audit) — tes di Task 2.
3. Mengedit pesan yang berupa balasan (konten diawali `↩ Nama: cuplikan`): kutipan harus tetap utuh, yang diedit hanya isi balasannya — tes di Task 5.
4. Merge tiket setelah pesan dihapus/diedit: isi lama tidak boleh "hidup kembali" di tiket tujuan — tes di Task 2.
5. Menu dibuka tepat sebelum 15 menit lalu disimpan sesudahnya: server menolak dengan pesan jelas, draft tidak hilang — tes di Task 3 (server) dan Task 5 (draft dipertahankan).

---

### Task 1: Skema — kolom edit/hapus dan tabel audit

**Files:**
- Create: `apps/backend/src/migrations/1794060000000-TicketMessageEditDelete.ts`
- Create: `apps/backend/src/migrations/1794060000000-TicketMessageEditDelete.spec.ts`
- Create: `apps/backend/src/modules/ticketing/entities/ticket-message-edit.entity.ts`
- Modify: `apps/backend/src/modules/ticketing/entities/ticket-message.entity.ts`
- Modify: `apps/backend/src/modules/ticketing/ticketing.module.ts:95` (daftarkan `TicketMessageEdit` di `forFeature`)

**Interfaces:**
- Produces: `TicketMessage.editedAt: Date | null`, `deletedAt: Date | null`, `deletedById: string | null` (kolom biasa, **bukan** `@DeleteDateColumn` — TypeORM akan menyembunyikan baris, padahal placeholder harus tetap tampil).
- Produces: entity `TicketMessageEdit` (`ticket_message_edits`): `id` uuid, `messageId` uuid FK → `ticket_messages` ON DELETE CASCADE, `previousContent` text, `editedById` uuid null FK → `users` ON DELETE SET NULL, `editedAt` timestamp default now(). Index `(messageId)`.

- [ ] **Step 1: Tes gagal** (pola `1794050000000-CreatePrivateTicketNotes.spec.ts`): `up` memuat `ADD COLUMN "editedAt" timestamp`, `ADD COLUMN "deletedAt" timestamp`, `ADD COLUMN "deletedById" uuid`, `CREATE TABLE "ticket_message_edits"`, `ON DELETE CASCADE`; `down` memuat `DROP TABLE "ticket_message_edits"` dan `DROP COLUMN "deletedById"` dan tidak memuat `DROP TABLE "ticket_messages"`.
- [ ] **Step 2: Jalankan** `cd apps/backend && npx jest --runInBand src/migrations/1794060000000-TicketMessageEditDelete.spec.ts` → FAIL (modul tidak ada).
- [ ] **Step 3: Implementasi** migrasi (`name = 'TicketMessageEditDelete1794060000000'`), entity baru, kolom entity, registrasi module.
- [ ] **Step 4: Jalankan** tes yang sama → PASS; `npx tsc --noEmit -p tsconfig.json` → bersih.
- [ ] **Step 5: Commit** `feat(chat): schema for editing and deleting ticket messages`

---

### Task 2: Satu bentuk pesan untuk semua jalur baca

**Files:**
- Create: `apps/backend/src/modules/ticketing/utils/message-presenter.util.ts`
- Create: `apps/backend/src/modules/ticketing/utils/message-presenter.util.spec.ts`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts:680+` (`findOne` → `messages.map(presentMessage)`)
- Modify: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts` (`getMessages`, `getMessagesPaginated`)
- Modify: `apps/backend/src/modules/integrations/ipop/ipop-ticket.service.ts:196` (tambah `deletedAt: IsNull()` di `where`)
- Modify: `apps/backend/src/modules/ticketing/services/ticket-attachment-access.service.ts:92,112` (select `msg.deletedAt`; requester ditolak bila `deletedAt`)
- Modify: `apps/backend/src/modules/ticketing/services/ticket-merge.service.ts:150-160` (salin `editedAt`, `deletedAt`, `deletedById`; jangan prefix `[Merged from …]` ke konten pesan terhapus)
- Test: spec masing-masing service di atas (`ticket-query.service.spec.ts`, `ticket-messaging.service.spec.ts`, `ticket-attachment-access.service.spec.ts`, `ticket-merge.service.spec.ts`)

**Interfaces:**
- Produces: `presentMessage<T extends PresentableMessage>(m: T): T & { isDeleted: boolean; deletedByAdmin: boolean }` — bila `deletedAt`: `content: ''`, `attachments: []`, `attachmentInfo: null`, `isDeleted: true`, `deletedByAdmin: !!deletedById && deletedById !== senderId`; selain itu objek baru dengan `isDeleted: false, deletedByAdmin: false`. Tidak memutasi input. `deletedById` tidak ikut keluar.

- [ ] **Step 1: Tes gagal**
  - util: `blanks content and files of a deleted message`, `marks a deletion by someone else as by admin`, `leaves a live message untouched`, `does not mutate its input`.
  - query `findOne`: tiket dengan pesan terhapus berisi `'rahasia'` → `JSON.stringify(result.messages)` tidak mengandung `'rahasia'`, pesan itu `isDeleted: true`.
  - messaging `getMessages` dan `getMessagesPaginated`: sama.
  - attachment-access: requester meminta file milik pesan terhapus → `{ ok: false, status: 403 }`; handler → `ok: true`.
  - merge: pesan sumber terhapus → salinan punya `deletedAt` sama dan konten tanpa prefix.
- [ ] **Step 2: Jalankan tiap file spec satu per satu** → FAIL sesuai tes baru.
- [ ] **Step 3: Implementasi** util + pemakaian di semua jalur di atas.
- [ ] **Step 4: Jalankan lagi tiap file satu per satu** → PASS.
- [ ] **Step 5: Commit** `feat(chat): never serve deleted message content or files`

---

### Task 3: Service, endpoint, dan event edit/hapus

**Files:**
- Create: `apps/backend/src/modules/ticketing/services/ticket-message-edit.service.ts`
- Create: `apps/backend/src/modules/ticketing/services/ticket-message-edit.service.spec.ts`
- Create: `apps/backend/src/modules/ticketing/dto/edit-message.dto.ts` (`content`: `@IsString() @IsNotEmpty() @MaxLength(5000)`)
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts` (PATCH/DELETE `:id/messages/:messageId`)
- Modify: `apps/backend/src/modules/ticketing/presentation/gateways/events.gateway.ts` (`notifyMessageUpdated`)
- Modify: `apps/backend/src/modules/ticketing/ticketing.module.ts` (provider)
- Test: `tickets.controller.spec.ts`, `events.gateway.spec.ts`

**Interfaces:**
- Produces: `TicketMessageEditService.editMessage(ticketId: string, messageId: string, viewer: { id: string; role: UserRole; siteId: string | null }, content: string): Promise<PresentedMessage>`
- Produces: `TicketMessageEditService.deleteMessage(ticketId: string, messageId: string, viewer): Promise<PresentedMessage>`
- Produces: `export const EDIT_WINDOW_MS = 15 * 60 * 1000;` di service.
- Produces: `EventsGateway.notifyMessageUpdated(ticketId: string, message: PresentedMessage)` → room seperti `notifyNewMessage` (internal → staff room), event `ticket:messageUpdated` `{ ticketId, message }`.
- Respons dan event membawa `sender: { id, fullName, role }` seperti `notifyNewMessage`.

Aturan (pesan error Indonesia, exception NestJS):
- Pesan tidak ditemukan / bukan milik tiket ini → `NotFoundException('Pesan tidak ditemukan')`.
- Tanpa akses tiket (`resolveTicketViewerAccess` null) → `ForbiddenException`.
- Edit oleh bukan pengirim, atau hapus oleh bukan pengirim & bukan ADMIN → `ForbiddenException('Anda tidak bisa mengubah pesan ini')`.
- Lewat 15 menit → `BadRequestException('Batas waktu edit 15 menit sudah lewat')`.
- CLOSED → `BadRequestException(TICKET_CLOSED_MESSAGE)`; system/EMAIL/internal → `BadRequestException('Pesan ini tidak bisa diubah')`; sudah dihapus → `BadRequestException('Pesan sudah dihapus')`.
- Edit dengan konten identik (setelah trim) → kembalikan pesan tanpa menulis apa pun.
- Edit: dalam satu transaksi simpan `TicketMessageEdit` (konten lama) lalu update `content`, `editedAt = now`. Hapus: set `deletedAt = now`, `deletedById = viewer.id`. Keduanya memanggil `notifyMessageUpdated` **setelah** commit. Tidak ada `eventEmitter.emit('ticket.replied')`.

- [ ] **Step 1: Tes gagal** (service, mock manager/repo seperti `ticket-messaging.service.spec.ts`):
  - `lets the sender edit within 15 minutes and keeps the old text for audit`
  - `refuses an edit after 15 minutes` (createdAt = now − 15 menit − 1 detik)
  - `refuses an edit by someone else, even an admin`
  - `refuses edit and delete on a closed ticket, system, email and internal messages` (tabel kasus)
  - `lets the sender delete at any time and an admin delete anyone's message`
  - `refuses a requester deleting the agent's message`
  - `broadcasts the presented message after the change and sends no reply event`
  - `an unchanged edit writes nothing`
  - controller: `PATCH passes the caller and trimmed content to the service`, `DELETE passes the caller`.
  - gateway: `sends message updates to the staff room for internal notes and the ticket room otherwise`.
- [ ] **Step 2: Jalankan** tiap spec satu per satu → FAIL.
- [ ] **Step 3: Implementasi.**
- [ ] **Step 4: Jalankan** tiap spec satu per satu → PASS; `npx tsc --noEmit -p tsconfig.json` bersih.
- [ ] **Step 5: Commit** `feat(chat): edit and delete ticket messages`

---

### Task 4: Frontend — tipe, aturan izin, cache dan socket

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/types.ts` (pesan: `editedAt?: string | null; isDeleted?: boolean; deletedByAdmin?: boolean; source?: string;`)
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/messageThread.ts` (+ test)
- Create: `apps/frontend/src/lib/ticketMessageCache.ts`
- Modify: `apps/frontend/src/hooks/useTicketSocket.ts` (+ `__tests__/useTicketSocket.test.tsx`)

**Interfaces:**
- Produces (messageThread): `export const EDIT_WINDOW_MS = 15 * 60 * 1000;`
- Produces: `canEditMessage(m: EditableMessage, viewerId: string | undefined, ticketClosed: boolean, now?: number): boolean`
- Produces: `canDeleteMessage(m: EditableMessage, viewer: { id?: string; role?: string } | null | undefined, ticketClosed: boolean): boolean`
  - `EditableMessage = { createdAt: string; isSystemMessage: boolean; isInternal?: boolean; isDeleted?: boolean; source?: string; sender?: { id?: string } | null }`
  - Aturan identik Global Constraints (edit tambahan: konten teks harus ada — dicek di UI, bukan di helper).
- Produces: `replaceMessageInCaches(queryClient: QueryClient, ticketId: string, message: { id: string }): void` — ganti pesan ber-id sama di `['ticket', ticketId].messages` dan `['ticket-messages', ticketId]` (array), immutable; abaikan bila tidak ada.
- `useTicketSocket` mendengar `ticket:messageUpdated` → `replaceMessageInCaches` (hanya bila `ticketId` cocok).

- [ ] **Step 1: Tes gagal**
  - messageThread: `edit is allowed for the sender within 15 minutes`, `edit is refused at 15 minutes and 1 second`, `edit is refused for others, system, email, internal, deleted and closed`, `delete is allowed for the sender at any time and for an admin`, `delete is refused for a requester on the agent's message and on closed tickets`.
  - socket: `replaces an updated message in both caches`, `ignores updates for another ticket`.
- [ ] **Step 2: Jalankan** `npx vitest run --pool=forks src/features/ticket-board/components/ticket-detail/messageThread.test.ts` lalu `src/hooks/__tests__/useTicketSocket.test.tsx` → FAIL.
- [ ] **Step 3: Implementasi.**
- [ ] **Step 4: Jalankan** keduanya → PASS.
- [ ] **Step 5: Commit** `feat(chat): edit/delete rules and live message updates on the client`

---

### Task 5: UI — menu, mode edit di composer, konfirmasi hapus, placeholder

**Files:**
- Create: `apps/frontend/src/features/ticket-board/components/ticket-detail/useMessageActions.ts`
- Modify: `MessageBubble.tsx`, `MessageActionMenu.tsx`, `ChatComposer.tsx`, `TicketChat.tsx` (semua di `ticket-detail/`)
- Modify: `apps/frontend/src/index.css` (`.chat-bubble.is-deleted`, `.chat-edited`)
- Test: `ticket-detail/__tests__/TicketChat.actions.test.tsx` (tambahan) dan file baru `ticket-detail/__tests__/TicketChat.edit.test.tsx`

**Interfaces:**
- Consumes: `canEditMessage`, `canDeleteMessage`, `replaceMessageInCaches` (Task 4); endpoint Task 3.
- Produces: `useMessageActions(ticketId: string): { editMessage(messageId: string, content: string): Promise<void>; deleteMessage(messageId: string): Promise<void> }` — `api.patch(`/tickets/${ticketId}/messages/${messageId}`, { content })` / `api.delete(...)`, lalu `replaceMessageInCaches` dengan respons. Error dilempar ulang (toast dari interceptor api yang sudah ada).
- `ChatComposer` props baru: `editing: { body: string } | null`, `onCancelEdit: () => void`, `onSaveEdit: (body: string) => Promise<void>`.
  - Saat `editing` ada: textarea diisi `editing.body` dan difokuskan; banner `chat-compose-ctx` dengan ikon `Pencil`, teks **"Mengedit pesan"** dan tombol batal (`aria-label="Batalkan edit"`, Esc juga membatalkan); tombol kirim ber-`aria-label="Simpan perubahan"`; tombol lampiran/sticker disembunyikan; reply dibatalkan.
  - Simpan gagal → draft tetap, mode edit tetap.
- `TicketChat`:
  - Edit: `quote = parseQuote(message.content)`; body yang diedit = `quote ? quote.body : message.content`; saat simpan, konten = `quote ? buildQuotedContent(quote.sender, quote.quote, newBody) : newBody`.
  - Hapus: `ConfirmationDialog` (`variant="destructive"`, `appearance="ticket"`), judul **"Hapus pesan?"**, deskripsi **"Pesan akan diganti dengan keterangan \"Pesan ini telah dihapus\" untuk semua peserta."**, tombol **"Hapus"** / **"Batal"**.
  - `onEdit` diteruskan ke menu hanya bila `canEditMessage(...) && Boolean(text)` dan bukan sticker; `onDelete` hanya bila `canDeleteMessage(...)`.
- `MessageBubble`: `message.isDeleted` → bubble netral `.is-deleted` berisi ikon `Ban` + teks miring ("Pesan ini telah dihapus" / "Dihapus oleh admin"), jam tetap tampil, **tanpa** centang, tool pill, reaksi, kutipan, lampiran. `message.editedAt` → `<span className="chat-edited">diedit</span>` sebelum `<time>` di `.chat-meta`.

- [ ] **Step 1: Tes gagal**
  - actions: `own recent message offers Edit and Hapus`, `an old own message offers Hapus but not Edit`, `requester sees no Hapus on the agent's message`, `admin sees Hapus on anyone's message but no Edit`.
  - edit: `editing fills the composer, shows the banner and saves the new text`, `editing a reply keeps its quote`, `Esc cancels editing and clears the composer`, `a failed save keeps the draft and the edit mode`, `deleting asks for confirmation and calls the API only after Hapus`, `a deleted message shows the placeholder without its text, tools or ticks`, `a message deleted by an admin says so`, `an edited message is labelled diedit`.
  - (`api` dimock seperti di `TicketChat.surface.test.tsx`; tambahkan `patch`/`delete`.)
- [ ] **Step 2: Jalankan** kedua file satu per satu → FAIL.
- [ ] **Step 3: Implementasi** + CSS.
- [ ] **Step 4: Jalankan** `TicketChat.actions`, `TicketChat.edit`, `TicketChat.surface`, `TicketChat.reply` satu per satu → PASS; `npx tsc -b` bersih.
- [ ] **Step 5: Commit** `feat(chat): edit in the composer, confirm deletes, deleted and edited labels`

---

### Task 6: Verifikasi menyeluruh

- [ ] **Step 1: Regresi backend (serial)** — `ticket-messaging.service.spec.ts`, `ticket-message-edit.service.spec.ts`, `ticket-query.service.spec.ts`, `ticket-attachment-access.service.spec.ts`, `ticket-merge.service.spec.ts`, `tickets.controller.spec.ts`, `events.gateway.spec.ts`, `ticket-chat-push.listener.spec.ts`, spec migrasi → semua PASS. `npx tsc --noEmit -p tsconfig.json` bersih.
- [ ] **Step 2: Regresi frontend (serial)** — `TicketChat.actions`, `TicketChat.edit`, `TicketChat.reply`, `TicketChat.surface`, `messageThread.test.ts`, `useTicketSocket.test.tsx`, `ClientTicketDetailPage.test.tsx`, `notes/NoteDiscussion.test.tsx` → PASS. `npm run build` sukses.
- [ ] **Step 3: Migrasi di DB lokal** (`idesk-postgres` docker, **hanya bila DB lokal disposable** — tanya user dulu bila ragu): jalankan migrasi up lalu down lalu up; laporkan bila dilewati.
- [ ] **Step 4: Cek visual** (preview markup asli seperti PR 1): bubble terhapus (sendiri & admin), label "diedit", banner edit di composer, dialog hapus; light + dark, 1100px + 375px.
- [ ] **Step 5: Laporkan** ke user.
