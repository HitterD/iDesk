# Implementation Plan: Lost Items Workflow & UI/UX Redesign

**Date:** 2026-05-06
**Spec:** `docs/superpowers/specs/2026-05-06-lost-items-workflow-redesign.md`
**Branch:** `feature/notification-command-center`
**Estimated tasks:** 8 steps

---

## Task 1 — Backend: Hapus VERIFIED, fix found claim flow

**Files:**
- `apps/backend/src/modules/lost-item/entities/lost-item-report.entity.ts`
- `apps/backend/src/modules/lost-item/found-claim.service.ts`
- `apps/backend/src/modules/lost-item/lost-item.service.ts`

**Steps:**

1.1. Di `lost-item-report.entity.ts` — biarkan `VERIFIED` di enum (data lama), tapi hapus dari semua logic baru. Tambah komentar `// legacy — do not use in new code`.

1.2. Di `found-claim.service.ts`, method `match()`:
- Hapus `report.status = LostItemStatus.VERIFIED`
- Hapus `logReportStatus(...VERIFIED...)`
- Method ini sekarang hanya update claim ke `MATCHED`, tidak ubah report status

1.3. Di `found-claim.service.ts`, method `confirmReturn()`:
- Ubah guard dari `claim.status !== FoundClaimStatus.MATCHED` → terima juga `PENDING`
- Artinya ICT bisa langsung konfirmasi return dari CLAIMED (skip MATCHED step)

1.4. Di `lost-item.service.ts`, method `updateStatus()`:
- Hapus blok `if (dto.status === LostItemStatus.VERIFIED || dto.status === LostItemStatus.FOUND)` — logic foundAt/foundLocation sekarang di-set saat RETURNED saja
- Update blok `if (dto.status === LostItemStatus.RETURNED)` — tambah `foundAt`, `foundLocation`, `foundBy` dari dto

**Verifikasi:** Update status CLAIMED → RETURNED langsung via PATCH `/lost-item/:id/status` berhasil tanpa error.

---

## Task 2 — Backend: QR endpoint — tambah fields + public access

**Files:**
- `apps/backend/src/modules/lost-item/lost-item.service.ts`
- `apps/backend/src/modules/lost-item/lost-item.controller.ts`

**Steps:**

2.1. Di `lost-item.service.ts`, method `findByQrToken()`:

```typescript
async findByQrToken(token: string): Promise<{
    reportId: string;
    itemName: string;
    itemType: string;
    circumstances: string;
    lastSeenLocation: string;
    lastSeenDatetime: Date;
    photoUrls: string[];
    status: LostItemStatus;
    reporter: { name: string; email: string } | null;
}> {
    const report = await this.lostItemRepo.findOne({
        where: { qrCodeToken: token },
        relations: ['ticket', 'ticket.user'],
    });
    if (!report) throw new NotFoundException('QR code not found or expired');

    const user = report.ticket?.user;
    return {
        reportId: report.id,
        itemName: report.itemName,
        itemType: report.itemType,
        circumstances: report.circumstances,
        lastSeenLocation: report.lastSeenLocation,
        lastSeenDatetime: report.lastSeenDatetime,
        photoUrls: report.photoUrls,
        status: report.status,
        reporter: user ? { name: user.fullName ?? user.username, email: user.email } : null,
    };
}
```

2.2. Di `lost-item.controller.ts` — pindahkan `GET /lost-item/qr/:token` keluar dari `@UseGuards(JwtAuthGuard, RolesGuard)` controller-level guard.

Cara: Extract route ke method dengan `@UseGuards()` override, atau gunakan `@Public()` decorator jika sudah ada di codebase. Cek apakah `@Public()` decorator exist dulu via Grep.

**Verifikasi:** `GET /lost-item/qr/:token` bisa diakses tanpa Authorization header dan return semua fields baru.

---

## Task 3 — Frontend: Komponen LostItemCard.tsx

**File baru:** `apps/frontend/src/features/request-center/components/LostItemCard.tsx`

```typescript
// Props
interface LostItemCardProps {
    item: LostItemReport;
    onClick: () => void;
}
```

**Konten card:**
- Status badge (gunakan StatusBadge.tsx yang sudah ada)
- Item type icon (mapping: Laptop→💻, HP→📱, ID Card→🪪, Kunci→🔑, Tas→🎒, default→📦)
- `item.itemName` (bold)
- `item.lastSeenLocation` (secondary text)
- Waktu relatif dari `item.createdAt` (gunakan `formatDistanceToNow` dari date-fns)
- Thumbnail foto: `item.photoUrls[0]` jika ada, else placeholder gray
- Found claim indicator: jika `item.status === 'CLAIMED'` → green dot + teks "Ada laporan penemu"
- Seluruh card clickable → `onClick()`

**Styling:** Tailwind, clean light aesthetic — `bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer`

---

## Task 4 — Frontend: Redesign LostItemListPage & MyLostReportsPage

**Files:**
- `apps/frontend/src/features/request-center/pages/LostItemListPage.tsx`
- `apps/frontend/src/features/request-center/pages/MyLostReportsPage.tsx`

**LostItemListPage changes:**

4.1. Hapus table layout, ganti dengan card grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`

4.2. Stats bar di atas grid:
```tsx
<div className="grid grid-cols-5 gap-3 mb-6">
  <StatCard label="Total" count={items.length} color="slate" />
  <StatCard label="Reported" count={byStatus.REPORTED} color="amber" />
  <StatCard label="Searching" count={byStatus.SEARCHING} color="blue" />
  <StatCard label="Claimed" count={byStatus.CLAIMED} color="violet" />
  <StatCard label="Returned" count={byStatus.RETURNED} color="green" />
</div>
```

4.3. Filter tabs: pill buttons per status (Semua | Reported | Searching | Claimed | Returned | Closed)

4.4. Search input: filter client-side by `itemName` dan `id`

4.5. Click card → `navigate(`/lost-items/${item.id}`)` — bukan drawer

4.6. Hapus `selectedItem` state dan `ItemDetailDrawer` usage

**MyLostReportsPage changes:**

Sama seperti LostItemListPage tapi:
- Gunakan `useMyLostReports()` hook
- Tidak ada role check untuk actions (employee view only)
- Tidak ada stats bar per role (hanya Total)

---

## Task 5 — Frontend: Buat LostItemDetailPage

**File baru:** `apps/frontend/src/features/request-center/pages/LostItemDetailPage.tsx`

**Route:** `/lost-items/:id`

**Data fetching:**
```typescript
const { id } = useParams();
const { data: item, isLoading } = useLostItemReport(id!);
const { data: foundClaims } = useFoundClaimsForReport(id!); // filter by lostItemReportId
const { mutate: updateStatus } = useUpdateLostItemStatus();
const { user } = useAuth();
const isICT = ['ADMIN', 'AGENT', 'MANAGER'].includes(user?.role);
```

**Layout — 2 kolom:**

Kolom kiri (flex-1):
- **Info Barang:** tipe, serial, asset tag, lokasi, tanggal, kejadian, witness contact
- **Foto:** PhotoGrid component yang sudah ada
- **Police Report:** section upload/view (lihat Task 6)

Kolom kanan (w-80):
- **Timeline:** StatusTimeline component yang sudah ada
- **QR Code:** `item.qrCodeUrl` → tampilkan sebagai `<img>` + tombol "Download" + "Copy link"

Bawah (full width):
- **Found Claims section:** hanya tampil jika `foundClaims.length > 0`
  - Header: "Laporan Penemu" + badge count
  - List `FoundClaimCard` per claim
  - Highlight hijau jika ada yang PENDING

**ICT Actions bar** (sticky bottom atau di bawah header):
- Render `ContextualActions` yang sudah ada — update props sesuai workflow baru

**Breadcrumb:** `← Barang Hilang` → navigate(-1)

---

## Task 6 — Frontend: Police Report Upload di Detail Page

**Di dalam LostItemDetailPage.tsx**, section "Police Report":

```tsx
{item.hasPoliceReport ? (
  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
    <FileText className="w-4 h-4 text-slate-500" />
    <span className="text-sm text-slate-700">No. {item.policeReportNumber}</span>
    <a href={item.policeReportFile} target="_blank" className="ml-auto text-sm text-blue-600 hover:underline">
      Lihat File
    </a>
  </div>
) : (
  <PoliceReportUpload itemId={item.id} onSuccess={() => refetch()} />
)}
```

**Buat komponen `PoliceReportUpload.tsx`** (inline di file atau file terpisah kecil):
- Input: nomor laporan polisi (text) + file upload (PDF/JPG)
- Submit → `POST /lost-item/:id/police-report` multipart
- Gunakan React Query mutation
- Toast sukses/error

**API hook baru** di `lost-item.api.ts`:
```typescript
export function useUploadPoliceReport() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
            api.post(`/lost-item/${id}/police-report`, formData),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ['lost-item', id] });
            toast.success('Police report berhasil diupload');
        },
    });
}
```

---

## Task 7 — Frontend: QR Landing Page

**File baru:** `apps/frontend/src/features/request-center/pages/QrLandingPage.tsx`

**Route:** `/found/:token` — public route, tidak perlu auth untuk **lihat info**

**Data fetching:**
```typescript
const { token } = useParams();
const { data, isLoading, isError } = useQuery({
    queryKey: ['qr-report', token],
    queryFn: () => lostItemApi.getByQrToken(token!),
});
```

**States:**
- Loading → skeleton
- Error/not found → "QR tidak valid atau sudah kadaluarsa"
- `data.status === 'RETURNED' || 'CLOSED_LOST'` → "Barang ini sudah ditemukan, terima kasih!"
- Normal → tampil info + tombol

**Layout:**
```tsx
<div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
  <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
    <div className="text-center mb-6">
      <div className="text-4xl mb-2">{typeIcon}</div>
      <h1 className="text-xl font-bold text-slate-900">{data.itemName}</h1>
      <p className="text-slate-500 text-sm">Terakhir terlihat: {data.lastSeenLocation}</p>
    </div>

    {/* Info pemilik */}
    <div className="bg-slate-50 rounded-xl p-4 mb-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-2">Hubungi Pemilik</h2>
      <p className="text-sm text-slate-600">{data.reporter?.name}</p>
      <p className="text-sm text-slate-500">{data.reporter?.email}</p>
    </div>

    <button onClick={() => setShowModal(true)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium">
      Saya Menemukannya →
    </button>
  </div>
</div>
```

**Modal "Saya Menemukannya":**
- Form fields: lokasi ditemukan, tanggal/waktu, deskripsi, foto (opsional)
- Jika user belum login → redirect `/login?redirect=/found/${token}`
- Submit → `POST /found-claim` dengan `lostItemReportId: data.reportId`
- Sukses → pesan terima kasih, sembunyikan tombol

---

## Task 8 — Frontend: Update ContextualActions + Routing + Cleanup

**8.1. ContextualActions.tsx — update:**
- Hapus action untuk status `VERIFIED`
- Hapus `FOUND` dari logic (legacy)
- Actions per status sesuai spec:
  ```
  REPORTED: [Mulai Pencarian, Tutup]
  SEARCHING: [Tutup]
  CLAIMED: [Konfirmasi Dikembalikan, Tutup]
  RETURNED: [] (read-only message)
  CLOSED_LOST: [] (read-only message)
  ```
- Employee pesan kontekstual (bukan action buttons)

**8.2. Router — tambah routes:**
```tsx
// Di router config (cari file router/index.tsx atau App.tsx)
{ path: '/lost-items/:id', element: <LostItemDetailPage /> }
{ path: '/found/:token', element: <QrLandingPage /> }  // public route
```

Pastikan `/found/:token` tidak diprotect auth guard.

**8.3. LostItemListPage & MyLostReportsPage:**
- Hapus `import ItemDetailDrawer`
- Hapus `selectedItem`, `isDrawerOpen` state
- Hapus `<ItemDetailDrawer ... />` dari JSX

**8.4. Toast notifications:**
- Semua ICT action → toast sukses/error (sudah ada pattern di codebase, ikuti pattern yang sama)

**8.5. React Query invalidations:**
- Setelah update status → `queryClient.invalidateQueries(['lost-items'])`
- Setelah update status → `queryClient.invalidateQueries(['lost-item', id])`

---

## Verification Checklist

```
[ ] Employee lapor kehilangan → card di My Reports, status REPORTED
[ ] ICT klik "Mulai Pencarian" → status SEARCHING, timeline update
[ ] Employee scan QR → page tampil info + kontak (tanpa login)
[ ] Employee klik "Saya Menemukannya" → form → submit → status CLAIMED
[ ] ICT detail page CLAIMED → found claim card inline dengan foto
[ ] ICT "Konfirmasi Dikembalikan" → status RETURNED, ticket RESOLVED
[ ] ICT "Tutup" → status CLOSED_LOST, ticket CANCELLED
[ ] Police report upload → tampil nomor + link file
[ ] Admin/Agent/Manager semua dapat action yang sama
[ ] Status VERIFIED tidak muncul di UI manapun
[ ] QR page `/found/:token` accessible tanpa auth
[ ] Navigate klik card → full detail page (bukan drawer)
[ ] TypeScript build: rtk tsc → no errors
```

---

## File Summary

### Backend (modifikasi)
- `apps/backend/src/modules/lost-item/entities/lost-item-report.entity.ts` — VERIFIED comment
- `apps/backend/src/modules/lost-item/lost-item.service.ts` — QR fields, updateStatus fix
- `apps/backend/src/modules/lost-item/found-claim.service.ts` — hapus VERIFIED dari match()
- `apps/backend/src/modules/lost-item/lost-item.controller.ts` — QR public access

### Frontend (modifikasi)
- `apps/frontend/src/features/request-center/pages/LostItemListPage.tsx`
- `apps/frontend/src/features/request-center/pages/MyLostReportsPage.tsx`
- `apps/frontend/src/features/request-center/components/ContextualActions.tsx`
- `apps/frontend/src/features/request-center/api/lost-item.api.ts`

### Frontend (baru)
- `apps/frontend/src/features/request-center/pages/LostItemDetailPage.tsx`
- `apps/frontend/src/features/request-center/pages/QrLandingPage.tsx`
- `apps/frontend/src/features/request-center/components/LostItemCard.tsx`
- `apps/frontend/src/features/request-center/components/FoundClaimCard.tsx`
