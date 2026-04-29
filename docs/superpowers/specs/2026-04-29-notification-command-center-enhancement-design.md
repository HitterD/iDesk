# Notification Command Center Enhancement — Design Spec

**Date:** 2026-04-29  
**Branch:** feature/notification-command-center  
**Status:** Approved

---

## Overview

Penyempurnaan fitur Action Command Center dan Notification Center dengan:
1. **Auto-resolve** — item hilang otomatis saat entity di-handle (ticket dibalas, hardware approved, dll)
2. **Snooze manual** — user bisa tunda reminder 30 menit / 2 jam / Besok pagi
3. **CRITICAL banner** — highlight notifikasi kritis di NotificationCenter dengan tombol Acknowledge
4. **Per-kategori settings** — toggle on/off per kategori di halaman settings

---

## Architecture Overview

```
FRONTEND
  ① ActionCommandCenter (popover) — snooze UI + auto-resolve via socket
  ② NotificationCenter (page)    — CRITICAL banner + acknowledge button
  ③ NotificationSettings         — reminder intensity + per-kategori toggle

BACKEND
  ④ DB: tabel action_item_snooze  (migration baru)
  ⑤ Entity listeners              → emit socket event 'action-items:refresh:{userId}'
  ⑥ Snooze API endpoints          (POST/DELETE /notifications/action-items/snooze)
  ⑦ Per-category preference API   (GET/PATCH /notifications/preferences/categories)
```

**Flow auto-resolve:**
1. Entity berubah status → backend emit `action-items:refresh:{userId}` via socket
2. Frontend `useActionItems` listener menerima event → invalidate `['action-items']` query
3. `getActionItems()` query ulang → item yang sudah resolved tidak muncul
4. Polling 60s tetap berjalan sebagai fallback

**Flow snooze:**
1. User klik ⏰ pada action item → pilih durasi
2. `POST /notifications/action-items/snooze` → simpan ke DB
3. `getActionItems()` filter item dengan `snoozed_until > NOW()`
4. Item tersembunyi sampai waktu habis, kemudian muncul kembali otomatis

**Flow CRITICAL acknowledge:**
1. NotificationCenter query `GET /notifications/critical/unacknowledged`
2. Banner muncul jika count > 0
3. User klik Acknowledge → `POST /notifications/:id/acknowledge` (endpoint sudah ada)
4. Banner count berkurang, hilang saat semua acknowledged

---

## Data Model

### Tabel baru: `action_item_snooze`

```sql
CREATE TABLE action_item_snooze (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR     NOT NULL,
  entity_type   VARCHAR     NOT NULL,  -- TICKET | HARDWARE_REQUEST | EFORM | RENEWAL
  entity_id     VARCHAR     NOT NULL,
  snoozed_until TIMESTAMP   NOT NULL,
  created_at    TIMESTAMP   DEFAULT NOW(),
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX idx_snooze_user_expiry ON action_item_snooze (user_id, snoozed_until);
```

### Perubahan `notification_preference` (kolom baru)

```typescript
// Tambah kolom JSON di NotificationPreference entity
@Column({ type: 'jsonb', nullable: true })
categorySettings?: {
  TICKET: boolean;
  HARDWARE_REQUEST: boolean;
  EFORM: boolean;
  RENEWAL: boolean;
  ZOOM: boolean;
};
```

Default semua kategori `true` jika `categorySettings` null.

### Perubahan `ActionItem` type (frontend)

```typescript
// apps/frontend/src/components/notifications/types/action-item.types.ts
export interface ActionItem {
  id: string;
  entityType: ActionItemEntityType;
  title: string;
  description: string;
  urgency: ActionItemUrgency;
  entityId: string;
  link: string;
  createdAt: string;
  isSnoozed: boolean;       // baru
  snoozeUntil?: string;     // baru — ISO timestamp
}
```

---

## Auto-resolve Triggers

Backend emit `action-items:refresh:{userId}` ke socket saat:

| Entity | Event / Status |
|--------|---------------|
| **Ticket** | `TICKET_REPLY` sent · status → `RESOLVED` · status → `CLOSED` |
| **Hardware Request** | status → `APPROVED` · `REJECTED` · `COMPLETED` |
| **E-Form** | status → `ICT_CONFIRMED` · `REJECTED` |
| **Renewal** | tanggal expiry kontrak diperbarui |

Implementasi: tambahkan emit di listener/service yang sudah ada (tidak membuat listener baru).

```typescript
// Contoh pola emit di entity service/listener
this.notificationGateway.emitToUser(
  userId,
  'action-items:refresh',
  { entityType: 'TICKET', entityId: ticketId }
);
```

---

## API Endpoints Baru

### Snooze

```
POST   /notifications/action-items/snooze
Auth:  Bearer JWT
Body:  { entityType: ActionItemEntityType, entityId: string, duration: '30m' | '2h' | 'tomorrow' }
→     Upsert ke action_item_snooze; emit 'action-items:refresh:{userId}'
→     Response: { success: true, snoozeUntil: ISO string }

DELETE /notifications/action-items/snooze
Auth:  Bearer JWT
Body:  { entityType: ActionItemEntityType, entityId: string }
→     Hapus record snooze; emit 'action-items:refresh:{userId}'
→     Response: { success: true }
```

**Duration resolver:**
```typescript
function resolveSnoozedUntil(duration: '30m' | '2h' | 'tomorrow'): Date {
  const now = new Date();
  if (duration === '30m')     return addMinutes(now, 30);
  if (duration === '2h')      return addHours(now, 2);
  const tomorrow = startOfDay(addDays(now, 1));
  return setHours(tomorrow, 8);  // besok jam 08:00
}
```

### Per-category Settings

```
GET    /notifications/preferences/categories
Auth:  Bearer JWT
→     Response: { TICKET: true, HARDWARE_REQUEST: true, EFORM: true, RENEWAL: true, ZOOM: false }

PATCH  /notifications/preferences/categories
Auth:  Bearer JWT
Body:  Partial<{ TICKET: boolean, HARDWARE_REQUEST: boolean, EFORM: boolean, RENEWAL: boolean, ZOOM: boolean }>
→     Merge update ke categorySettings; emit 'action-items:refresh:{userId}'
→     Response: updated categorySettings
```

---

## Frontend Changes

### ① ActionCommandCenter (`ActionCommandCenter.tsx`)

**ActionRow** — tambah snooze button:
- Icon `Clock` dari lucide-react, muncul saat row di-hover (`opacity-0 group-hover:opacity-100`)
- Klik buka dropdown dengan 3 opsi: **30 menit / 2 jam / Besok pagi**
- Item snoozed: opacity dikurangi (`opacity-50`), badge abu-abu `"Snoozed · sampai HH:mm"`
- Klik badge snooze → unsnooze (DELETE endpoint)

**Badge count di topbar:** hanya hitung item yang `!isSnoozed`

**useActionItems.ts** — tambah socket listener:
```typescript
socket.on(`action-items:refresh:${user.id}`, () => {
  queryClient.invalidateQueries({ queryKey: ['action-items'] });
});
```

**File baru:** `useSnoozeActionItem.ts`
```typescript
export const useSnoozeActionItem = () => {
  const queryClient = useQueryClient();
  const snooze = useMutation({ ... POST /notifications/action-items/snooze ... });
  const unsnooze = useMutation({ ... DELETE /notifications/action-items/snooze ... });
  return { snooze, unsnooze };
};
```

### ② NotificationCenter (`NotificationCenter.tsx`)

**CriticalBanner** — component baru di atas tab bar:
```
┌─────────────────────────────────────────────────────┐
│ ⚠  2 notifikasi kritis perlu konfirmasi     [Lihat] │
└─────────────────────────────────────────────────────┘
```
- Hanya muncul jika `unacknowledgedCount > 0`
- Klik [Lihat] → setReadFilter('all') + scroll ke notifikasi CRITICAL pertama
- Hilang otomatis saat semua acknowledged

**NotificationItem** — tambah acknowledge button untuk item `requiresAcknowledge = true && !acknowledgedAt`:
- Border kiri merah (`border-l-2 border-red-500`)
- Tombol "Acknowledge" kecil di kanan bawah item
- Klik → `POST /notifications/:id/acknowledge` → optimistic update

**useNotificationCenter.ts** — tambah:
- Query `unacknowledgedCriticalCount` dari `GET /notifications/critical/count`
- Socket listener `notification:acknowledged:${user.id}` untuk invalidate count

### ③ NotificationSettings (`NotificationSettings.tsx`)

Tambah section baru **"Kategori Action Items"** di bawah Reminder Intensity:

```
Kategori Action Items
─────────────────────────────────────────
Ticket                    [Toggle ON/OFF]
Hardware Request          [Toggle ON/OFF]
E-Form                    [Toggle ON/OFF]
Renewal                   [Toggle ON/OFF]
Zoom                      [Toggle ON/OFF]
─────────────────────────────────────────
Toggle OFF = kategori tidak muncul di Action Command Center
```

- Optimistic update dengan rollback on error
- `ReminderSettingsPanel` dari ActionCommandCenter dipindah ke sini sebagai section utama (tetap ada shortcut di popover)

**File baru:** `useCategorySettings.ts`
```typescript
export const useCategorySettings = () => {
  const query = useQuery({ queryKey: ['notification-category-settings'], ... });
  const mutation = useMutation({ ... PATCH /notifications/preferences/categories ... });
  return { settings: query.data, update: mutation.mutate, isLoading: query.isLoading };
};
```

---

## Backend Files to Modify / Create

| File | Action |
|------|--------|
| `src/migrations/TIMESTAMP-AddActionItemSnooze.ts` | Baru — migration tabel + index |
| `src/modules/notifications/entities/action-item-snooze.entity.ts` | Baru — TypeORM entity |
| `src/modules/notifications/dto/snooze-action-item.dto.ts` | Baru — DTO untuk snooze endpoint |
| `src/modules/notifications/notification.controller.ts` | Modify — tambah 2 snooze endpoints + 2 category endpoints |
| `src/modules/notifications/notification-center.service.ts` | Modify — `getActionItems` join snooze + filter kategori |
| `src/modules/notifications/notification.module.ts` | Modify — inject ActionItemSnooze repo |
| `src/modules/notifications/entities/notification-preference.entity.ts` | Modify — tambah kolom `categorySettings` |
| Ticket service/listener | Modify — emit `action-items:refresh` on reply/resolve/close |
| Hardware request listener | Modify — emit `action-items:refresh` on status change |
| E-Form listener | Modify — emit `action-items:refresh` on confirm/reject |
| Renewal service | Modify — emit `action-items:refresh` on contract update |

---

## Frontend Files to Modify / Create

| File | Action |
|------|--------|
| `components/notifications/types/action-item.types.ts` | Modify — tambah `isSnoozed`, `snoozeUntil` |
| `components/notifications/ActionCommandCenter.tsx` | Modify — snooze UI, badge count fix |
| `components/notifications/NotificationCenter.tsx` | Modify — CriticalBanner, acknowledge flow |
| `components/notifications/NotificationItem.tsx` | Modify — acknowledge button untuk CRITICAL |
| `features/notifications/hooks/useActionItems.ts` | Modify — socket listener baru |
| `features/notifications/hooks/useSnoozeActionItem.ts` | Baru — snooze/unsnooze mutations |
| `features/notifications/hooks/useCategorySettings.ts` | Baru — category settings query + mutation |
| `features/settings/components/NotificationSettings.tsx` | Modify — tambah category toggles section |

---

## Error Handling

- Snooze gagal → toast error, item tetap aktif (tidak optimistic untuk snooze)
- Acknowledge gagal → toast error, badge tidak berkurang
- Category toggle gagal → rollback optimistic update, toast error
- Socket disconnect → polling 60s sebagai fallback

---

## Out of Scope

- Snooze cross-device sync (pakai DB tapi tidak real-time sync antar device, hanya fresh fetch)
- Push notification untuk snooze expiry
- Bulk snooze semua item
- Custom snooze duration
