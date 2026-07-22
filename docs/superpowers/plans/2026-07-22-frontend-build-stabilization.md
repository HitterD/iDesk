# Frontend Build Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulihkan `apps/frontend` sampai `npm run build` dan `npm test` selesai exit `0` tanpa menyembunyikan error source aplikasi atau mengubah workflow backend.

**Architecture:** Production compiler hanya memproses source aplikasi; Vitest tetap menguji test source sendiri. Setelah noise compiler hilang, setiap consumer diselaraskan dengan kontrak type/hook/component yang sudah ada. Perubahan dibagi per domain agar satu kegagalan tidak menutupi regression domain lain.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, TanStack Query 5, Framer Motion 12, Zod 4.

## Global Constraints

- Jangan tambah dependency, route, endpoint, atau halaman baru.
- Jangan gunakan `any`, cast paksa, atau perluasan type domain untuk menutupi consumer legacy.
- Jangan ubah backend authorization atau hardware-request state-machine.
- Procurement ICT harus valid pada `APPROVED` dan `PROCUREMENT`; backend otomatis transisi `APPROVED → PROCUREMENT` pada keputusan pertama.
- Production build mengecualikan test source, bukan source aplikasi.
- Setiap task harus menjalankan test fokus sebelum commit.

---

## File Map

| Domain | Files |
|---|---|
| Compiler boundary | `apps/frontend/tsconfig.app.json` |
| Notification command center | `ActionCommandCenter.tsx`, `action-item.types.ts`, `useActionItems.ts`, `useSnoozeActionItem.ts`, `NotificationSettings.tsx` |
| Hardware request app | calendar, catalog, delivery, detail, list, count hook, empty state |
| Client/request center | `ClientTicketDetailPage.tsx`, `EformAccessCreatePage.tsx` |
| Ticket board/admin | Preset, agent toolbar, ticket types/hooks, Oracle page, Zod form |
| Zoom | booking form, calendar page and its prop contracts |
| Test repair | hardware request test source named below |

---

### Task 1: Pisahkan Compiler Production dari Test Source

**Files:**
- Modify: `apps/frontend/tsconfig.app.json:39-41`

**Interfaces:**
- Consumes: Vitest menjalankan test melalui `apps/frontend/vitest.config.ts`.
- Produces: `tsc -b` hanya memeriksa runtime source aplikasi.

- [ ] **Step 1: Reproduksi baseline compiler**

```bash
cd apps/frontend
npx tsc -b --pretty false
```

Expected: gagal dengan globals test tidak ditemukan, misalnya `describe`, `it`, atau `expect` pada file `__tests__`.

- [ ] **Step 2: Ubah scope TypeScript build**

Ganti akhir `tsconfig.app.json` menjadi:

```json
"include": ["src"],
"exclude": [
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "src/**/*.spec.ts",
  "src/**/*.spec.tsx",
  "src/**/__tests__/**"
]
```

Biarkan `compilerOptions.types` tetap hanya `vite/client` dan `node`.

- [ ] **Step 3: Pastikan build tidak lagi melaporkan globals test**

```bash
npx tsc -b --pretty false 2>&1 | grep -E "(__tests__|\.test\.|\.spec\.)" && exit 1 || exit 0
```

Expected: exit `0`.

- [ ] **Step 4: Pastikan Vitest tetap menemukan test**

```bash
npm test -- src/components/notifications/utils/__tests__/notificationRouter.test.ts
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/tsconfig.app.json
git commit -m "fix(frontend): exclude tests from production typecheck"
```

---

### Task 2: Selaraskan Notification Command Center dan Settings

**Files:**
- Modify: `apps/frontend/src/components/notifications/types/action-item.types.ts:1-25`
- Modify: `apps/frontend/src/components/notifications/ActionCommandCenter.tsx:14,106,157,259`
- Modify: `apps/frontend/src/features/notifications/hooks/useActionItems.ts:13,46-53`
- Modify: `apps/frontend/src/features/settings/components/NotificationSettings.tsx:20,88,426-451`
- Read: `apps/frontend/src/features/notifications/hooks/useCategorySettings.ts`
- Read: `apps/frontend/src/components/notifications/types/notification.types.ts`

**Interfaces:**
- Produces `SnoozeDuration = '30m' | '2h' | 'tomorrow'`.
- Consumes `useSnoozeActionItem()` return `{ snooze, isSnoozing, unsnooze, isUnsnoozing }`.
- Consumes `useActionItems()` return `isFetching` from TanStack Query.
- Consumes `useCategorySettings()` return `{ settings, updateSettings }`.

- [ ] **Step 1: Tambah type snooze yang dipakai UI**

Tambahkan setelah `ActionItemEntityType`:

```ts
export type SnoozeDuration = '30m' | '2h' | 'tomorrow';
```

Ubah duration hook menjadi type itu:

```ts
import { ActionItemEntityType, SnoozeDuration } from '@/components/notifications/types/action-item.types';

interface SnoozeVariables {
    entityType: ActionItemEntityType;
    entityId: string;
    duration: SnoozeDuration;
}
```

- [ ] **Step 2: Pakai nama return hook aktual**

Di `ActionCommandCenter.tsx`, ganti:

```ts
const { snooze, unsnooze, isSnoozePending } = useSnoozeActionItem();
```

menjadi:

```ts
const { snooze, unsnooze, isSnoozing } = useSnoozeActionItem();
```

Lalu ganti `disabled={isSnoozePending}` menjadi `disabled={isSnoozing}`.

- [ ] **Step 3: Expose state fetch action items**

Di return `useActionItems()`, tambahkan `isFetching`:

```ts
return {
    items: allItems,
    activeItems,
    counts: data?.counts || { critical: 0, high: 0, normal: 0, total: 0 },
    isLoading,
    isFetching,
    error,
    refetch,
};
```

- [ ] **Step 4: Selaraskan category settings**

Import `CategorySettings` dari file yang mengekspornya, bukan hook file. Ganti destructuring menjadi:

```ts
const { settings: categorySettings, isLoading: catLoading, updateSettings } = useCategorySettings();
```

Tetapkan key dengan `satisfies` agar bukan `string | number | symbol`:

```ts
const ACTION_ITEM_CATEGORIES = [
    { key: 'TICKET', label: 'Ticket', desc: 'SLA warning, tiket belum dibalas' },
    { key: 'HARDWARE_REQUEST', label: 'Hardware Request', desc: 'Approval, schedule, procurement' },
    { key: 'EFORM', label: 'E-Form', desc: 'Permintaan akses menunggu proses' },
    { key: 'RENEWAL', label: 'Renewal', desc: 'Kontrak mendekati expired' },
    { key: 'ZOOM', label: 'Zoom', desc: 'Booking dan jadwal meeting' },
] satisfies Array<{ key: keyof CategorySettings; label: string; desc: string }>;
```

Render kategori hanya saat `categorySettings` tersedia dan panggil:

```tsx
onClick={() => updateSettings({ [key]: !categorySettings[key] })}
```

- [ ] **Step 5: Jalankan compiler dan test notification**

```bash
npx tsc -b --pretty false
npm test -- src/components/notifications/utils/__tests__/notificationRouter.test.ts
```

Expected: tidak ada error dari empat file notification; test `4 passed`.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/notifications apps/frontend/src/features/notifications/hooks/useActionItems.ts apps/frontend/src/features/notifications/hooks/useSnoozeActionItem.ts apps/frontend/src/features/settings/components/NotificationSettings.tsx
git commit -m "fix(notifications): align command center types and hooks"
```

---

### Task 3: Perbaiki Consumer Hardware Request terhadap Kontrak Domain

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx:225-234`
- Modify: `apps/frontend/src/features/hardware-request/components/catalog/CatalogEditModal.tsx:42-49`
- Modify: `apps/frontend/src/features/hardware-request/components/delivery/DeliveryBoard.tsx:77-81`
- Modify: `apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx:83-89`
- Modify: `apps/frontend/src/features/hardware-request/components/detail/ItemsCard.tsx:10-20`
- Modify: `apps/frontend/src/features/hardware-request/components/list/RequestRowDrawer.tsx:150-162`
- Modify: `apps/frontend/src/features/hardware-request/components/list/RequestTable.tsx:57-70`
- Modify: `apps/frontend/src/features/hardware-request/hooks/useHardwareRequestsCount.ts:1-13`
- Modify: `apps/frontend/src/features/hardware-request/components/common/EmptyState.tsx:1-15`
- Test: `apps/frontend/src/features/hardware-request/utils/__tests__/permission.util.test.ts`

**Interfaces:**
- Consumes `HardwareRequest.recipient?: UserLite | null`, no `recipientName` or `division`.
- Consumes `HardwareRequestItem.quantity` and `categorySnapshot`.
- Consumes `reschedule.mutateAsync({ requestId, payload: { proposedAt, reason } })`.
- Produces a valid `RequestStatus[]` count filter.

- [ ] **Step 1: Perbaiki mutation reschedule dan catalog payload**

Ganti pemanggilan reschedule:

```ts
await reschedule.mutateAsync({
    requestId: pendingReschedule.requestId,
    payload: { proposedAt: pendingReschedule.to, reason },
});
```

Ganti payload catalog:

```ts
requiredFields: {},
```

- [ ] **Step 2: Hapus property item legacy**

Ganti seluruh fallback berikut:

```tsx
qty: {item.quantity || item.qty}
```

menjadi:

```tsx
qty: {item.quantity}
```

```tsx
r.items.map(i => i.catalogName || i.categorySnapshot?.name || i.category).join(', ')
```

menjadi:

```tsx
r.items.map(i => i.categorySnapshot?.name ?? i.name ?? '—').join(', ')
```

Untuk custom fields, narrow object unknown sebelum baca `recipientName`:

```ts
const recipientName = typeof snap.customFields === 'object' && snap.customFields !== null
    && 'recipientName' in snap.customFields
    ? String(snap.customFields.recipientName)
    : null;
```

Render `recipientName` hanya bila tidak null.

- [ ] **Step 3: Hapus property request legacy**

Hapus baris division dari drawer dan tabel. Ganti penerima:

```tsx
{r.recipientName && (
    <span>Penerima: {r.recipientName}</span>
)}
```

menjadi:

```tsx
{r.recipient?.fullName && (
    <span className="text-xs text-slate-400 dark:text-slate-500">Penerima: {r.recipient.fullName}</span>
)}
```

- [ ] **Step 4: Ketatkan filter dan API empty state**

Di count hook:

```ts
import type { RequestStatus } from '../types';

const OPEN_STATUSES: RequestStatus[] = [
    'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCUREMENT',
    'AWAITING_DELIVERY', 'INSTALLATION',
];
```

Lalu:

```ts
queryFn: () => HardwareRequestApi.list({ status: OPEN_STATUSES, limit: 1 }),
```

Tambahkan `icon?: ReactNode` ke props `EmptyState`, lalu ganti icon statis:

```tsx
{icon ?? <PackageOpen className="size-6 text-slate-500" />}
```

- [ ] **Step 5: Kunci kontrak procurement aktual**

Ubah test menjadi:

```ts
it('allows ICT to start or continue procurement', () => {
    expect(canDecideProcurement(ictUser, { ...baseReq, status: 'APPROVED' })).toBe(true);
    expect(canDecideProcurement(ictUser, { ...baseReq, status: 'PROCUREMENT' })).toBe(true);
    expect(canDecideProcurement(ownerUser, { ...baseReq, status: 'APPROVED' })).toBe(false);
    expect(canDecideProcurement(ownerUser, { ...baseReq, status: 'PROCUREMENT' })).toBe(false);
});
```

- [ ] **Step 6: Jalankan test fokus hardware dan compiler**

```bash
npm test -- src/features/hardware-request/utils/__tests__/permission.util.test.ts
npx tsc -b --pretty false
```

Expected: test permission lulus; tidak ada error dari file Task 3.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/hardware-request
git commit -m "fix(hardware): align request consumers with domain types"
```

---

### Task 4: Selaraskan Client Ticket dan E-Form dengan Contract Components

**Files:**
- Modify: `apps/frontend/src/features/client/pages/ClientTicketDetailPage.tsx:67,382-391`
- Modify: `apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx:1-28,42`
- Read: `apps/frontend/src/components/ui/ConfirmationDialog.tsx`
- Read: `apps/frontend/src/stores/useAuth.ts`

**Interfaces:**
- `STATUS_CONFIG` menyediakan `color`, bukan `bg`.
- `ConfirmationDialog` menentukan callback cancel lewat prop actual component.
- Auth User menyediakan `departmentId`, bukan object `department`.

- [ ] **Step 1: Buat perubahan minimal client ticket**

Ganti:

```tsx
className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1", statusConfig.bg, statusConfig.color)}
```

dengan:

```tsx
className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 bg-slate-100 dark:bg-slate-800", statusConfig.color)}
```

Gunakan nama prop cancel dari `ConfirmationDialog` dan kirim explicit `undefined` ke mutation bila alasan opsional:

```tsx
onCancel={() => setIsCancelDialogOpen(false)}
onConfirm={() => cancelMutation.mutate(undefined)}
```

- [ ] **Step 2: Perbaiki auth field dan Framer Motion type**

Import `Variants`:

```ts
import { motion, type Variants } from 'framer-motion';
```

Deklarasikan:

```ts
const sectionVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.07, duration: 0.28, ease: 'easeOut' },
    }),
};
```

Ganti department initializer:

```ts
const [requesterDepartment, setRequesterDepartment] = useState(user?.departmentId || '');
```

- [ ] **Step 3: Jalankan compiler**

```bash
npx tsc -b --pretty false
```

Expected: tidak ada error dari dua file Task 4.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/client/pages/ClientTicketDetailPage.tsx apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx
git commit -m "fix(frontend): align ticket and eform component contracts"
```

---

### Task 5: Pulihkan Ticket Board, Admin, dan Zoom Contract Drift

**Files:**
- Modify: `apps/frontend/src/features/admin/components/PresetDrawer.tsx`
- Modify: `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx`
- Modify: `apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx`
- Modify: `apps/frontend/src/features/ticket-board/components/BulkAssignDialog.tsx`
- Modify: `apps/frontend/src/features/ticket-board/components/LostItemForm.tsx`
- Modify: `apps/frontend/src/features/ticket-board/components/VirtualizedTicketList.tsx`
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx`
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoTicketDetailPage.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/pages/ZoomCalendarPage.tsx`
- Read: each child prop type and hook/type import named in compiler errors before editing.

**Interfaces:**
- This task must use declarations from current imports as source of truth. Do not duplicate ticket/agent/zoom types locally.

- [ ] **Step 1: Reproduce only residual errors**

```bash
npx tsc -b --pretty false 2>&1 | grep -E "(PresetDrawer|BentoAdminAgentsPage|BentoCreateTicketPage|ticket-board|zoom-booking)"
```

Expected: exact residual list from these files.

- [ ] **Step 2: Apply contract corrections from source declarations**

Apply each direct correction:

```ts
// LostItemForm: Zod v4
z.date({ error: 'Date is required' })

// VirtualizedTicketList: remove local Agent interface; import Agent from TicketListRow
import type { Agent } from './TicketListRow';
```

For each remaining prop/type mismatch, read the receiving component/hook declaration, remove only unsupported props from caller, and use the exported type shared by receiver. Required direct fixes include removing stale `sortOrder`/`isDefault` access when absent from `PermissionPreset`, removing stale `users` prop when absent from `AgentFiltersToolbarProps`, and replacing invalid literal role comparisons with the current role union.

- [ ] **Step 3: Add or update focused tests before behavior-sensitive changes**

For zoom booking and Oracle ticket changes, run existing focused tests first:

```bash
npm test -- src/features/zoom-booking/pages/__tests__/ZoomCalendarPage.booking.test.tsx
```

Record failures, update mocks/assertions only when public component contract confirms old props were removed.

- [ ] **Step 4: Verify residual compiler list clears for domain**

```bash
npx tsc -b --pretty false 2>&1 | grep -E "(PresetDrawer|BentoAdminAgentsPage|BentoCreateTicketPage|ticket-board|zoom-booking)" && exit 1 || exit 0
```

Expected: exit `0`.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/admin apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx apps/frontend/src/features/ticket-board apps/frontend/src/features/zoom-booking
git commit -m "fix(frontend): align admin ticket and zoom contracts"
```

---

### Task 6: Selaraskan Test Copy dan Import Scheduling

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsLayout.test.tsx`
- Modify: `apps/frontend/src/features/hardware-request/components/__tests__/HardwareRequestsTabs.test.tsx`
- Modify: `apps/frontend/src/features/hardware-request/components/__tests__/RequiredFieldsBuilder.test.tsx`
- Modify: `apps/frontend/src/features/hardware-request/components/calendar/__tests__/StatsStrip.test.tsx`
- Modify: `apps/frontend/src/features/hardware-request/components/scheduling/__tests__/ScheduleProposeModal.test.tsx`
- Modify: `apps/frontend/src/features/hardware-request/components/scheduling/__tests__/SlotPickerModal.test.tsx`
- Modify: `apps/frontend/src/features/hardware-request/components/delivery/__tests__/DeliveryBoard.test.tsx`

**Interfaces:**
- Tests assert current public label/accessibility contracts, not removed English copy or nonexistent heading.
- Scheduling hook from component test directory is `../../../hooks/useScheduleSelection`.

- [ ] **Step 1: Ubah expected label test ke copy UI actual**

Gunakan assertion berikut:

```ts
expect(screen.getByRole('link', { name: /daftar request/i })).toBeInTheDocument();
expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
expect(screen.getByRole('link', { name: /jadwal instalasi/i })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /tambah custom field/i })).toBeInTheDocument();
expect(screen.getByText('Scheduled')).toBeInTheDocument();
```

Ganti assertion heading layout dengan nav dan outlet yang ada:

```ts
expect(screen.getByRole('navigation', { name: /hardware requests navigation/i })).toBeInTheDocument();
expect(screen.getByTestId('outlet-child')).toBeInTheDocument();
```

- [ ] **Step 2: Perbaiki import test scheduling dan duplikasi vi**

Pada test scheduling:

```ts
import { useScheduleSelection } from '../../../hooks/useScheduleSelection';
```

Pada `DeliveryBoard.test.tsx`, simpan hanya satu import `vi` dari `vitest`.

- [ ] **Step 3: Jalankan cluster test hardware**

```bash
npm test -- src/features/hardware-request/components/__tests__/HardwareRequestsLayout.test.tsx src/features/hardware-request/components/__tests__/HardwareRequestsTabs.test.tsx src/features/hardware-request/components/__tests__/RequiredFieldsBuilder.test.tsx src/features/hardware-request/components/calendar/__tests__/StatsStrip.test.tsx src/features/hardware-request/components/scheduling/__tests__/ScheduleProposeModal.test.tsx src/features/hardware-request/components/scheduling/__tests__/SlotPickerModal.test.tsx src/features/hardware-request/components/delivery/__tests__/DeliveryBoard.test.tsx src/features/hardware-request/utils/__tests__/permission.util.test.ts
```

Expected: seluruh test fokus lulus.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request
git commit -m "test(hardware): align assertions with current workflow UI"
```

---

### Task 7: Verifikasi End-to-End Frontend

**Files:**
- Modify: none unless verifier menemukan error baru yang berasal dari task sebelumnya.

- [ ] **Step 1: Jalankan production build**

```bash
cd apps/frontend
npm run build
```

Expected: exit `0`.

- [ ] **Step 2: Jalankan full test suite**

```bash
npm test
```

Expected: exit `0`.

- [ ] **Step 3: Jalankan lint bila script tersedia**

```bash
npm run lint
```

Expected: exit `0` atau report existing warning tanpa error.

- [ ] **Step 4: Review diff dan commit verifier bila perlu**

```bash
git diff --check
git status --short
git log --oneline -7
```

Expected: tidak ada whitespace error dan semua perubahan sudah berada pada commit domainnya.

---

## Self-Review

- **Spec coverage:** Task 1 menangani compiler boundary; Task 2 notification; Task 3 hardware domain dan procurement; Task 4 client/eform; Task 5 admin/ticket/zoom residual; Task 6 test contract; Task 7 memastikan target build dan suite.
- **Placeholder scan:** Tidak ada `TBD` atau kerja lanjutan tanpa file/command. Task 5 memerintahkan baca declaration receiver sebelum menghapus prop karena compiler menunjukkan kontrak source telah berubah dan menyebutkan direct fixes yang telah terbukti.
- **Type consistency:** Semua perubahan mengonsumsi export/hook existing; tidak ada type domain atau endpoint baru.
