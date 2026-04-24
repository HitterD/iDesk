# iDesk Notification Command Center — Design Spec

**Tanggal:** 2026-04-24  
**Status:** Draft — Menunggu review  
**Scope:** Notification system overhaul untuk semua role (USER, AGENT, ADMIN, MANAGER)

---

## Background

Sistem notifikasi iDesk saat ini memiliki toast 5 detik yang mudah terlewat, tidak ada "action inbox" terpusat, dan semua notif terasa setara tanpa urgency visual. Akibatnya semua role — user, agent, admin — berpotensi melewatkan tugas atau ticket.

## Tujuan

Setiap user, agent, dan admin **tidak melewatkan item yang membutuhkan aksi mereka** — baik ticket baru, approval pending, SLA breach, maupun renewal expiry.

---

## Solusi: Hybrid Command Center

Dua lapisan saling melengkapi:

1. **Action Command Center** — Topbar dropdown yang menampilkan action items berdasarkan *entity state* (bukan notif log). Selalu akurat, auto-resolve saat item selesai.
2. **Persistent Reminder Toast** — Re-surface toast yang bisa dikonfigurasi user (Off / Gentle / Moderate / Assertive) untuk item urgent yang belum ditangani.

Sistem notifikasi yang ada (bell popover, in-app toast, critical banner) **tetap dipertahankan** tanpa breaking change.

---

## Arsitektur

```
┌─────────────────────────────────────────────────────┐
│                     TOPBAR                          │
│  Logo  [Search...]          [ACTIONS 3] [🔔] [👤]  │
└─────────────────────────────────────────────────────┘
              ↓ klik "ACTIONS"
┌─────────────────────────────────────────────────────┐
│  ActionCommandCenter (Dropdown)                     │
│  ├─ 🔴 Critical   SLA Breach TKT-2024      [→]     │
│  ├─ 🟡 High       Approval Pending HW-089  [→]     │
│  ├─ 🟡 High       Renewal D-7 Adobe CC     [→]     │
│  └─ 🔵 Normal     Ticket kamu direspon     [→]     │
│  [⚙ Reminder settings]           [Mark all done]  │
└─────────────────────────────────────────────────────┘

Data source: GET /api/action-items (entity-state query)
Refresh: polling 60s + socket invalidate on events
```

---

## Action Items per Role

| Role | Item | Urgency |
|---|---|---|
| **USER** | Ticket butuh info tambahan | High |
| **USER** | Ticket resolved → konfirmasi | Normal |
| **USER** | Approval eform diminta | High |
| **AGENT** | Ticket baru ter-assign | High |
| **AGENT** | Ticket unresponded >SLA threshold | Critical |
| **AGENT** | Ticket mention | Normal |
| **ADMIN** | Hardware approval pending | High |
| **ADMIN** | Eform approval pending | High |
| **ADMIN** | SLA breach (ticket) | Critical |
| **ADMIN/MANAGER** | Renewal D-7 expiry | High |
| **ADMIN/MANAGER** | Renewal D-1 / expired | Critical |

---

## Urgency Tiers

| Tier | Warna | Kriteria |
|---|---|---|
| 🔴 **Critical** | `#ef4444` | SLA breached, D-1 renewal, expired |
| 🟡 **High** | `#f59e0b` | Ticket assigned unresponded, approval pending, D-7 renewal |
| 🔵 **Normal** | `#3b82f6` | Info follow-up, reply received |

---

## Komponen Frontend (Baru)

### `ActionCommandCenter.tsx`
- Lokasi: `apps/frontend/src/components/notifications/ActionCommandCenter.tsx`
- Menggantikan posisi `NotificationPopover` sebagai primary action point di topbar
- Props: none (self-contained, pakai `useActionItems` hook)
- UI: Radix `Popover` dengan dropdown grouped by urgency tier
- Pulse animation dot merah saat ada item Critical

### `useActionItems.ts`
- Lokasi: `apps/frontend/src/features/notifications/hooks/useActionItems.ts`
- Polling `GET /api/action-items` setiap 60 detik
- Socket listener: invalidate query saat ada socket event `notification:${user.id}`
- Return: `{ items, criticalCount, highCount, normalCount, totalCount }`

### `useReminderEngine.ts`
- Lokasi: `apps/frontend/src/features/notifications/hooks/useReminderEngine.ts`
- Membaca `reminderIntensity` dari user preference (Off / Gentle / Moderate / Assertive)
- Interval: Off=none, Gentle=60m, Moderate=30m, Assertive=15m
- Trigger: jika ada item Critical/High dan belum ditangani selama `intervalMs`
- Menampilkan re-surface toast via existing `InAppNotificationToast` pattern
- State disimpan di `useRef` (tidak persist ke server — hanya session)

### Modifikasi Layout
- `BentoTopbar.tsx` — tambah `<ActionCommandCenter />` di samping `<NotificationPopover />`
- `Topbar.tsx` — sama
- `ClientLayout.tsx` — sama (untuk user/client role)

---

## Backend (Baru)

### `GET /api/action-items`
- Controller: `apps/backend/src/modules/notifications/notification.controller.ts`
- Service method: `NotificationCenterService.getActionItems(userId, role)`
- Query entity state langsung dari DB (bukan tabel `notifications`)
- Response schema:

```ts
interface ActionItemsResponse {
  items: ActionItem[];
  counts: { critical: number; high: number; normal: number; total: number };
}

interface ActionItem {
  id: string;
  type: ActionItemType;
  title: string;
  description: string;
  urgency: 'CRITICAL' | 'HIGH' | 'NORMAL';
  entityType: 'TICKET' | 'HARDWARE_REQUEST' | 'EFORM' | 'RENEWAL';
  entityId: string;
  link: string;
  createdAt: string;
}
```

### Query Logic per Role

```
AGENT/ADMIN — Tickets:
  SLA breach: tickets WHERE assigneeId=userId AND status!=RESOLVED AND updatedAt < SLA_threshold → CRITICAL
  Unresponded: tickets WHERE assigneeId=userId AND status=TODO AND createdAt < now-1h → HIGH

ADMIN/MANAGER — Approvals & Renewals:
  Hardware: hardware_requests WHERE status=PENDING_APPROVAL → HIGH
  Eform: eform_requests WHERE currentApproverRole=role AND status=PENDING → HIGH
  D-7: renewal_contracts WHERE expiryDate BETWEEN now AND now+7d → HIGH
  D-1: renewal_contracts WHERE expiryDate BETWEEN now AND now+1d → CRITICAL
  Expired: renewal_contracts WHERE expiryDate < now → CRITICAL

USER — My Tickets:
  Waiting user: tickets WHERE userId=userId AND status=WAITING_USER → HIGH
  Resolved unconfirmed: tickets WHERE userId=userId AND status=RESOLVED → NORMAL
```

---

## Reminder Intensity Settings

Kolom baru di `notification_preferences`:
```
reminderIntensity: 'OFF' | 'GENTLE' | 'MODERATE' | 'ASSERTIVE'
default: 'MODERATE'
interval: none / 60m / 30m / 15m
```

UI di halaman Settings → Notifications:
- Chip selector: [Off] [Gentle — 1j] [Moderate — 30m] [Assertive — 15m]
- Reminder hanya aktif saat ada item Critical/High yang belum di-act

---

## Aesthetic

Industrial/Utilitarian (konsisten dengan iDesk existing):
- Font: JetBrains Mono (labels/meta) + DM Sans (body)
- Dark navy: `#060c14`, `#0d1a2b`, `#1e3a5f`
- Pulse dot animation (CSS keyframes) pada button saat ada Critical item
- Framer Motion spring untuk dropdown open/close
- Border: 1px solid `#1e3a5f`, tidak ada heavy glassmorphism

---

## Urutan Implementasi (Inkremental)

1. Backend: `getActionItems()` service method + endpoint
2. Backend: Tambah `reminderIntensity` kolom ke `notification_preferences`
3. Frontend: `useActionItems.ts` hook
4. Frontend: `ActionCommandCenter.tsx` komponen
5. Frontend: Integrasi ke `BentoTopbar`, `Topbar`, `ClientLayout`
6. Frontend: `useReminderEngine.ts`
7. Frontend: Update Settings UI (reminder intensity chips)

---

## Yang Tidak Berubah (No Breaking Change)

- `NotificationPopover` — tetap ada sebagai history
- `InAppNotificationToast` — tetap real-time toast
- `CriticalNotificationBanner` — tetap untuk SLA/renewal banners
- Socket events — tidak ada perubahan
- Email/Telegram/push channels — tidak ada perubahan
- `requiresAcknowledge` flow — tidak ada perubahan
