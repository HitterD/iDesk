# Chat Tiket — Upgrade (edit, hapus, pin, reaksi, mention, bubble baru)

Hasil grilling 2026-10-31, disetujui user. Berlaku untuk chat per tiket (`ticket_messages`), tampilan agent (`BentoTicketDetailPage`) dan requester (`ClientTicketDetailPage`).

Referensi gaya: screenshot bubble ala WhatsApp dari user (jam + centang di dalam bubble, chip mention, background doodle). Warna tetap brand iDesk.

## Kondisi awal (sebelum upgrade)

- Edit/Hapus: item menu ada, tapi hanya toast "belum tersedia" (`MessageActionMenu.tsx:30,51-59`). Tidak ada backend/kolom.
- Pin pesan: tidak ada (bar "Pin" di `TicketChat.tsx:255-306` = laporan awal tiket).
- Reply: konvensi teks `↩ Nama: cuplikan` (`messageThread.ts`), dicocokkan via teks.
- Reaksi: state lokal saja (`TicketChat.tsx:94,101-144`).
- Mention: backend terima `mentionedUserIds`, frontend selalu kirim `[]`.
- Centang baca: tidak ada. Tersedia `userLastReadAt` / `agentLastReadAt` di `tickets`.
- Bubble keluar: sapphire, jam di header atas bubble, background polos.

## Keputusan (ringkas)

| # | Keputusan |
|---|---|
| Q1 | Edit hanya oleh pengirim, **≤15 menit** setelah kirim. Label "diedit" di samping jam. Versi lama disimpan di DB (audit), tidak ditampilkan. |
| Q2 | Hapus = **soft delete untuk semua**, kapan saja oleh pengirim. Bubble diganti placeholder *"Pesan ini telah dihapus"*. |
| Q3 | **Admin** boleh hapus pesan orang lain → placeholder *"Dihapus oleh admin"*. |
| Q4 | Semua peserta boleh pin. **Maks 3 pin**; pin ke-4 menggantikan pin terlama. Bar di atas chat, klik → scroll + highlight. |
| Q5 | Scope tambahan: reaksi tersimpan + realtime, mention @-picker + chip + notifikasi, tombol "lompat ke bawah" + badge pesan baru, copy text. **Ditunda:** cari pesan, forward. |
| Q6 | Desktop: hover → tombol ⌄ di pojok bubble → dropdown. Mobile: long-press → menu. |
| Q7 | Bubble keluar tetap **sapphire** (token brand), tata letak ala contoh: ekor bubble, jam + centang di dalam bubble kanan bawah, chip mention, background doodle, grouping beruntun, pemisah tanggal. Dark mode wajib terbaca. |
| Q8 | Centang diturunkan dari timestamp baca per pihak: ✓ abu = terkirim, ✓✓ biru = pihak seberang sudah membaca (`createdAt <= lastReadAt` pihak seberang). Tanpa tabel read per orang, tanpa label "Read all". |
| Q9 | Reply memakai kolom FK `replyToId`. Pesan lama format `↩` tetap di-parse oleh parser lama. |
| Q10 | Tiket CLOSED: edit/hapus/pin dikunci. System message & pesan sumber EMAIL tidak bisa edit/hapus. Internal note bisa edit/hapus; pin internal note hanya terlihat staf. Lampiran pesan terhapus disembunyikan di UI, file tetap di storage. |
| Q11 | Edit tidak mengirim push dan tidak memicu notifikasi mention baru; hanya update realtime via socket. |
| Q12 | Tampilan agent: semua pesan staf tetap di kanan; bubble rekan menampilkan nama pengirim. |
| Q13 | Dikerjakan dalam **4 PR** (lihat "Tahapan"). |
| Q14 | Reaksi: **1 reaksi per orang per pesan**; klik emoji lain = ganti. Set emoji = `EMOJI_REACTIONS` di `ChatReactions.tsx`. Tooltip menampilkan nama pemberi reaksi. |
| Q15 | Mention — requester: hanya orang yang terlibat di tiket (requester, participant, agent ditugaskan). Agent: yang terlibat + staf dengan akses site tiket. Di internal note picker hanya staf. Mention **tidak** menambah participant. |
| Q16 | Unpin oleh: pemasang, admin, atau agent yang ditugaskan. Pesan yang di-pin lalu dihapus → pin otomatis lepas. Pin/unpin memunculkan system message ringkas ("Budi menyematkan pesan"). |
| Q17 | Background doodle = SVG tile custom bertema helpdesk/IT (laptop, tiket, headset, kabel), opacity ±4–6%, varian dark mode. Bukan aset WhatsApp. |
| Q18 | Admin hanya boleh **hapus** pesan orang lain, bukan edit. Batas 15 menit tetap berlaku untuk admin atas pesannya sendiri. |

## Model data

**`ticket_messages`** (ubah):
- `editedAt` timestamptz null
- `deletedAt` timestamptz null
- `deletedById` uuid null (FK users, ON DELETE SET NULL) — untuk membedakan placeholder pengirim vs admin
- `replyToId` uuid null (FK `ticket_messages`, ON DELETE SET NULL)
- `pinnedAt` timestamptz null, `pinnedById` uuid null (FK users, ON DELETE SET NULL)
- Index parsial `(ticketId) WHERE pinnedAt IS NOT NULL`.

**`ticket_message_edits`** (baru, audit): `id`, `messageId` (FK cascade), `previousContent` text, `editedById`, `editedAt`.

**`ticket_message_reactions`** (baru): `id`, `messageId` (FK cascade), `userId` (FK cascade), `emoji` varchar(16), `createdAt`. Unik `(messageId, userId)`. `emoji` divalidasi terhadap allowlist backend (sama dengan `EMOJI_REACTIONS`).

Mention tidak disimpan sebagai tabel; chip dirender dari token di konten (format token ditentukan di PR 4, mis. `@[Nama](userId)`), ID divalidasi backend terhadap aturan Q15.

## API

Semua lewat `tickets.controller.ts`, otorisasi pakai `resolveTicketViewerAccess` + aturan site yang ada.

| Method | Path | Aturan |
|---|---|---|
| PATCH | `/tickets/:id/messages/:messageId` | body `{content}`; pengirim saja, ≤15 menit, bukan system/EMAIL, tiket tidak CLOSED, belum dihapus. Simpan versi lama ke `ticket_message_edits`. |
| DELETE | `/tickets/:id/messages/:messageId` | pengirim atau ADMIN; bukan system/EMAIL; tiket tidak CLOSED. Soft delete; lepas pin bila ter-pin. |
| POST | `/tickets/:id/messages/:messageId/pin` | peserta; tiket tidak CLOSED; pesan belum dihapus; >3 pin → unpin terlama. System message pin. |
| DELETE | `/tickets/:id/messages/:messageId/pin` | pemasang, ADMIN, atau agent ditugaskan. |
| PUT | `/tickets/:id/messages/:messageId/reaction` | body `{emoji}`; upsert (ganti). |
| DELETE | `/tickets/:id/messages/:messageId/reaction` | hapus reaksi sendiri. |
| GET | `/tickets/:id/mention-candidates` | daftar sesuai Q15 (param `internal=true` → staf saja). |
| POST | `/tickets/:id/reply` (ubah) | terima `replyToId` (harus pesan di tiket yang sama). |

Respons pesan: konten pesan terhapus **dikosongkan di server** (bukan hanya disembunyikan di UI); sertakan `isDeleted`, `deletedByAdmin`, `editedAt`, `replyTo` (ringkasan: id, nama pengirim, cuplikan, isDeleted), `reactions` (agregat: emoji, count, userNames, hasReacted), `pinnedAt`, `pinnedBy`. Pin pada internal note tidak dikirim ke requester.

## Realtime

Event baru, dikirim ke room yang sama dengan `ticket:newMessage` (room tiket, atau `ticket:{id}:staff` untuk internal note):
- `ticket:messageUpdated` `{ticketId, message}` — edit, hapus, reaksi.
- `ticket:pinsChanged` `{ticketId, pins}`.
- `ticket:readStateChanged` `{ticketId, userLastReadAt, agentLastReadAt}` — dikirim dari `markAsRead` agar centang berubah realtime.

`useTicketSocket` meng-update cache `['ticket', id]` dan `['ticket-messages', id]` tanpa refetch penuh.

## UI

- **Bubble**: ekor di pesan pertama grup; jam + label "diedit" + centang (hanya bubble keluar) di kanan bawah dalam bubble; nama pengirim di dalam bubble untuk pesan masuk dan bubble rekan staf (Q12). Internal note tetap amber dengan ikon kunci.
- **Placeholder hapus**: teks miring abu + ikon, tanpa menu kecuali (nanti) info.
- **Quote reply**: blok di dalam bubble, klik → scroll + highlight; quote ke pesan terhapus tampil "Pesan telah dihapus".
- **Menu aksi** (Q6): Balas, Reaksi, Salin, Sematkan/Lepas sematan, Edit (bila boleh), Hapus (bila boleh). Item yang tidak berlaku disembunyikan, bukan toast.
- **Edit**: inline di composer (banner "Mengedit pesan", Esc batal).
- **Hapus**: dialog konfirmasi.
- **Bar pin**: di atas stream, menampilkan pin terbaru; bila >1, klik berputar antar pin (gaya WhatsApp) dengan indikator 1/3.
- **Lompat ke bawah**: tombol bulat muncul saat scroll jauh dari bawah, badge jumlah pesan baru yang masuk sejak itu.
- **Mention**: ketik `@` → popover kandidat (keyboard navigable); di bubble tampil sebagai chip.
- **Background**: SVG tile doodle (Q17) di `.chat-stream`.
- Aksesibilitas: menu bisa diakses keyboard, centang punya label "Terkirim"/"Dibaca", announcer yang ada tetap dipakai.

## Tahapan (4 PR)

1. **Bubble & centang baca** — redesign `MessageBubble` + CSS, background doodle, centang dari timestamp, event `ticket:readStateChanged`, tombol lompat ke bawah, Salin. Tidak ada migrasi skema.
2. **Edit & hapus** — migrasi kolom edit/hapus + tabel `ticket_message_edits`, endpoint PATCH/DELETE, event `ticket:messageUpdated`, UI edit inline + konfirmasi hapus + placeholder.
3. **Pin & reply FK** — kolom pin + `replyToId`, endpoint pin, bar pin, system message pin, quote via FK (fallback parser lama).
4. **Reaksi tersimpan & mention** — tabel reaksi, endpoint reaksi, endpoint kandidat mention, @-picker, chip, kirim `mentionedUserIds`.

Setiap PR: tes backend (service + controller + gateway) dan frontend (komponen + hook socket), dijalankan serial (`--runInBand`, satu file per kali).

## Di luar scope

Cari pesan, forward, "hapus untuk saya", read receipt per orang, riwayat edit yang terlihat user, mention dari pesan yang diedit memicu notifikasi.
