# Chat Tiket PR 1 — Bubble Baru & Centang Baca Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bubble chat tiket bergaya WhatsApp (jam + centang di dalam bubble, ekor, background doodle) dengan centang baca realtime dan tombol "lompat ke bawah", tanpa migrasi skema.

**Architecture:** Centang diturunkan dari `tickets.userLastReadAt` / `agentLastReadAt` yang sudah ada. Backend memancarkan `ticket:readStateChanged` saat marker baca benar-benar bergeser; `useTicketSocket` menggabungkannya ke cache `['ticket', id]`. Perubahan UI terbatas di `MessageBubble`, `MessageActionMenu`, `TicketChat`, dan CSS `index.css`.

**Tech Stack:** NestJS + TypeORM + socket.io (backend, Jest), React + TanStack Query + Tailwind/CSS custom (frontend, Vitest + Testing Library).

**Spec:** `docs/superpowers/specs/2026-10-31-ticket-chat-upgrade.md` (Tahapan → PR 1; keputusan Q6, Q7, Q8, Q12, Q17).

## Global Constraints

- Tidak ada migrasi DB di PR ini.
- Bubble keluar tetap `--idesk-sapphire` (Q7); dark mode wajib terbaca.
- Centang hanya di bubble keluar non-internal: ✓ = "Terkirim", ✓✓ biru = "Dibaca" (`createdAt <= lastReadAt` pihak seberang). Tanpa label "Read all" (Q8).
- Pihak seberang: tampilan agent (`isAgentView`) → `userLastReadAt`; tampilan requester → `agentLastReadAt`.
- Tampilan agent: semua pesan staf di kanan; bubble rekan staf menampilkan nama pengirim (Q12).
- Background doodle = SVG custom bertema helpdesk/IT, opacity 4–6%, varian dark (Q17). Bukan aset WhatsApp.
- Menu aksi menyembunyikan aksi yang belum tersedia (Edit/Hapus), bukan toast.
- Tes dijalankan serial: backend `npx jest --runInBand <file>`, frontend `npx vitest run --pool=forks <file>`, satu file per kali (mesin user hang bila paralel).
- Teks UI Bahasa Indonesia.

## Review Focus

1. Requester membalas lalu agent membaca: bubble requester harus berubah ✓→✓✓ tanpa reload (event socket ke room `ticket:{id}`, bukan hanya site room).
2. Internal note agent tidak boleh pernah menampilkan centang (requester tidak bisa membacanya) — tes di Task 4.
3. User sedang scroll ke atas membaca riwayat lalu pesan baru masuk: jangan ditarik paksa ke bawah; tampilkan badge jumlah pesan baru. Pesan milik sendiri tetap auto-scroll — tes di Task 6.
4. `lastReadAt` null (tiket lama / belum pernah dibuka seberang): semua centang = ✓ "Terkirim", tidak crash — tes di Task 2.
5. Sticker dan bubble khusus lampiran: jam/centang tetap terlihat terbaca di atas latar netral — cek visual di Task 7.

---

### Task 1: Backend — pancarkan `ticket:readStateChanged`

**Files:**
- Modify: `apps/backend/src/modules/ticketing/presentation/gateways/events.gateway.ts` (dekat `notifyNewMessage`, ±baris 273-280)
- Modify: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts:278-329` (`markAsRead`, `markRead`, `touchReadMarker`)
- Test: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.spec.ts` (blok `describe('markAsRead')`, baris 185+)

**Interfaces:**
- Produces: `EventsGateway.notifyReadState(ticketId: string, markers: { userLastReadAt?: Date; agentLastReadAt?: Date }): void` → `server.to('ticket:{ticketId}').emit('ticket:readStateChanged', { ticketId, ...markers })`.
- Produces: `touchReadMarker(...)` sekarang mengembalikan `Promise<boolean>` (true bila `execute().affected > 0`).

- [ ] **Step 1: Tulis tes gagal** — di helper `build`, ganti `{} as never` posisi gateway (argumen ke-6) dengan `gateway = { notifyReadState: jest.fn() }`, kembalikan juga `gateway`. Tambah:

```ts
it('broadcasts the moved read marker to the ticket room', async () => {
    const { service, gateway } = build(opsTicket);
    await service.markAsRead('t-1', 'owner', UserRole.USER);
    expect(gateway.notifyReadState).toHaveBeenCalledWith('t-1', { userLastReadAt: expect.any(Date) });
});

it('stays silent when no marker moved', async () => {
    const { service, gateway, qb } = build(opsTicket);
    qb.execute.mockResolvedValue({ affected: 0 });
    await service.markAsRead('t-1', 'owner', UserRole.USER);
    expect(gateway.notifyReadState).not.toHaveBeenCalled();
});
```
(`build` juga mengembalikan `qb`.)

- [ ] **Step 2: Jalankan, pastikan gagal** — `cd apps/backend && npx jest --runInBand src/modules/ticketing/services/ticket-messaging.service.spec.ts` → FAIL (`notifyReadState` tidak dipanggil).

- [ ] **Step 3: Implementasi** — `notifyReadState` di gateway; `touchReadMarker` return `(result.affected ?? 0) > 0`; `markRead` mengumpulkan kolom yang bergeser lalu memanggil `this.eventsGateway.notifyReadState(ticketId, moved)` sekali bila `moved` tidak kosong. Event `ticket.read` tetap dipancarkan seperti sekarang.

- [ ] **Step 4: Jalankan, pastikan lulus** — perintah sama → PASS (termasuk tes markAsRead lama). Lalu `npx jest --runInBand src/modules/ticketing/presentation/gateways/events.gateway.spec.ts` → PASS.

- [ ] **Step 5: Commit** — `feat(chat): broadcast read-marker changes to the ticket room`

---

### Task 2: Frontend — helper status centang

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/types.ts` (tambah ke `TicketDetail`: `userLastReadAt?: string | null; agentLastReadAt?: string | null;`)
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/messageThread.ts`
- Test: `apps/frontend/src/features/ticket-board/components/ticket-detail/messageThread.test.ts`

**Interfaces:**
- Produces: `export type ReadTick = 'sent' | 'read';`
- Produces: `export const readTick = (createdAt: string, counterpartLastReadAt: string | null | undefined): ReadTick`

- [ ] **Step 1: Tulis tes gagal**

```ts
describe('readTick', () => {
    it('is sent while the other side has never read', () => {
        expect(readTick('2026-10-31T08:00:00Z', null)).toBe('sent');
        expect(readTick('2026-10-31T08:00:00Z', undefined)).toBe('sent');
    });
    it('is read once the other side read at or after the message', () => {
        expect(readTick('2026-10-31T08:00:00Z', '2026-10-31T08:00:00Z')).toBe('read');
        expect(readTick('2026-10-31T08:00:00Z', '2026-10-31T09:00:00Z')).toBe('read');
    });
    it('is sent when the last read predates the message', () => {
        expect(readTick('2026-10-31T08:00:00Z', '2026-10-31T07:59:59Z')).toBe('sent');
    });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `cd apps/frontend && npx vitest run --pool=forks src/features/ticket-board/components/ticket-detail/messageThread.test.ts` → FAIL (`readTick` tidak diekspor).
- [ ] **Step 3: Implementasi** `readTick` di `messageThread.ts` (bandingkan `Date.getTime()`).
- [ ] **Step 4: Jalankan, pastikan lulus** → PASS.
- [ ] **Step 5: Verifikasi backend mengirim marker** — pastikan `TicketQueryService.findOne` (`ticket-query.service.ts:680`) mengembalikan `userLastReadAt`/`agentLastReadAt` (spread `...ticket`, tanpa `select`). Bila ternyata tidak, tambahkan ke respons dan tes di `ticket-query.service.spec.ts`.
- [ ] **Step 6: Commit** — `feat(chat): derive read ticks from the ticket's read markers`

---

### Task 3: Frontend — `useTicketSocket` menerima `ticket:readStateChanged`

**Files:**
- Modify: `apps/frontend/src/hooks/useTicketSocket.ts` (listener baru di efek room yang sama dengan `handleNewMessage`, ±baris 88-131; daftarkan `socket.on`/`socket.off`)
- Test: `apps/frontend/src/hooks/__tests__/useTicketSocket.test.tsx`

**Interfaces:**
- Consumes: payload Task 1 `{ ticketId: string; userLastReadAt?: string; agentLastReadAt?: string }`.
- Produces: cache `['ticket', ticketId]` di-merge dengan marker yang ada di payload saja.

- [ ] **Step 1: Tulis tes gagal** (ikuti pola emit-socket di file tes yang ada):
  - `merges the read marker into the ticket cache`: cache awal `{ id: 't-1', userLastReadAt: null, agentLastReadAt: '2026-10-31T07:00:00Z' }`; emit `ticket:readStateChanged` `{ ticketId: 't-1', userLastReadAt: '2026-10-31T08:00:00Z' }` → cache `userLastReadAt === '2026-10-31T08:00:00Z'` dan `agentLastReadAt` tidak berubah.
  - `ignores read state for another ticket`: `ticketId: 't-2'` → cache tetap sama (referensi identik).
- [ ] **Step 2: Jalankan, pastikan gagal** — `npx vitest run --pool=forks src/hooks/__tests__/useTicketSocket.test.tsx` → FAIL.
- [ ] **Step 3: Implementasi** — `setQueryData(['ticket', ticketId], old => old ? { ...old, ...markers } : old)` di mana `markers` hanya berisi key yang ada di payload. Tanpa invalidate/refetch.
- [ ] **Step 4: Jalankan, pastikan lulus** → PASS (17 tes lama + 2 baru).
- [ ] **Step 5: Commit** — `feat(chat): apply live read-state updates to the open ticket`

---

### Task 4: `MessageBubble` — meta di dalam bubble, nama, centang; menu tanpa aksi palsu

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/MessageBubble.tsx`
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/MessageActionMenu.tsx`
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/TicketChat.tsx` (pass `tick`)
- Test: `apps/frontend/src/features/ticket-board/components/ticket-detail/__tests__/TicketChat.actions.test.tsx`, `__tests__/TicketChat.surface.test.tsx`

**Interfaces:**
- Consumes: `readTick`, `ReadTick` (Task 2); `ticket.userLastReadAt` / `agentLastReadAt`.
- Produces: prop baru `MessageBubbleProps.tick?: ReadTick` (undefined = tanpa centang). `TicketChat` mengisi `tick` hanya bila `isOutgoing(message) && !message.isInternal`, dengan `readTick(message.createdAt, isAgentView ? ticket.userLastReadAt : ticket.agentLastReadAt)`.
- Produces: `MessageActionMenu` menampilkan Edit hanya bila `onEdit` ada, Hapus hanya bila `onDelete` ada; konstanta `NOT_AVAILABLE` dan toast-nya dihapus.

Markup baru di dalam `.chat-bubble` (urutan): nama pengirim `<b className="chat-bubble-name">` (hanya bila `isGroupStart` dan bubble bukan milik sendiri — termasuk rekan staf di tampilan agent), quote, teks, lampiran, lalu `<span className="chat-meta">` berisi label Internal (bila internal), `<time>` (tetap `dateTime` + `title`), dan centang (`Check` / `CheckCheck` lucide, `role="img"`, `aria-label` "Terkirim" / "Dibaca", class `chat-tick is-read` untuk dibaca). Header `.chat-who` hanya menyisakan badge role di pesan pertama grup (tidak lagi memuat jam). Kelas `has-tail` pada bubble bila `isGroupStart`. Sticker: `.chat-meta` ditaruh di bawah sticker dalam chip kecil.

- [ ] **Step 1: Ubah/tulis tes gagal**
  - `actions.test` baris 88: ganti ekspektasi — menu pesan sendiri berisi **Salin** dan **Balas**, dan **tidak** ada `Edit`/`Hapus` (`queryByRole('menuitem', { name: /Edit|Hapus/ })` null).
  - `surface.test` baru, `shows a read double tick on outgoing messages the other side has read`: render tampilan agent dengan pesan staf `createdAt 08:00`, `ticket.userLastReadAt 09:00` → `within(row(id)).getByRole('img', { name: 'Dibaca' })`.
  - `shows a single sent tick when the requester has not read yet`: `userLastReadAt: null` → `getByRole('img', { name: 'Terkirim' })`.
  - `never ticks internal notes or incoming messages`: internal note staf + pesan requester → `queryByRole('img', { name: /Terkirim|Dibaca/ })` null di kedua row.
  - `shows the sender name inside a colleague's bubble in the agent view`: dua staf berbeda → nama rekan muncul di dalam elemen `.chat-bubble` row-nya.
  - `keeps the time inside the bubble`: `row.querySelector('.chat-bubble time')` tidak null.
- [ ] **Step 2: Jalankan, pastikan gagal** — masing-masing file: `npx vitest run --pool=forks src/features/ticket-board/components/ticket-detail/__tests__/TicketChat.actions.test.tsx` lalu `...TicketChat.surface.test.tsx` → FAIL.
- [ ] **Step 3: Implementasi** sesuai markup di atas.
- [ ] **Step 4: Jalankan ketiga file tes TicketChat (`actions`, `surface`, `reply`) satu per satu** → PASS. Tes lama yang mencari jam di `.chat-who` diperbarui ke lokasi baru bila gagal — hanya selector, bukan perilakunya.
- [ ] **Step 5: Commit** — `feat(chat): WhatsApp-style bubble meta with read ticks; hide unavailable actions`

---

### Task 5: CSS bubble + background doodle

**Files:**
- Create: `apps/frontend/src/assets/chat-doodle.svg` (tile ±240×240, stroke-only `currentColor`-free, ikon garis: laptop, tiket, headset, kabel/plug, obeng, monitor, wifi, cangkir; stroke `#000`, opacity diatur via CSS)
- Modify: `apps/frontend/src/index.css` (±806-809 dan blok `.chat-*` 1419-1460)

**Interfaces:**
- Consumes: kelas dari Task 4: `.chat-bubble-name`, `.chat-meta`, `.chat-tick`, `.chat-tick.is-read`, `.chat-bubble.has-tail`.

Aturan yang harus dihasilkan:
- `.chat-stream`: latar `--idesk-surface-raised` + `::before`/background-image tile doodle dengan opacity 0.05 (light) dan doodle terang opacity 0.06 di `.dark` (gunakan `mask-image` dengan warna `hsl(var(--idesk-text))` agar satu SVG melayani kedua tema).
- `.chat-bubble`: radius 12px; padding `6px 9px 8px 10px`; teks dan `.chat-meta` mengalir seperti WhatsApp: `.chat-meta` `float: right; margin: 6px 0 -4px 10px; font-size: 11px;` sehingga jam menempel di kanan bawah baris terakhir.
- `.has-tail`: sudut atas di sisi pengirim radius 4px plus ekor segitiga kecil (`::before`, 8px) berwarna sama dengan bubble (in/out/internal).
- `.chat-tick`: 14px; warna `currentColor` dengan opacity .7 di bubble keluar; `.is-read` → `#53bdeb` light, kontras cukup di sapphire dan dark mode (cek Task 7).
- `.chat-bubble-name`: 12.5px, semibold, warna `--idesk-sapphire` di bubble masuk; di bubble keluar warna putih/85%.
- Jarak antar bubble satu grup 2px (ubah `mt-1.5` di `MessageBubble` ke `mt-0.5`).

- [ ] **Step 1: Implementasi SVG + CSS.**
- [ ] **Step 2: Build cek** — `cd apps/frontend && npx tsc --noEmit -p tsconfig.app.json` (atau tsconfig yang dipakai proyek) → tanpa error baru; `npx vite build` → sukses.
- [ ] **Step 3: Commit** — `style(chat): bubble tails, inline meta and helpdesk doodle backdrop`

---

### Task 6: Tombol "lompat ke bawah" + badge, auto-scroll pintar

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/ticket-detail/TicketChat.tsx` (efek auto-scroll baris ±184-188; tombol di dalam wrapper `relative` di atas composer)
- Modify: `apps/frontend/src/index.css` (`.chat-jump`)
- Test: `apps/frontend/src/features/ticket-board/components/ticket-detail/__tests__/TicketChat.surface.test.tsx`

**Interfaces:**
- Produces: konstanta `NEAR_BOTTOM_PX = 120` di `TicketChat.tsx`; tombol `aria-label="Lompat ke pesan terbaru"`, badge `aria-label="{n} pesan baru"`.

Perilaku: `isNearBottom` dihitung pada event `scroll` di `streamRef` (`scrollHeight - scrollTop - clientHeight <= NEAR_BOTTOM_PX`). Pesan baru masuk: bila near-bottom atau pesan milik sendiri → scroll halus ke bawah; selain itu `unread += 1` (hanya bubble, bukan system). Tombol muncul bila tidak near-bottom; klik → scroll ke bawah dan `unread = 0`. Sampai bawah via scroll manual juga me-reset `unread`. Indikator mengetik hanya auto-scroll bila near-bottom.

- [ ] **Step 1: Tulis tes gagal** (mock `scrollHeight/scrollTop/clientHeight` via `Object.defineProperty` pada elemen `.chat-stream`, `fireEvent.scroll`, `rerender` dengan pesan tambahan; mock `Element.prototype.scrollIntoView`):
  - `shows a jump button with the count of messages that arrived while scrolled up` → setelah 2 pesan masuk dari requester saat scroll di atas: tombol "Lompat ke pesan terbaru" ada, badge "2 pesan baru".
  - `does not pull the reader down while they are scrolled up` → `scrollIntoView` tidak dipanggil untuk pesan masuk itu.
  - `own message always scrolls to the bottom` → pesan milik sendiri saat scroll di atas memanggil `scrollIntoView`.
  - `clicking jump scrolls down and clears the badge`.
- [ ] **Step 2: Jalankan, pastikan gagal** — `npx vitest run --pool=forks src/features/ticket-board/components/ticket-detail/__tests__/TicketChat.surface.test.tsx` → FAIL.
- [ ] **Step 3: Implementasi** perilaku di atas + gaya `.chat-jump` (tombol bulat 40px, shadow, badge sapphire, posisi kanan bawah di atas composer).
- [ ] **Step 4: Jalankan tes surface, actions, reply satu per satu** → PASS.
- [ ] **Step 5: Commit** — `feat(chat): jump-to-latest button with new-message badge`

---

### Task 7: Verifikasi menyeluruh

- [ ] **Step 1: Regresi frontend (serial)** — jalankan satu per satu: `TicketChat.actions`, `TicketChat.reply`, `TicketChat.surface`, `messageThread.test.ts`, `useTicketSocket.test.tsx`, `ClientTicketDetailPage.test.tsx`, `MessageAttachments.test.tsx`, `SystemMessageEvent.test.tsx` → semua PASS.
- [ ] **Step 2: Regresi backend (serial)** — `ticket-messaging.service.spec.ts`, `events.gateway.spec.ts`, `tickets.controller.spec.ts`, `ticket-chat-push.listener.spec.ts` → PASS.
- [ ] **Step 3: Type check & lint** — `npx tsc --noEmit` di backend dan frontend; `npm run lint` frontend bila tersedia → tanpa error baru.
- [ ] **Step 4: Cek visual di browser** (skill `run` / Playwright): buka satu tiket sebagai agent dan sebagai requester, light + dark, lebar 1280 dan 375. Screenshot dan periksa: jam+centang di dalam bubble, ekor, doodle samar, centang biru terbaca di sapphire, internal note tanpa centang, sticker & bubble lampiran rapi, tombol lompat muncul saat scroll ke atas. Uji realtime: kirim dari requester, buka dari agent → bubble requester menjadi ✓✓ tanpa reload.
- [ ] **Step 5: Laporkan** hasil (tes + screenshot) ke user sebelum membuat PR.
