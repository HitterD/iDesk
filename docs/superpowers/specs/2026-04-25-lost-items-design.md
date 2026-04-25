# Lost Items — Full Workflow Design Spec

**Date:** 2026-04-25
**Branch:** feature/notification-command-center
**Status:** Approved

---

## Overview

Fitur Lost Items saat ini adalah mockup (data dummy, API tidak terkoneksi, tombol non-functional). Spec ini mendesain workflow end-to-end yang lengkap dengan 3 aktor, photo upload, QR code per report, manual match review oleh manager, dan notifikasi real-time.

**Scope:** Workflow C — tanpa AI matching.

---

## Keputusan Design

| Aspek | Keputusan |
|-------|-----------|
| Storage file | Disk lokal `./uploads/` via Multer diskStorage (existing infra) |
| Redis | Cache only (TTL-based), bukan file storage |
| Foto | Opsional, max 5, berlaku untuk lost report maupun found claim |
| Finder | Semua user login (semua role) bisa lapor temuan |
| QR Code | Per lost report; scan → pre-fill found form dengan reportId |
| Match | Manual oleh manager (side-by-side foto + S/N hint), bukan AI |

---

## Aktor

| Aktor | Role | Aksi |
|-------|------|------|
| **Reporter** | Employee/Client yang kehilangan barang | Submit lost report, terima QR, terima update status |
| **Finder** | Siapa saja (semua user login) yang menemukan barang | Submit found claim via QR scan atau manual |
| **Manager/Admin** | Staff IT/security | Review claims, match/reject, konfirmasi serah terima |
| **System** | Backend | Generate QR, auto-hint S/N match, cascade status, kirim notifikasi |

---

## Alur End-to-End

```
Reporter:  [1] Submit Lost Report (form + 0–5 foto)
System:    [2] Generate QR token, simpan report, emit notif ke manager
Reporter:  [2a] Terima konfirmasi + QR code di detail page / email

Finder:    [3] Scan QR atau manual browse lost reports
Finder:    [4] Submit Found Claim (form + 0–5 foto, reportId pre-filled jika via QR)
System:    [4a] Auto-hint: cek apakah serialNumber/assetTag match dengan lost report
Manager:   [M1] Terima notif found claim masuk → buka Claims Queue

Manager:   [M2] Buka Match Review Panel → side-by-side foto + data S/N
Manager:   [M3] MATCH ✓ atau REJECT ✗ (wajib tulis notes)
System:    [7a] Cascade status update → notif ke reporter + finder

Reporter:  [6] Terima notif "Ada yang menemukan barang Anda"
Finder:    [5] Terima hasil: MATCHED atau REJECTED

Finder:    [8] Serahkan barang ke manager secara fisik
Manager:   [M4] Klik "Confirm Return" → status RETURNED → report closed
Reporter:  [9] Terima notif RETURNED → ambil barang
```

---

## Status Chain

### LostItemReport
```
REPORTED → SEARCHING → CLAIMED → VERIFIED → RETURNED
     ↘         ↘          ↘         ↘
                         CLOSED_LOST (any state → manager force close)
```

| Status | Trigger |
|--------|---------|
| REPORTED | Reporter submit form |
| SEARCHING | Manager mulai investigasi (opsional, bisa skip) |
| CLAIMED | Found claim di-submit dan di-link ke report ini |
| VERIFIED | Manager konfirmasi match |
| RETURNED | Fisik sudah diserahkan ke reporter |
| CLOSED_LOST | Manager atau timeout (7 hari) force-close |

### FoundItemClaim
```
PENDING → MATCHED → RETURNED
       ↘
        REJECTED
```

---

## QR Code Flow

1. Reporter submit → backend generate `qrCodeToken` (UUID) + `qrCodeUrl` (`/found?r={token}`)
2. QR disimpan di `LostItemReport.qrCodeToken` dan `qrCodeUrl`
3. Reporter lihat QR di: detail report page + email notifikasi
4. Finder scan QR → browser buka `/found?r={token}`
5. Frontend resolve token → dapat `reportId` → pre-fill form found claim
6. Submit → `FoundItemClaim.lostItemReportId` terisi otomatis
7. Jika finder tidak punya QR, bisa manual: pilih dari dropdown active lost reports atau submit unlinked (manager nanti yang link)

---

## Data Entities

### LostItemReport (UPDATE — tambah 3 kolom)

```typescript
// Kolom BARU yang ditambahkan:
photoUrls: string[]           // JSON array, max 5, nullable
qrCodeToken: string           // UUID unique, generated saat create
qrCodeUrl: string             // Full URL /found?r={token}

// Status BARU (update enum):
// REPORTED | SEARCHING | CLAIMED | VERIFIED | RETURNED | CLOSED_LOST
// (Existing: REPORTED | SEARCHING | FOUND | CLOSED_LOST — rename FOUND → VERIFIED/RETURNED)
```

### FoundItemClaim (BARU)

```typescript
@Entity('found_item_claims')
class FoundItemClaim {
  id: string                    // UUID PK
  finderId: string              // FK → User
  finder: User

  lostItemReportId?: string     // FK → LostItemReport (nullable jika unlinked)
  lostItemReport?: LostItemReport

  locationFound: string         // text, wajib
  foundAt: Date                 // datetime, wajib
  description: string           // text, wajib
  photoUrls: string[]           // JSON array, max 5, opsional

  status: 'PENDING' | 'MATCHED' | 'RETURNED' | 'REJECTED'

  managerNotes?: string         // wajib diisi saat REJECT
  matchedById?: string          // FK → User (manager yang match)
  matchedAt?: Date

  createdAt: Date
  updatedAt: Date
}
```

### LostItemStatusLog (BARU)

```typescript
@Entity('lost_item_status_logs')
class LostItemStatusLog {
  id: string                    // UUID PK
  lostItemReportId: string      // FK → LostItemReport
  lostItemReport: LostItemReport

  fromStatus: LostItemStatus
  toStatus: LostItemStatus
  changedById: string           // FK → User (manager atau system)
  notes?: string
  timestamp: Date
}
```

---

## API Endpoints

### Lost Item Report

| Method | Path | Auth | Deskripsi |
|--------|------|------|-----------|
| `GET` | `/lost-item` | Manager/Admin | List semua (filter: status, siteId) |
| `POST` | `/lost-item` | All users | Create report + upload foto (multipart/form-data) |
| `GET` | `/lost-item/my` | All users | List laporan milik saya |
| `GET` | `/lost-item/:id` | Owner/Manager | Detail + status log timeline |
| `PATCH` | `/lost-item/:id/status` | Manager/Admin | Update status + notes |
| `GET` | `/lost-item/qr/:token` | All users | Resolve QR token → return reportId + item name |

### Found Item Claim

| Method | Path | Auth | Deskripsi |
|--------|------|------|-----------|
| `GET` | `/found-claim` | Manager/Admin | List semua claims (filter: status) |
| `POST` | `/found-claim` | All users | Submit found claim + foto (multipart/form-data) |
| `GET` | `/found-claim/my` | All users | List claim saya sendiri |
| `PATCH` | `/found-claim/:id/match` | Manager/Admin | Match claim ke lost report + notes |
| `PATCH` | `/found-claim/:id/reject` | Manager/Admin | Reject claim, wajib notes |
| `PATCH` | `/found-claim/:id/returned` | Manager/Admin | Konfirmasi serah terima fisik |

---

## Halaman Frontend

### Client / Employee

#### 1. Report Lost Item (ENHANCE — existing form)
- Tambah foto upload (drag & drop, max 5, preview thumbnail)
- Setelah submit: tampilkan QR code + link download
- Validasi S/N optional tapi disarankan

#### 2. My Lost Reports (BARU)
- List laporan reporter sendiri
- Status badge per item
- Klik → detail: timeline status log, foto, QR code
- Tombol "Cancel Report" (→ CLOSED_LOST)

#### 3. Report Found Item (BARU — semua user)
- Accessible via: menu sidebar + QR scan URL `/found?r={token}`
- Jika via QR: reportId pre-filled, tampilkan info barang yang dicari (nama, jenis, foto lost)
- Jika manual: dropdown search active lost reports (opsional, boleh unlinked)
- Fields: foto (0–5), lokasi ditemukan, waktu, deskripsi

### Manager / Admin

#### 4. Lost Items Dashboard (ENHANCE — existing)
- Ganti `DUMMY_LOST_ITEMS` → `useLostItemReports()` (hook sudah ada)
- Stats card real data
- Detail drawer: tambah timeline log, foto grid, tombol update status
- "New Report" button → buka modal create (reuse LostItemForm)

#### 5. Found Claims Queue (BARU)
- List `FoundItemClaim` dengan status PENDING di atas
- Badge kuning jika S/N/assetTag match dengan existing report
- Klik row → buka Match Review Panel

#### 6. Match Review Panel (BARU)
- Split view: kiri = Lost Report info, kanan = Found Claim info
- Foto grid side-by-side (swipeable)
- S/N / Asset Tag comparison highlight (match = hijau, mismatch = merah)
- Reporter info vs Finder info
- Tombol: **MATCH** (wajib pilih lost report jika unlinked) + **REJECT** (wajib notes)
- Text area notes wajib diisi sebelum submit

---

## Notification Triggers

| Event | Penerima | Channel |
|-------|----------|---------|
| Report created | Manager | In-app + email |
| Found claim submitted | Manager | In-app |
| S/N auto-hint match | Manager | In-app (badge) |
| Claim MATCHED | Reporter + Finder | In-app + email |
| Claim REJECTED | Finder | In-app |
| Status → RETURNED | Reporter + Finder | In-app + email |
| Report → CLOSED_LOST | Reporter | In-app |

---

## File Upload

- Storage: `./uploads/lost-items/` (disk, Multer, existing infra)
- Config: reuse `MULTER_OPTIONS.image` (5MB, jpg/png/webp/gif)
- Max 5 file per request
- Naming: `{uuid}.{ext}` via `createStorage()`
- Served as static: `/uploads/lost-items/{filename}`

---

## Migrasi Database

1. `ALTER TABLE lost_item_reports ADD COLUMN photo_urls text[]`
2. `ALTER TABLE lost_item_reports ADD COLUMN qr_code_token varchar UNIQUE`
3. `ALTER TABLE lost_item_reports ADD COLUMN qr_code_url varchar`
4. `ALTER TYPE lost_item_status ADD VALUE 'CLAIMED'`
5. `ALTER TYPE lost_item_status ADD VALUE 'VERIFIED'`
6. `ALTER TYPE lost_item_status RENAME VALUE 'FOUND' TO 'VERIFIED'` (atau buat fresh)
7. `CREATE TABLE found_item_claims (...)`
8. `CREATE TABLE lost_item_status_logs (...)`

---

## Out of Scope (Sprint Berikutnya)

- AI/visual similarity matching foto
- Barcode pada aset kantor (perlu hardware)
- Mobile native app QR scanner
- Public URL (tanpa login) untuk found claim

---

## Dependencies

- Infra upload sudah ada: `upload.config.ts`, `UploadService`, `uploads.controller.ts`
- Notifikasi sudah ada: `NotificationCenterService`
- Audit log sudah ada: `AuditService`
- `LostItemService` + `LostItemController` sudah ada, perlu di-extend
- `EventEmitter2` sudah dipakai di lost-item module
