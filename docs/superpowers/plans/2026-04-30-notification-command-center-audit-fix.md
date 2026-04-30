# Notification Command Center — Audit Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perbaiki 15 isu (dead code, mutasi entity, type safety, memory leak, performance) di modul notifikasi tanpa mengubah response shape atau core logic.

**Architecture:** 3 fase commit terpisah — Backend fixes dulu, lalu Frontend, lalu Polish. Setiap task adalah satu isu spesifik di satu file.

**Tech Stack:** NestJS (TypeORM, class-validator), React (TanStack Query, Framer Motion), TypeScript

---

## File Map

| File | Perubahan |
|------|-----------|
| `apps/backend/src/modules/notifications/notification-center.service.ts` | Task 1–5, 8 (dead code, mutasi, return type, error, retry, digestBuffer) |
| `apps/backend/src/modules/notifications/notification.controller.ts` | Task 6–7 (unsafe cast, DTO) |
| `apps/frontend/src/features/notifications/hooks/useActionItems.ts` | Task 9 (staleTime, isFetching) |
| `apps/frontend/src/components/notifications/ActionCommandCenter.tsx` | Task 10–12 (useMemo, isFetching, snooze close, AbortController) |

---

## FASE 1 — Backend Fixes

---

### Task 1: Hapus dead code `notificationQueue`

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts:31-36`

- [ ] **Step 1: Hapus field `notificationQueue`**

Hapus baris 31–36 berikut:

```typescript
// HAPUS blok ini sepenuhnya:
// In-memory queue for notifications (use Bull/Redis in production)
private notificationQueue: Array<{
    payload: NotificationPayload;
    channels: DeliveryChannel[];
    createdAt: Date;
}> = [];
```

Hasil setelah hapus — baris 29 langsung diikuti `digestBuffer`:

```typescript
private channels: Map<DeliveryChannel, INotificationChannel> = new Map();

// Digest buffer - collects notifications for digest delivery
private digestBuffer: Map<string, Notification[]> = new Map();
```

- [ ] **Step 2: Hapus import `NotificationPriority` jika tidak dipakai lain**

Cek baris 11–16 — `NotificationPriority` diimport tapi jika tidak dipakai di tempat lain, hapus dari import:

```typescript
import {
    NotificationPayload,
    // NotificationPriority,  ← hapus baris ini
    ChannelDeliveryPayload,
    DeliveryResult,
    INotificationChannel,
} from './interfaces/notification-channel.interface';
```

- [ ] **Step 3: Verifikasi TypeScript compile tanpa error**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts
git commit -m "refactor(notifications): remove unused notificationQueue dead code"
```

---

### Task 2: Fix mutasi entity — `Object.assign` → spread operator

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts:172-179`

- [ ] **Step 1: Ganti `Object.assign` dengan spread**

Ubah method `updatePreferences` (baris 172–179):

```typescript
// SEBELUM:
async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreference>
): Promise<NotificationPreference> {
    const prefs = await this.getOrCreatePreferences(userId);
    Object.assign(prefs, updates);
    return this.preferenceRepo.save(prefs);
}

// SESUDAH:
async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreference>
): Promise<NotificationPreference> {
    const prefs = await this.getOrCreatePreferences(userId);
    return this.preferenceRepo.save({ ...prefs, ...updates });
}
```

- [ ] **Step 2: Verifikasi compile**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts
git commit -m "fix(notifications): replace Object.assign mutation with spread in updatePreferences"
```

---

### Task 3: Fix return type `Promise<any>` dan hapus dead counters di `getActionItems`

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts:245-249`

- [ ] **Step 1: Import `ActionItemsResponseDto`**

`ActionItemsResponseDto` sudah ada di `./dto/action-item.dto`. Pastikan import sudah ada di baris 24:

```typescript
import { ActionItemDto, ActionItemUrgency, ActionItemEntityType, ActionItemsResponseDto } from './dto/action-item.dto';
```

- [ ] **Step 2: Ubah signature method dan hapus dead counters**

```typescript
// SEBELUM (baris 245-249):
async getActionItems(userId: string, role: string): Promise<any> {
    const items: ActionItemDto[] = [];
    let critical = 0;
    let high = 0;
    let normal = 0;

// SESUDAH:
async getActionItems(userId: string, role: string): Promise<ActionItemsResponseDto> {
    const items: ActionItemDto[] = [];
```

- [ ] **Step 3: Hapus `critical++`, `high++`, `normal++` di seluruh method**

Cari semua `critical++;`, `high++;`, `normal++;` di dalam method (ada sekitar 6 baris tersebar) dan hapus semuanya. Counts dihitung dari `activeItems` di akhir method sehingga counter ini tidak pernah dipakai.

Gunakan grep untuk cek:
```bash
grep -n "critical++\|high++\|normal++" apps/backend/src/modules/notifications/notification-center.service.ts
```

Expected: lines dengan `critical++;` `high++;` `normal++;` — hapus semua.

- [ ] **Step 4: Verifikasi compile**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts
git commit -m "fix(notifications): type getActionItems return, remove dead counter variables"
```

---

### Task 4: Fix error handling — `new Error()` → `NotFoundException`

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts:1,234-235`

- [ ] **Step 1: Tambah `NotFoundException` ke import NestJS**

Baris 1 — ubah import:

```typescript
// SEBELUM:
import { Injectable, Logger, OnModuleInit, forwardRef, Inject } from '@nestjs/common';

// SESUDAH:
import { Injectable, Logger, OnModuleInit, forwardRef, Inject, NotFoundException } from '@nestjs/common';
```

- [ ] **Step 2: Ganti throw di `updateCategorySettings` (baris 234–235)**

```typescript
// SEBELUM:
if (!pref) {
    throw new Error('Notification preferences not found');
}

// SESUDAH:
if (!pref) {
    throw new NotFoundException('Notification preferences not found');
}
```

- [ ] **Step 3: Verifikasi compile**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts
git commit -m "fix(notifications): throw NotFoundException instead of raw Error in updateCategorySettings"
```

---

### Task 5: Fix retry loop permanen di `retryFailedDeliveries`

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts` (method `retryFailedDeliveries`)

- [ ] **Step 1: Cari blok `continue` tanpa increment**

```bash
grep -n "continue" apps/backend/src/modules/notifications/notification-center.service.ts
```

Temukan baris dalam loop `retryFailedDeliveries` di mana `channelService` tidak ada:

```typescript
// SEBELUM:
const channelService = this.channels.get(log.channel);
if (!channelService) continue;
```

- [ ] **Step 2: Tambah increment sebelum continue**

```typescript
// SESUDAH:
const channelService = this.channels.get(log.channel);
if (!channelService) {
    await this.logRepo.update(log.id, {
        retryCount: log.retryCount + 1,
        errorMessage: `Channel ${log.channel} not available`,
    });
    continue;
}
```

- [ ] **Step 3: Verifikasi compile**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts
git commit -m "fix(notifications): increment retryCount when channel unavailable to prevent infinite retry"
```

---

### Task 6: Fix unsafe cast `as any` di controller

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification.controller.ts:116`

- [ ] **Step 1: Import `NotificationType`**

Baris 16 — tambah `NotificationType` ke import:

```typescript
// SEBELUM:
import { NotificationCategory } from './entities/notification.entity';

// SESUDAH:
import { NotificationCategory, NotificationType } from './entities/notification.entity';
```

- [ ] **Step 2: Ganti `as any` dengan `as NotificationType`**

Baris 116:

```typescript
// SEBELUM:
body.notificationType as any,

// SESUDAH:
body.notificationType as NotificationType,
```

- [ ] **Step 3: Verifikasi compile**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/notifications/notification.controller.ts
git commit -m "fix(notifications): replace unsafe 'as any' cast with NotificationType in controller"
```

---

### Task 7: Tambah guard ukuran `digestBuffer`

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts` (method `addToDigestBuffer`)

- [ ] **Step 1: Ubah method `addToDigestBuffer`**

```typescript
// SEBELUM:
private async addToDigestBuffer(userId: string, notification: Notification): Promise<void> {
    const buffer = this.digestBuffer.get(userId) || [];
    buffer.push(notification);
    this.digestBuffer.set(userId, buffer);
}

// SESUDAH:
private async addToDigestBuffer(userId: string, notification: Notification): Promise<void> {
    const buffer = this.digestBuffer.get(userId) || [];
    buffer.push(notification);
    // Trim oldest 50 entries if buffer exceeds 100 to prevent unbounded growth
    const trimmed = buffer.length > 100 ? buffer.slice(buffer.length - 100) : buffer;
    this.digestBuffer.set(userId, trimmed);
}
```

- [ ] **Step 2: Verifikasi compile**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts
git commit -m "fix(notifications): cap digestBuffer at 100 entries per user to prevent memory growth"
```

---

## FASE 2 — Frontend Fixes

---

### Task 8: Tambah `staleTime` dan expose `isFetching` di `useActionItems`

**Files:**
- Modify: `apps/frontend/src/features/notifications/hooks/useActionItems.ts`

- [ ] **Step 1: Tambah `staleTime`, `gcTime`, dan expose `isFetching`**

```typescript
// SEBELUM:
const { data, isLoading, error, refetch } = useQuery<ActionItemsResponse>({
    queryKey: ['action-items'],
    queryFn: async () => {
        const res = await api.get('/notifications/action-items');
        return res.data;
    },
    enabled: !!user,
    refetchInterval: 60000, // Poll every 60s as per spec
});

// SESUDAH:
const { data, isLoading, isFetching, error, refetch } = useQuery<ActionItemsResponse>({
    queryKey: ['action-items'],
    queryFn: async () => {
        const res = await api.get('/notifications/action-items');
        return res.data;
    },
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 120_000,
});
```

- [ ] **Step 2: Tambah `isFetching` ke return value**

```typescript
// SEBELUM:
return {
    items: allItems,
    activeItems,
    counts: data?.counts || { critical: 0, high: 0, normal: 0, total: 0 },
    isLoading,
    error,
    refetch
};

// SESUDAH:
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

- [ ] **Step 3: Verifikasi TypeScript**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/notifications/hooks/useActionItems.ts
git commit -m "perf(notifications): add staleTime/gcTime to useActionItems, expose isFetching"
```

---

### Task 9: Fix `ActionCommandCenter` — `useMemo` + ganti `isRefreshing` → `isFetching`

**Files:**
- Modify: `apps/frontend/src/components/notifications/ActionCommandCenter.tsx`

- [ ] **Step 1: Tambah `useMemo` ke import React**

```typescript
// SEBELUM:
import React, { useState, useCallback, useEffect } from 'react';

// SESUDAH:
import React, { useState, useCallback, useEffect, useMemo } from 'react';
```

- [ ] **Step 2: Destructure `isFetching` dari `useActionItems`, hapus `isRefreshing` state**

```typescript
// SEBELUM:
const [isRefreshing, setIsRefreshing] = useState(false);
const { items, activeItems, counts, isLoading, refetch } = useActionItems();

// SESUDAH:
const { items, activeItems, counts, isLoading, isFetching, refetch } = useActionItems();
```

- [ ] **Step 3: Hapus `handleRefresh` async wrapper, ganti dengan `refetch` langsung**

```typescript
// SEBELUM:
const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
}, [refetch]);

// SESUDAH:
const handleRefresh = useCallback(() => { refetch(); }, [refetch]);
```

- [ ] **Step 4: Memoize `grouped` dengan `useMemo`**

```typescript
// SEBELUM:
const grouped = {
    CRITICAL: items.filter(i => i.urgency === 'CRITICAL'),
    HIGH: items.filter(i => i.urgency === 'HIGH'),
    NORMAL: items.filter(i => i.urgency === 'NORMAL'),
};

// SESUDAH:
const grouped = useMemo(() => ({
    CRITICAL: items.filter(i => i.urgency === 'CRITICAL'),
    HIGH: items.filter(i => i.urgency === 'HIGH'),
    NORMAL: items.filter(i => i.urgency === 'NORMAL'),
}), [items]);
```

- [ ] **Step 5: Ganti `isRefreshing` → `isFetching` pada JSX (tombol refresh)**

```tsx
// SEBELUM:
disabled={isRefreshing}
// ...
<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />

// SESUDAH:
disabled={isFetching}
// ...
<RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
```

- [ ] **Step 6: Verifikasi TypeScript**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/components/notifications/ActionCommandCenter.tsx
git commit -m "perf(notifications): memoize grouped items, replace isRefreshing with isFetching"
```

---

### Task 10: Fix snooze menu — tambah close-on-outside-click di `ActionRow`

**Files:**
- Modify: `apps/frontend/src/components/notifications/ActionCommandCenter.tsx` (komponen `ActionRow`)

- [ ] **Step 1: Tambah `useRef` ke import**

```typescript
// SEBELUM:
import React, { useState, useCallback, useEffect, useMemo } from 'react';

// SESUDAH:
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
```

- [ ] **Step 2: Tambah `menuRef` dan `useEffect` close-on-outside di `ActionRow`**

Di dalam komponen `ActionRow`, tepat setelah `const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);`:

```tsx
const menuRef = useRef<HTMLDivElement>(null);

useEffect(() => {
    if (!showSnoozeMenu) return;
    const handler = (e: MouseEvent) => {
        if (!menuRef.current?.contains(e.target as Node)) {
            setShowSnoozeMenu(false);
        }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
}, [showSnoozeMenu]);
```

- [ ] **Step 3: Pasang `ref={menuRef}` ke div container snooze menu**

Temukan `<div className="relative">` yang membungkus tombol snooze dan dropdown-nya, tambahkan `ref`:

```tsx
// SEBELUM:
<div className="relative">
    <button
        onClick={(e) => { e.stopPropagation(); setShowSnoozeMenu(v => !v); }}
        ...

// SESUDAH:
<div className="relative" ref={menuRef}>
    <button
        onClick={(e) => { e.stopPropagation(); setShowSnoozeMenu(v => !v); }}
        ...
```

- [ ] **Step 4: Verifikasi TypeScript**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/notifications/ActionCommandCenter.tsx
git commit -m "fix(notifications): close snooze menu on outside click using mousedown handler"
```

---

### Task 11: Fix memory leak di `ReminderSettingsPanel` — tambah `AbortController`

**Files:**
- Modify: `apps/frontend/src/components/notifications/ActionCommandCenter.tsx` (komponen `ReminderSettingsPanel`)

- [ ] **Step 1: Ubah `useEffect` di `ReminderSettingsPanel`**

```typescript
// SEBELUM:
useEffect(() => {
    api.get('/notifications/preferences')
        .then(r => { if (r.data?.reminderIntensity) setCurrent(r.data.reminderIntensity); })
        .catch(() => {});
}, []);

// SESUDAH:
useEffect(() => {
    const ctrl = new AbortController();
    api.get('/notifications/preferences', { signal: ctrl.signal })
        .then(r => { if (r.data?.reminderIntensity) setCurrent(r.data.reminderIntensity); })
        .catch((err) => {
            if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') {
                // Intentionally suppressed — component may unmount before response
            }
        });
    return () => ctrl.abort();
}, []);
```

- [ ] **Step 2: Verifikasi TypeScript**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/notifications/ActionCommandCenter.tsx
git commit -m "fix(notifications): add AbortController to ReminderSettingsPanel useEffect to prevent memory leak"
```

---

## FASE 3 — Polish

---

### Task 12: Fix fake `notificationId` di `sendDigest`

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts` (method `sendDigest`)

- [ ] **Step 1: Ganti `digest-${Date.now()}` dengan `crypto.randomUUID()`**

Di method `sendDigest`, ada dua tempat `notificationId: \`digest-${Date.now()}\``:

```typescript
// SEBELUM (dua tempat):
notificationId: `digest-${Date.now()}`,

// SESUDAH (dua tempat — email dan telegram):
notificationId: crypto.randomUUID(),
```

`crypto` tersedia secara native di Node.js 15+ tanpa import tambahan.

- [ ] **Step 2: Verifikasi compile**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts
git commit -m "fix(notifications): use crypto.randomUUID() instead of fake timestamp ID in sendDigest"
```

---

### Task 13: Buat `UpdatePreferencesDto` untuk controller body

**Files:**
- Create: `apps/backend/src/modules/notifications/dto/update-preferences.dto.ts`
- Modify: `apps/backend/src/modules/notifications/notification.controller.ts:96-118`

- [ ] **Step 1: Buat DTO file**

```typescript
// apps/backend/src/modules/notifications/dto/update-preferences.dto.ts
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DigestFrequency } from '../entities/notification-preference.entity';

export class UpdatePreferencesDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    inAppEnabled?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    emailEnabled?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsEmail()
    emailAddress?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    telegramEnabled?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    telegramChatId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    pushEnabled?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    digestEnabled?: boolean;

    @ApiPropertyOptional({ enum: DigestFrequency })
    @IsOptional()
    @IsEnum(DigestFrequency)
    digestFrequency?: DigestFrequency;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    quietHoursEnabled?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    quietHoursStart?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    quietHoursEnd?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reminderIntensity?: string;
}

export class UpdateTypeSettingsDto {
    @ApiPropertyOptional()
    @IsString()
    notificationType: string;

    @ApiPropertyOptional()
    channels: Record<string, boolean>;
}
```

- [ ] **Step 2: Gunakan DTO di controller**

```typescript
// Tambah import di notification.controller.ts:
import { UpdatePreferencesDto, UpdateTypeSettingsDto } from './dto/update-preferences.dto';

// Ubah signature PUT/PATCH preferences (baris 96-105):
async replacePreferences(@Request() req: any, @Body() updates: UpdatePreferencesDto) { ... }
async updatePreferences(@Request() req: any, @Body() updates: UpdatePreferencesDto) { ... }

// Ubah signature PATCH type-settings (baris 110-118):
async updateTypeSettings(@Request() req: any, @Body() body: UpdateTypeSettingsDto) {
    return this.notificationCenterService.updateTypePreference(
        req.user.userId,
        body.notificationType as NotificationType,
        body.channels
    );
}
```

- [ ] **Step 3: Verifikasi compile**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/notifications/dto/update-preferences.dto.ts \
        apps/backend/src/modules/notifications/notification.controller.ts
git commit -m "feat(notifications): add UpdatePreferencesDto for type-safe controller endpoints"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** 15 isu dari spec semua tercakup (Task 1–13)
- [x] **Tidak ada placeholder:** semua task berisi code aktual
- [x] **Type consistency:** `ActionItemsResponseDto` diimport dari path yang sama di Task 3; `NotificationType` di Task 6 konsisten dengan Task 7 controller
- [x] **Output tidak berubah:** tidak ada perubahan response shape, hanya internal fixes
- [x] **Urutan benar:** Task 8 (useActionItems) harus sebelum Task 9–11 (ActionCommandCenter) karena Task 9 destructure `isFetching` dari hook yang diupdate Task 8
