# Lost Items — Workflow & UI/UX Redesign Spec

**Date:** 2026-05-06
**Status:** Approved
**Branch:** feature/notification-command-center

---

## Problem

Halaman Lost Items punya backend yang sudah lengkap (state machine, found claims, QR code, police report) tapi frontend punya banyak gap yang menyebabkan workflow tidak berjalan optimal:

1. **QR code** dibuat di backend tapi tidak pernah ditampilkan ke user
2. **Police report upload** ada di backend tapi tidak ada UI-nya
3. **Found claims** ada di halaman terpisah, tidak terintegrasi dengan detail item
4. **Detail drawer** terlalu sempit untuk semua informasi (info + foto + found claims + timeline)
5. **Status VERIFIED** adalah step yang tidak perlu — membuat workflow terlalu panjang
6. **Role "manager"** punya aksi khusus padahal harusnya sama dengan admin/agent

---

## Users

| Role | Kebutuhan utama |
|---|---|
| **Employee (reporter)** | Lapor kehilangan, track status, lihat QR untuk bantu pencarian |
| **ICT (admin/agent/manager)** | Manage semua laporan, match found claims, konfirmasi returned |

Kedua role sama-sama aktif. ICT role unified — tidak ada manager-only actions.

---

## Workflow Baru

```
REPORTED ──► SEARCHING ──► CLAIMED ──► RETURNED ✓
                  │
                  └──► CLOSED_LOST ✗ (kapan saja)
```

### Perubahan dari workflow lama

| Lama | Baru | Alasan |
|---|---|---|
| REPORTED → SEARCHING → CLAIMED → **VERIFIED** → RETURNED | Hapus VERIFIED | Step tidak perlu, ICT langsung bisa konfirmasi dari CLAIMED |
| Manager-only actions | ICT unified (admin/agent/manager sama) | Simplifikasi role |
| Found claim → halaman terpisah | Inline di detail item | Workflow lebih natural |
| Drawer detail | Full page | Terlalu sempit untuk semua konten |

### State Transitions

| Dari | Ke | Trigger | Actor |
|---|---|---|---|
| — | REPORTED | Create report | Employee |
| REPORTED | SEARCHING | Klik "Mulai Pencarian" | ICT |
| REPORTED/SEARCHING | CLAIMED | Found claim disubmit & linked | Employee (auto) |
| CLAIMED | RETURNED | Klik "Konfirmasi Dikembalikan" | ICT |
| Any | CLOSED_LOST | Klik "Tutup — Tidak Ditemukan" | ICT |

---

## Pages & Components

### 1. LostItemListPage (modifikasi)

**Layout:** Card grid 4 kolom  
**Stats bar:** Total | Reported | Searching | Claimed | Returned  
**Filter:** Tab pills per status  
**Search:** By nama item / nomor laporan

**Card (LostItemCard.tsx):**
- Status badge berwarna
- Nama item + type icon
- Lokasi terakhir + waktu relatif
- Thumbnail foto (jika ada)
- Indikator hijau "1 found claim" jika status CLAIMED
- Click → navigate ke `/lost-items/:id` (bukan drawer)

### 2. MyLostReportsPage (modifikasi)

Sama dengan LostItemListPage tapi hanya menampilkan item milik user sendiri. Tidak ada ICT actions.

### 3. LostItemDetailPage (BARU — ganti drawer)

**Route:** `/lost-items/:id`  
**Layout:** 2 kolom

```
┌──────────────────────────────────────────────────────────┐
│ ← Barang Hilang          Laptop Dell XPS 13  [CLAIMED]   │
│                          #LI-001 · Budi S. · 2 jam lalu  │
├─────────────────────────┬────────────────────────────────┤
│ INFO BARANG             │ TIMELINE                       │
│ Tipe / Serial / Lokasi  │ ● CLAIMED — Andi P. — 3j lalu │
│ Tanggal / Kejadian      │ ● SEARCHING — ICT — 1h lalu   │
│                         │ ● REPORTED — Budi S. — 2h lalu│
│ FOTO (grid)             ├────────────────────────────────┤
│                         │ QR CODE                        │
│ POLICE REPORT           │ [QR Image]                     │
│ [Upload / lihat file]   │ [Download] [Share link]        │
├─────────────────────────┴────────────────────────────────┤
│ FOUND CLAIMS (highlight hijau jika ada pending)          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Andi P. · Toilet Lt.2 · 3 jam lalu                  │ │
│ │ "Nemu laptop dell di depan toilet lantai 2"         │ │
│ │ [foto]              [✓ Konfirmasi]  [✗ Tolak]       │ │
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ ICT ACTIONS (hanya untuk ICT role)                       │
│ [Mulai Pencarian]  [✓ Konfirmasi Dikembalikan]           │
│ [Tutup — Tidak Ditemukan]                                │
└──────────────────────────────────────────────────────────┘
```

**ICT Actions per status:**

| Status | Actions tersedia |
|---|---|
| REPORTED | "Mulai Pencarian", "Tutup" |
| SEARCHING | "Tutup" (tunggu found claim) |
| CLAIMED | "Konfirmasi Dikembalikan", "Tutup" |
| RETURNED | — (read-only, done) |
| CLOSED_LOST | — (read-only, done) |

**Employee view:** Pesan kontekstual per status, tanpa action buttons.

### 4. QrLandingPage (BARU)

**Route:** `/found/:token` (public — tidak perlu auth untuk lihat info)  
**Use case:** User scan QR yang ditempel di barang → buka halaman ini

```
┌──────────────────────────────────┐
│      iDesk — Barang Hilang       │
│                                  │
│ 💼 Laptop Dell XPS 13           │
│ Terakhir terlihat: Ruang Server  │
│ Tanggal: 10 Mei 2026            │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ Hubungi Pemilik              │ │
│ │ Nama: Budi Santoso           │ │
│ │ 📧 budi@company.com          │ │
│ └──────────────────────────────┘ │
│                                  │
│     [Saya Menemukannya →]        │
│                                  │
└──────────────────────────────────┘
```

**Modal "Saya Menemukannya":**
- Lokasi ditemukan (text)
- Tanggal/waktu ditemukan
- Deskripsi kondisi barang
- Upload foto (opsional)
- Submit → `POST /found-claim` dengan `lostItemReportId` dari token

**Edge cases:**
- Belum login → redirect ke login, kembali ke QR page setelah login
- Status sudah RETURNED/CLOSED_LOST → "Barang ini sudah ditemukan, terima kasih!"
- Token tidak valid → error page

### 5. FoundClaimCard.tsx (komponen baru)

Dipakai di dalam `LostItemDetailPage`. Menampilkan satu found claim:
- Finder name + avatar
- Lokasi & waktu ditemukan
- Deskripsi
- Foto grid (klik untuk lightbox)
- Tombol Konfirmasi / Tolak (hanya untuk ICT)
- Status badge jika sudah RETURNED/REJECTED

### 6. LostItemCard.tsx (komponen baru)

Card untuk list page. Menggantikan tabel row di list page sebelumnya.

---

## Backend Changes

### 1. Hapus VERIFIED dari workflow

File: `found-claim.service.ts`

Method `match()` saat ini set `report.status = LostItemStatus.VERIFIED`. Ubah ke: tidak ada perubahan status di sini — status CLAIMED sudah cukup (di-set saat found claim create). Method `match()` hanya update claim status ke MATCHED.

Method `confirmReturn()` saat ini cek `claim.status !== MATCHED`. Ubah agar bisa dari PENDING juga (karena kita skip VERIFIED/MATCHED step).

### 2. QR endpoint — tambah field

File: `lost-item.service.ts`, method `findByQrToken()`

Saat ini return: `{ reportId, itemName, itemType, photoUrls }`

Tambah: `circumstances`, `lastSeenLocation`, `lastSeenDatetime`, `reporter.name`, `reporter.email`

Perlu join ke user via ticket.

### 3. QR endpoint — public access

File: `lost-item.controller.ts`, endpoint `GET /lost-item/qr/:token`

Saat ini ada `@UseGuards(JwtAuthGuard, RolesGuard)` di controller level. QR endpoint perlu bisa diakses tanpa auth. Tambah `@Public()` decorator atau pindah ke route terpisah.

### 4. Role guards — audit

Pastikan semua ICT endpoints konsisten menggunakan `@Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)` — tidak ada yang manager-only.

---

## UI Aesthetic

**Theme:** Clean Light

| Elemen | Value |
|---|---|
| Background | `#f8fafc` (slate-50) |
| Card background | `white` |
| Card border | `1px solid #e2e8f0` |
| Card shadow | `shadow-sm` |
| Typography primary | `text-slate-900` |
| Typography secondary | `text-slate-500` |

**Status badge colors:**

| Status | Background | Text |
|---|---|---|
| REPORTED | `bg-amber-100` | `text-amber-800` |
| SEARCHING | `bg-blue-100` | `text-blue-800` |
| CLAIMED | `bg-violet-100` | `text-violet-800` |
| RETURNED | `bg-green-100` | `text-green-800` |
| CLOSED_LOST | `bg-slate-100` | `text-slate-600` |

---

## Verification Checklist

1. Employee lapor kehilangan → card muncul di My Reports dengan status REPORTED
2. ICT klik "Mulai Pencarian" → status jadi SEARCHING, timeline update
3. Employee scan QR → halaman QR tampil info + kontak pemilik
4. Employee klik "Saya Menemukannya" → isi form → submit → status item jadi CLAIMED
5. ICT buka detail item CLAIMED → found claim card muncul inline
6. ICT klik "Konfirmasi Dikembalikan" → status jadi RETURNED, ticket resolved
7. ICT klik "Tutup — Tidak Ditemukan" → status jadi CLOSED_LOST, ticket cancelled
8. Upload police report di detail page → tampil nomor & link file
9. Admin/Agent/Manager semua bisa lakukan action yang sama
10. Status VERIFIED tidak muncul di UI manapun
