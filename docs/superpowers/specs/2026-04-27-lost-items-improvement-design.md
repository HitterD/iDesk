# Lost Items System — Improvement Design Spec

**Date:** 2026-04-27
**Branch:** feature/notification-command-center
**Status:** Approved

---

## Overview

Sistem Lost Items saat ini sudah memiliki backend lengkap dan halaman frontend dasar, namun terdapat banyak gap: action buttons tidak contextual, tidak ada status timeline, routing bugs, dan UX yang belum konsisten antar halaman. Spec ini mendesain perbaikan menyeluruh menggunakan pendekatan **Component-First** — 6 shared components dibangun terlebih dahulu, lalu 4 halaman di-rebuild menggunakannya.

**Pendekatan:** Component-First (Option C)
**Role naming:** Admin / Agent (bukan Manager)

---

## Gap Analysis — Masalah yang Diperbaiki

### Logic / Workflow Bugs
- `LostItemListPage`: tombol "Mark as Found" dan "Close Report" selalu tampil tanpa cek status — harus contextual
- Tidak ada tombol "Start Searching" (REPORTED → SEARCHING)
- Tidak ada tombol "Confirm Return" (VERIFIED → RETURNED)
- Tidak ada tombol "Reopen" untuk Admin/Agent jika salah tutup

### Routing / Navigation Bugs
- `MyLostReportsPage` menggunakan `window.location.href` alih-alih `navigate()`
- `LostItemsNav` tidak punya tab "Claims Queue" untuk Admin/Agent
- `handleNewReport` di `LostItemListPage` navigasi Manager ke `/manager/dashboard` (salah)
- QR token (`?r=TOKEN`) dari URL tidak di-resolve di `ReportFoundItemPage`

### UI / UX Gaps
- Tidak ada status timeline/audit log di detail drawer
- Status filter menggunakan `<select>` — harusnya pills
- Tidak ada loading skeleton (hanya spinner)
- `ReportFoundItemPage` tidak punya search bar untuk klaim manual (tanpa QR)
- `LostItemsNav` tidak role-aware (tab Claims Queue tampil ke semua user)

---

## Shared Components (dibangun dulu)

### 1. `StatusBadge`

Komponen tunggal yang menggantikan semua inline badge di 4 halaman.

```
Props: status: LostItemStatus | FoundClaimStatus
Output: pill berwarna + icon sesuai status
```

| Status | Warna | Icon |
|--------|-------|------|
| REPORTED | Amber | Clock |
| SEARCHING | Blue | Search |
| CLAIMED | Purple | UserCheck |
| VERIFIED | Emerald | CheckCircle2 |
| RETURNED | Green | PackageCheck |
| CLOSED_LOST | Slate | XCircle |

### 2. `StatusTimeline`

Menampilkan audit log vertikal dari `statusLogs` entity.

```
Props: logs: StatusLog[]
Output: vertical timeline — dot + status name + timestamp + actor
```

- Dot berwarna sesuai status
- Actor: `changedBy?.fullName` atau "System"
- Notes ditampilkan di bawah entry jika ada
- Empty state: "Belum ada riwayat status"

### 3. `ContextualActions`

Menampilkan action buttons berdasarkan `status` + `userRole`. Satu komponen untuk semua halaman.

| Status | Admin/Agent | Client (pemilik) |
|--------|-------------|-----------------|
| REPORTED | ▶ Start Searching → SEARCHING, ✕ Close → CLOSED_LOST | ✕ Tutup Laporan → CLOSED_LOST |
| SEARCHING | ✕ Close → CLOSED_LOST | — (read only) |
| CLAIMED | 🔍 Review Match → MatchReviewPanel | — (read only) |
| VERIFIED | ✓ Confirm Return → RETURNED | — (read only) |
| RETURNED | — (read only) | — (read only) |
| CLOSED_LOST | ↩ Reopen → REPORTED | — (read only) |

```
Props: 
  reportId: string
  status: LostItemStatus
  userRole: UserRole
  onStatusChange: (newStatus, notes?) => void
  onReviewMatch: (reportId) => void
```

### 4. `PhotoGrid`

Grid foto dengan lightbox.

```
Props:
  urls: string[]
  maxDisplay?: number (default 5)
  editable?: boolean (untuk form upload)
  onUpload?: (files: File[]) => void
  onRemove?: (index: number) => void
```

- Mode view: thumbnail grid, klik untuk lightbox fullscreen
- Mode edit: thumbnail + slot "+" untuk tambah foto, max 5
- Empty state: placeholder abu dengan icon

### 5. `ItemDetailDrawer` — Split Panel Layout

Slide-out panel dengan layout **Split Panel** (C):
- **Kiri:** header (nama, status badge, ID) + info fields + foto + ContextualActions
- **Kanan:** StatusTimeline (selalu terlihat, independent scroll)
- Footer: tidak ada (actions sudah di kiri)

```
Props:
  item: LostItemReport | null
  userRole: UserRole
  onClose: () => void
  onStatusChange: (id, status, notes?) => void
```

Animasi: slide dari kanan (spring, damping 25, stiffness 200) — sama dengan existing.

### 6. `LostItemsNav` (update existing)

Tab navigation role-aware:

**Client/User biasa:** 3 tab
- Semua Laporan → `{base}/lost-items`
- Laporan Saya → `{base}/lost-items/my`
- Saya Temukan → `{base}/found`

**Admin/Agent:** 4 tab (+ Claims Queue)
- Semua Laporan → `{base}/lost-items`
- Laporan Saya → `{base}/lost-items/my`
- Saya Temukan → `{base}/found`
- Claims Queue → `{base}/lost-items/claims` (+ dot merah jika ada klaim PENDING)

Role detection: baca dari auth context/JWT. Badge klaim: `useFoundClaims({ status: 'PENDING' }).data?.length`.

---

## Pages

### 1. `LostItemListPage` (update)

**Perubahan:**
- Ganti status filter `<select>` → pills horizontal (ALL / REPORTED / SEARCHING / CLAIMED / VERIFIED / RETURNED / CLOSED_LOST)
- Ganti inline detail drawer → `<ItemDetailDrawer>` component
- Perbaiki `handleNewReport`: client → `/client/create?type=lost-item`, agent/admin → `/tickets/create?type=lost-item`, tidak pernah ke dashboard
- Tambah loading skeleton (3 row skeleton) menggantikan spinner

### 2. `MyLostReportsPage` (update)

**Perubahan:**
- Ganti `window.location.href` → `useNavigate()` + `navigate()`
- Tambah click handler pada setiap card → buka `<ItemDetailDrawer>`
- Tambah loading skeleton

### 3. `ReportFoundItemPage` (update)

**Dua state berdasarkan URL:**

**State A — via QR (`?r=TOKEN`):**
1. Baca `token` dari `useSearchParams()`
2. Call `useQrTokenReport(token)` → resolve ke `{ reportId, itemName, itemType, photoUrls }`
3. Pre-fill field laporan, lock input (disabled)
4. Tampilkan banner hijau "Barang teridentifikasi dari QR"
5. Form fields aktif: deskripsi temuan, lokasi temukan, foto (max 5)

**State B — manual (tanpa QR):**
1. Tampilkan search bar dengan debounce 300ms
2. Query `useLostItemReports({ status: 'SEARCHING' })` + filter client-side
3. Setelah user pilih laporan → pre-fill `reportId`, aktifkan form
4. Form fields: deskripsi temuan, lokasi temukan, foto (max 5)

**Submit:** `useCreateFoundClaim()` dengan `FormData` (multipart).

### 4. `FoundClaimsQueuePage` (update)

**Perubahan:**
- Tambah filter pills: ALL / PENDING / MATCHED / REJECTED
- Setiap row klaim → buka `<MatchReviewPanel>` sebagai **modal overlay fullscreen** (bukan drawer)
- Tampilkan badge count PENDING di tab nav

### 5. `MatchReviewPanel` (update)

**Layout side-by-side:**
- **Kiri (HILANG):** nama barang, foto, serial number, lokasi hilang, reporter
- **VS divider** vertikal
- **Kanan (TEMUAN):** deskripsi finder, foto, serial number (highlight kuning jika match dengan kiri), lokasi temukan, finder

**Auto-hint:** Jika `serialNumber` atau `assetTag` dari found claim cocok dengan lost report → highlight kuning + label "✓ MATCH".

**Actions:**
- Textarea notes (required jika reject, optional jika match)
- Tombol "✓ MATCH — Konfirmasi Cocok" → `PATCH /found-claim/:id/match`
- Tombol "✕ Reject" → `PATCH /found-claim/:id/reject` (notes wajib)
- Setelah match: status lost report berubah ke CLAIMED (cascade dari backend)

---

## File Structure

### New Files
```
apps/frontend/src/features/request-center/components/StatusBadge.tsx
apps/frontend/src/features/request-center/components/StatusTimeline.tsx
apps/frontend/src/features/request-center/components/ContextualActions.tsx
apps/frontend/src/features/request-center/components/PhotoGrid.tsx
apps/frontend/src/features/request-center/components/ItemDetailDrawer.tsx
```

### Modified Files
```
apps/frontend/src/features/request-center/components/LostItemsNav.tsx
apps/frontend/src/features/request-center/pages/LostItemListPage.tsx
apps/frontend/src/features/request-center/pages/MyLostReportsPage.tsx
apps/frontend/src/features/request-center/pages/ReportFoundItemPage.tsx
apps/frontend/src/features/request-center/pages/FoundClaimsQueuePage.tsx
apps/frontend/src/features/request-center/components/MatchReviewPanel.tsx
```

---

## Bug Fix Checklist

- [ ] `window.location.href` → `navigate()` di `MyLostReportsPage`
- [ ] `handleNewReport` navigasi per layout di `LostItemListPage`
- [ ] QR token `?r=TOKEN` di-resolve di `ReportFoundItemPage`
- [ ] Claims Queue tab hanya render untuk role ADMIN/AGENT
- [ ] Action buttons hanya tampil sesuai status + role
- [ ] `SEARCHING` status: tidak ada action untuk client
- [ ] `VERIFIED` status: tombol "Confirm Return" tersedia untuk Admin/Agent

---

## Animation & Polish

- Skeleton loading: 3 row animated pulse di list page
- Status pills filter: smooth color transition 150ms
- ItemDetailDrawer: spring slide-in dari kanan (existing pattern, dipertahankan)
- MatchReviewPanel: fade-in as modal overlay
- StatusTimeline: stagger animate-in per entry (delay 50ms per item)
- PhotoGrid lightbox: scale + fade transition

---

## Out of Scope

- AI-based matching
- Email notifikasi (sudah ada di backend, tidak diubah)
- Pagination (list cukup dengan filter untuk sekarang)
- Export / print laporan
- Real-time WebSocket updates (polling via refetch sudah cukup)
