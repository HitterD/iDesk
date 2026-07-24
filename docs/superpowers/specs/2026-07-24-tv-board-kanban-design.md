# TV Board — Kanban Tiket per Site (Design Spec)

**Tanggal:** 2026-07-24
**Status:** Approved, ready for implementation plan

## Latar Belakang

Dibutuhkan tampilan kanban tiket khusus untuk ditayangkan di TV/layar besar (50 inch ke atas) per lokasi kerja (site). Setiap site (SPJ, SMG, KRW, JTB, dst) punya layarnya sendiri yang hanya menampilkan tiket site itu. Layar bersifat display-only (tanpa interaksi user), dibuka sekali via link dan dibiarkan menyala terus.

## Non-Goals

- Bukan role user baru (`UserRole` enum tidak berubah).
- Tidak ada interaksi apapun di layar TV (tidak ada drag-drop, klik, filter manual).
- Tidak ada dukungan multi-site dalam satu layar (out of scope; bisa ditambah kelak via token khusus jika diperlukan).
- Tidak ada polling fallback — mengandalkan Socket.IO auto-reconnect.

## Arsitektur & Akses

- Fitur publik terpisah bernama **TV Board**, diakses via `https://.../tv/:token` tanpa proses login.
- Tabel `Site` (`apps/backend/src/modules/sites/entities/site.entity.ts`) mendapat kolom baru `tvToken` (string, nullable, unique).
  - Generate: isi `tvToken` dengan token random baru (meng-invalidate token lama secara otomatis karena diganti).
  - Revoke: set `tvToken` ke `null`.
- Halaman admin baru di Settings (Admin only): list semua site aktif, dengan aksi Generate / Copy Link / Revoke token per site.
- Endpoint publik `GET /tv/board/:token`:
  - Resolve token → `siteId`. Token tidak ditemukan/null → 404, frontend render halaman error ("Link tidak valid, hubungi admin").
  - Return data tiket site tersebut (lihat bagian Data & Real-time).
- Endpoint ini **tidak** melalui `JwtAuthGuard`/`PermissionGuard` biasa — validasi cukup lookup token ke kolom `Site.tvToken`.

## Data & Real-time

**Pengambilan data awal** (`GET /tv/board/:token`): ambil semua ticket dengan `siteId` cocok, status `!= CANCELLED`. Backend kelompokkan:

| Kolom UI | Status ticket | Filter tambahan |
|---|---|---|
| Open | `TODO` | — |
| In Progress | `IN_PROGRESS` | — |
| Resolved | `RESOLVED` | hanya `resolvedAt` = hari ini (server timezone) |
| (badge, bukan kolom) | `WAITING_VENDOR` | dikirim sebagai count saja |

**Real-time**: namespace Socket.IO baru `/tv-board`, terpisah dari `EventsGateway` yang dipakai user login.
- Client connect dengan `token` (bukan JWT).
- Server validasi token → resolve `siteId` → join room `tv:{siteId}`.
- `EventsGateway` existing (`apps/backend/src/modules/ticketing/presentation/gateways/events.gateway.ts`) ditambah pemanggilan: setiap `notifyStatusChange` / `notifyNewTicket` / `notifyTicketUpdate` terjadi, juga emit event yang sama ke room `tv:{siteId}` milik ticket tersebut di namespace `/tv-board`.
- Alasan namespace terpisah (bukan extend gateway existing): mengisolasi klien publik tanpa akun dari klien authenticated JWT — kalau token TV bocor, blast radius terbatas ke data read-only ticket site itu saja.

## Layout & Tampilan (TV, layar besar)

**Header bar** (fixed top):
- Kiri: nama site (besar, misal "SPJ")
- Tengah/kanan: jam digital real-time
- Kanan: badge "Waiting Vendor: N"

**3 kolom kanban**, tiap kolom header = nama status + badge count (misal "Open (5)"):
- Open & In Progress: tampilkan semua tiket aktif tanpa batas, scrollable vertikal per kolom.
- Resolved: hanya tiket resolved hari ini.

**Kartu tiket** — 3 baris ringkas, strip warna kiri menandakan priority (`LOW/MEDIUM/HIGH/CRITICAL/HARDWARE_INSTALLATION`):
```
┃ <kendala / description, 1-2 baris, truncated>
┃ <nama requester>
┃ → <assigned to>          Target: <slaTarget, format tanggal>
```
- Tidak ada nomor tiket di kartu (tidak dibutuhkan karena layar read-only).
- Tidak ada kategori tiket.
- Overdue (`isOverdue = true`): tambahan border merah tebal + ikon jam kecil, di atas warna priority biasa.
- Read-only sepenuhnya — tidak ada elemen interaktif.

Detail styling pixel-level (spacing, font size persis, dark/light theme) mengikuti pola visual existing (`BentoTicketKanban.tsx`) dan diputuskan saat implementasi, bukan bagian dari spec ini.

## Field Mapping ke Entity Existing

Semua field sudah ada di `Ticket` entity, tidak ada field baru:
- Kendala → `description`
- Requester → `user` (relasi)
- Assigned to → `assignedTo` (relasi)
- Target date → `slaTarget`
- Priority → `priority` enum
- Overdue → `isOverdue`
- Site scope → `siteId` (langsung di Ticket, sudah didukung query `siteId` di `ticket-query.service.ts`)

## Routing

- Frontend: route publik baru `/tv/:token`, di luar `ProtectedRoute` (tidak butuh auth), layout tersendiri (fullscreen, tanpa nav/sidebar aplikasi utama).
- Tidak ada perubahan pada `RoleBasedRedirect` atau `ProtectedRoute.getRoleHome()` karena ini bukan role.

## Error Handling

- Token invalid/kosong/revoked → halaman error statis, tanpa redirect ke login (karena tidak ada konsep login di alur ini).
- Socket disconnect → Socket.IO default auto-reconnect; UI boleh menampilkan indikator kecil "reconnecting" tapi tidak wajib di spec ini (detail implementasi).

## Testing

- Backend: unit test resolve token → siteId (valid, invalid, revoked/null).
- Backend: unit test grouping logic (status → kolom, resolved-hari-ini filter, waiting vendor count).
- Backend: gateway test — event ticket di site A tidak bocor ke room `tv:{siteB}`.
- Frontend: smoke test render 3 kolom + badge dari data mock; overdue card menampilkan indikator.
