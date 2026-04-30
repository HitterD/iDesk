# iDesk Notification Command Center — Audit & Fix Design

**Date:** 2026-04-30
**Branch:** feature/notification-command-center
**Scope:** Perbaikan bertahap backend dan frontend pada modul notifikasi
**Approach:** Fase A — Fix Bertahap (3 commit terpisah: Backend → Frontend → Polish)

---

## Konteks

Branch ini mengimplementasikan Action Command Center (panel action items berdasarkan role user). Audit menemukan **15 isu** tersebar di backend service, controller, dan frontend hooks/components — dari dead code, mutasi entity, type safety, hingga memory leak dan performance.

---

## Fase 1 — Backend P0/P1

**Target files:**
- `apps/backend/src/modules/notifications/notification-center.service.ts`
- `apps/backend/src/modules/notifications/notification.controller.ts`

### Perubahan

| # | Masalah | Fix |
|---|---------|-----|
| 1 | `notificationQueue` array dideklarasi tapi tidak digunakan (baris 31–36) | Hapus field dan type definition-nya |
| 2 | `Object.assign(prefs, updates)` mutasi entity TypeORM langsung (baris 177) | Ganti ke `return this.preferenceRepo.save({ ...prefs, ...updates })` |
| 3 | `getActionItems` return type `Promise<any>` (baris 245) | Ubah ke `Promise<ActionItemsResponseDto>` |
| 4 | `updateCategorySettings` throw `new Error()` bukan NestJS exception (baris 235) | Ganti ke `throw new NotFoundException('Notification preferences not found')` |
| 5 | Counter `critical`/`high`/`normal` dihitung di awal lalu dibuang, dihitung ulang di akhir (baris 247–249) | Hapus counter pertama — hanya pertahankan kalkulasi final dari `activeItems` |
| 6 | `body.notificationType as any` di controller | Cast ke `body.notificationType as NotificationType` |
| 7 | `retryFailedDeliveries`: jika `channelService` tidak ada, `retryCount` tidak diincrement → retry loop permanen | Increment `retryCount` meski channel tidak tersedia |
| 8 | `digestBuffer` tidak dibatasi ukurannya (memory leak potensial) | Tambah guard: jika buffer user > 100 notif, trim 50 oldest sebelum push |

---

## Fase 2 — Frontend P1/P2

**Target files:**
- `apps/frontend/src/components/notifications/ActionCommandCenter.tsx`
- `apps/frontend/src/features/notifications/hooks/useActionItems.ts`

### Perubahan

| # | Masalah | Fix |
|---|---------|-----|
| 1 | `ActionRow` snooze menu tidak tutup saat klik di luar | Tambah `useRef` + `useEffect` dengan `mousedown` handler (pola sama seperti TicketChat sticker picker) |
| 2 | `grouped` dihitung ulang setiap render | Bungkus dengan `useMemo([items])` |
| 3 | `isRefreshing` local state redundan | Hapus state + `handleRefresh` wrapper; expose `isFetching` dari hook langsung |
| 4 | `ReminderSettingsPanel` useEffect tanpa cleanup | Tambah `AbortController`; `return () => ctrl.abort()` |
| 5 | `useActionItems` tanpa `staleTime` | Tambah `staleTime: 30_000, gcTime: 120_000` |

### Detail: Snooze menu fix

```tsx
// Di ActionRow component
const menuRef = useRef<HTMLDivElement>(null);
useEffect(() => {
    if (!showSnoozeMenu) return;
    const handler = (e: MouseEvent) => {
        if (!menuRef.current?.contains(e.target as Node))
            setShowSnoozeMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
}, [showSnoozeMenu]);
```

### Detail: useActionItems fix

```ts
useQuery<ActionItemsResponse>({
    queryKey: ['action-items'],
    queryFn: async () => { ... },
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 120_000,
});
```

---

## Fase 3 — Polish (P3)

**Target files:**
- `apps/backend/src/modules/notifications/notification-center.service.ts` (sendDigest)
- `apps/backend/src/modules/notifications/notification.controller.ts` (DTOs)

### Perubahan

| # | Masalah | Fix |
|---|---------|-----|
| 1 | `sendDigest` pakai `notificationId: digest-${Date.now()}` (fake ID) | Ganti ke `crypto.randomUUID()` |
| 2 | Controller body params pakai `Record<string, any>` tanpa validasi | Buat `UpdatePreferencesDto` dengan `class-validator` decorators |

---

## Prinsip yang Dijaga

- **Tidak ubah output/behavior** — semua fix bersifat internal (type safety, cleanup, performance). Response shape tidak berubah.
- **Minimal changes** — tidak ada refactor arsitektur, hanya perbaikan per-issue.
- **Immutability** — spread operator menggantikan mutasi langsung.
- **Konsistensi codebase** — pola `mousedown` + `useRef` diambil dari TicketChat yang sudah ada.

---

## Tidak Termasuk Scope

- Migrasi `digestBuffer` ke Redis/Bull (disebut di komentar kode sebagai "production TODO")
- Refactor `getActionItems` ke query builder (perubahan besar, bisa dikerjakan di iterasi terpisah)
- Split `useNotificationCenter` hook (refactor besar, tidak P0/P1)
