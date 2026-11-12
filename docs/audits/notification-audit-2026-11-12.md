# Audit notifikasi iDesk — 2026-11-12

Cakupan: semua notifikasi in-app (lonceng, toast, banner kritis, action item), Web Push, dan email di backend dan frontend.
SJA Notifier tidak diubah (keputusan sebelumnya); `apps/desktop-notifier` tidak dipakai dan dihapus di PR4.

## Prinsip yang disepakati

1. **Penerima = relasi langsung**: pemohon, assignee, approver tahap aktif, yang di-mention, participant. Role luas
   (semua agen/admin) hanya untuk item yang belum bertuan, dibatasi ke site item + user lintas site (siteId NULL).
   Item tanpa site → fail-closed (tidak disebar ke semua site).
2. **Pelaku tidak pernah dinotif atas aksinya sendiri.** Pengecualian: email konfirmasi tiket ke pemohon.
3. **Klik = tandai dibaca + buka halaman item di portal role pembaca.** Push membuka/fokus tab iDesk yang sedang dipakai.
4. **Kejadian beruntun digabung**, bukan satu notif per kejadian (chat, update status).
5. **Preferensi dan quiet hours dihormati** di semua kanal; notif kritis tetap lewat.

## Temuan dan perbaikan

| # | Temuan | Dampak | PR |
|---|---|---|---|
| 1 | Link hardware/Zoom ke pemohon (USER) menuju halaman staf → `/unauthorized` | Klik gagal | PR1 |
| 2 | VPN `link=/vpn-access`, action item `/eform/requests/:id`, `/renewals/:id`, `/zoom` — route tidak ada | Klik ke beranda | PR1 |
| 3 | `EFORM_DIRECT_TO_ICT`, `EFORM_FULFILLED`, pengingat e-form (`SYSTEM`) masuk kategori TICKET | Tab salah, klik ke daftar tiket | PR1 |
| 4 | Manager diarahkan ke daftar tiket, bukan detail | Klik tidak tepat | PR1 |
| 5 | Push tanpa `link` (e-form, cancel tiket) membuka `/`; link Zoom eksternal diabaikan SW | Klik gagal | PR1 |
| 6 | Notif Zoom disimpan langsung ke DB (tanpa socket/push) | Tidak realtime | PR1 |
| 7 | Badge tidak update untuk notif kritis; socket berhenti setelah 5 reconnect gagal | Badge basi | PR1 |
| 8 | Path suara alert kritis salah; dismiss banner & push bocor ke user berikutnya di PC yang sama | Bug, privasi | PR1 |
| 9 | Tombol email notif memakai link relatif | Tidak bisa diklik di mail client | PR1 |
| 10 | Email e-form terkirim 2× (kanal EMAIL default + `mailDispatch`) | Spam | PR2 |
| 11 | Pengingat renewal/VPN ke semua ADMIN/MANAGER/AGENT semua site (termasuk nonaktif) + modal blokir | Spam, isolasi site | PR2 |
| 12 | Pengingat kedaluwarsa e-form ke semua role ICT semua site, tiap H-7/H-3/H-0 | Spam, isolasi site | PR2 |
| 13 | Hardware ke seluruh `ICT_STAFF`; pelaku ikut dinotif | Spam | PR2 |
| 14 | Chat tiket: in-app + push + email per pesan; mention + reply ganda; participant tanpa in-app | Spam | PR2 |
| 15 | Email `ticket.updated` setiap perubahan; takeover = 2 email; auto-assign = "baru" + "ditugaskan" | Spam | PR2 |
| 16 | Email SLA ke satu alamat global (`admin@idesk.com`), judul tiket tidak di-escape, assignee tidak tahu | Bug, keamanan | PR2 |
| 17 | Email balasan ke pemohon hanya jika pengirim ber-role `AGENT`/`ADMIN` | Notif hilang | PR2 |
| 18 | Booking Zoom berulang: N email + .ics; pengingat terjadwal tidak pernah terkirim | Spam / fitur mati | PR2 |
| 19 | Tiket baru: 2 toast + suara di halaman daftar tiket | Spam | PR2 |
| 20 | Cron tanpa lock (multi replika = kirim ganda) | Spam | PR2 |
| 21 | Preferensi: push/quiet hours diabaikan; toggle per tipe saling menimpa; key `inApp` vs `in_app`; endpoint tanpa validasi DTO | Bug, keamanan | PR3 |
| 22 | SJA menerima forward dari setiap tab | Spam | PR3 |
| 23 | Tidak ada retensi; list/count memuat semua baris ke memori; cleanup push rusak | Performa | PR4 |
| 24 | Kode mati: `ticket-notification.service.ts`, `notification-routes.ts`, queue `notifications`, `apps/desktop-notifier` | Kebingungan | PR4 |

## Resolusi klik (PR1)

Satu resolver: `portalEquivalent()` di `apps/frontend/src/lib/roleHome.ts`. Link notifikasi ditulis dalam bentuk portal
staf (`/tickets/:id`, `/hardware-requests/:id`, `/eform-access/:id`, `/zoom-calendar?booking=:id`, `/renewal?tab=...`);
resolver memindahkannya ke portal pembaca (`/client`, `/manager`) dan memetakan link lama (`/vpn-access`, `/renewals/:id`,
`/eform/requests/:id`, `/zoom`). Dipakai oleh lonceng, toast, banner kritis, action item, klik push (`?nid=`),
`ProtectedRoute`, dan route catch-all — jadi link lama di email/notif yang sudah tersimpan juga ikut benar.

## Status implementasi

| PR | Branch | Isi |
|---|---|---|
| PR1 | `HitterD/notification-pr1-redirect` | Resolver klik tunggal (`portalEquivalent`), link sumber diperbaiki, Zoom lewat NotificationService, badge kritis + reconnect, suara kritis, kebocoran banner/push, email link absolut, migrasi kategori e-form |
| PR2 | `HitterD/notification-pr2-recipients` | `findStaffAtSite` (site + lintas site, fail-closed), `findUsersWithPageAccess`, email e-form tunggal, renewal/VPN/hardware/SLA per penanggung jawab, batching chat (in-app grouped, push 2 menit, email digest 15 menit/1 jam), Zoom seri 1 email + pengingat 15 menit, `runOncePerPeriod` untuk cron |
| PR3 | `HitterD/notification-pr3-preferences` | `NotificationPreferenceGate` di semua kanal, quiet hours, DTO tervalidasi, merge per tipe, push default on, SJA satu tab |
| PR4 | `HitterD/notification-pr4-retention` | Retensi malam (read 90 hari, unread 180 hari, log 30 hari, push mati 7 hari), list/count di SQL, kode mati dihapus |

PR bertumpuk (PR2 di atas PR1, dst.); merge berurutan.

### Migrasi baru (jalan otomatis di production)

- `1794300000000-NotificationEformCategoryFix` — tipe `EFORM_EXPIRY_REMINDER`, kategori Zoom/E-Form di enum, pindah baris e-form lama ke tab E-Form.
- `1794310000000-ScheduledJobRuns` — tabel klaim cron.
- `1794320000000-NotificationEmailedAt` — kolom `emailedAt` + index untuk digest email chat.
- `1794330000000-ZoomBookingConfirmationSentAt` — `confirmationSentAt`, `reminderSentAt`.
- `1794340000000-NotificationPushOnByDefault` — push default on, `inApp` → `in_app` di `typeSettings`.

### Perubahan perilaku yang perlu diketahui pengguna

- Pemohon tidak lagi menerima notif in-app "Tiket diterima"; cukup email konfirmasi.
- Agen tidak lagi menerima "Tiket baru" untuk tiket yang langsung ter-auto-assign ke orang lain.
- Chat: satu baris per tiket di lonceng; email chat hanya jika belum dibaca 15 menit.
- Email update tiket hanya saat status berubah.
- `SLA_ADMIN_EMAIL` tidak dipakai lagi (hapus dari env Coolify bila ada).

### Tidak diubah

- SJA Notifier (aplikasi C#) — hanya cara web mem-forward ke sana.
- Tipe enum yang tidak pernah dikirim (`CHAT_MESSAGE_RECEIVED`, `RENEWAL_EXPIRED`, `EFORM_MANAGER1_APPROVED`, `EFORM_ICT_CONFIRMED`) dibiarkan: sudah ada di enum DB dan di daftar preferensi; menghapusnya butuh migrasi enum tanpa manfaat bagi pengguna.
