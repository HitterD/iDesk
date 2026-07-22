# User Notification Center Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pastikan USER membuka notification center client dari bell popover tanpa unauthorized dan tidak menerima link settings yang tidak punya route sah.

**Architecture:** Reuse `getNotificationCenterPath(role)` sebagai sumber route notification center. `NotificationPopover` memakai helper itu untuk link **View All**, lalu hanya menampilkan settings untuk role non-USER pada route `/settings`. Tidak ada perubahan backend, API, permission guard, atau dependency.

**Tech Stack:** React 19, React Router, TypeScript, Vitest 4

## Global Constraints

- Ubah sesedikit mungkin; pakai helper `getNotificationCenterPath` yang sudah ada.
- Jangan tambah dependency, route, endpoint, atau halaman settings client.
- `ProtectedRoute` dan backend `PageAccessGuard` tetap menjadi enforcement authorization.
- USER harus menuju `/client/notifications`; role non-USER harus tetap menuju `/notifications`.
- Link `Notification Settings` hanya boleh muncul untuk role non-USER dan harus menuju `/settings`.

---

## File Map

| File | Peran |
|---|---|
| `apps/frontend/src/components/notifications/utils/__tests__/notificationRouter.test.ts` | Memverifikasi kontrak route notification center per role. |
| `apps/frontend/src/components/notifications/NotificationPopover.tsx` | Menggunakan route per role pada **View All** dan menyembunyikan settings dari USER. |

---

### Task 1: Kunci Kontrak Route Notification Center

**Files:**
- Create: `apps/frontend/src/components/notifications/utils/__tests__/notificationRouter.test.ts`
- Modify: none

**Interfaces:**
- Consumes: `getNotificationCenterPath(role: UserRole): string` dari `apps/frontend/src/components/notifications/utils/notificationRouter.ts`.
- Produces: Test Vitest yang memastikan USER memakai route client dan role lain memakai route portal existing.

- [ ] **Step 1: Buat test gagal untuk route USER dan non-USER**

Buat `apps/frontend/src/components/notifications/utils/__tests__/notificationRouter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getNotificationCenterPath, type UserRole } from '../notificationRouter';

describe('getNotificationCenterPath', () => {
    it('routes USER to client notification center', () => {
        expect(getNotificationCenterPath('USER')).toBe('/client/notifications');
    });

    it.each<UserRole>(['ADMIN', 'AGENT', 'MANAGER'])(
        'routes %s to shared notification center',
        (role) => {
            expect(getNotificationCenterPath(role)).toBe('/notifications');
        },
    );
});
```

- [ ] **Step 2: Jalankan test untuk verifikasi baseline**

Run:

```bash
cd apps/frontend && npm test -- src/components/notifications/utils/__tests__/notificationRouter.test.ts
```

Expected: `PASS`. Helper sudah ada; test ini mengunci kontrak sebelum popover menggunakannya.

- [ ] **Step 3: Commit test kontrak**

```bash
git add apps/frontend/src/components/notifications/utils/__tests__/notificationRouter.test.ts
git commit -m "test(notifications): cover role notification center routes"
```

---

### Task 2: Hubungkan Popover ke Route Per Role

**Files:**
- Modify: `apps/frontend/src/components/notifications/NotificationPopover.tsx:13,86-92,142-151`
- Test: `apps/frontend/src/components/notifications/utils/__tests__/notificationRouter.test.ts`

**Interfaces:**
- Consumes: `getNotificationCenterPath(role: UserRole): string` yang telah diuji pada Task 1.
- Produces: `NotificationPopover` dengan **View All** role-aware dan settings khusus non-USER.

- [ ] **Step 1: Perbarui import router helper**

Ganti import pada `apps/frontend/src/components/notifications/NotificationPopover.tsx`:

```ts
import { getNotificationCenterPath, getNotificationRedirectPath, UserRole } from './utils/notificationRouter';
```

- [ ] **Step 2: Ganti route hardcode pada View All**

Ganti blok link pada `apps/frontend/src/components/notifications/NotificationPopover.tsx`:

```tsx
<Link
    to={getNotificationCenterPath(userRole)}
    onClick={() => setIsOpen(false)}
    className="text-xs font-bold text-primary hover:underline"
>
    View All
</Link>
```

- [ ] **Step 3: Sembunyikan settings dari USER dan perbaiki route non-USER**

Ganti footer popover pada `apps/frontend/src/components/notifications/NotificationPopover.tsx`:

```tsx
{userRole !== 'USER' && (
    <div className="p-3 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-center">
        <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="text-xs font-medium text-slate-500 hover:text-primary flex items-center justify-center gap-1.5"
        >
            <Settings className="w-3.5 h-3.5" />
            Notification Settings
        </Link>
    </div>
)}
```

- [ ] **Step 4: Jalankan test kontrak route**

Run:

```bash
cd apps/frontend && npm test -- src/components/notifications/utils/__tests__/notificationRouter.test.ts
```

Expected: `PASS` dengan 4 assertion route.

- [ ] **Step 5: Jalankan typecheck dan production build**

Run:

```bash
cd apps/frontend && npm run build
```

Expected: exit code `0`; TypeScript dan Vite build selesai tanpa error.

- [ ] **Step 6: Smoke test role USER dan non-USER**

1. Login sebagai USER.
2. Klik lonceng, lalu **View All**.
3. Pastikan URL `/client/notifications`, halaman `ClientNotificationCenter` tampil, dan tidak ada unauthorized.
4. Pastikan `Notification Settings` tidak tampil.
5. Login sebagai ADMIN atau AGENT.
6. Klik lonceng, lalu **View All**; pastikan URL `/notifications`.
7. Klik `Notification Settings`; pastikan URL `/settings`.

Expected: semua route masuk portal yang sesuai role; backend authorization tidak berubah.

- [ ] **Step 7: Commit perbaikan popover**

```bash
git add apps/frontend/src/components/notifications/NotificationPopover.tsx
git commit -m "fix(notifications): route client popover links by role"
```

---

## Self-Review

- **Spec coverage:** Task 1 mengunci route USER/non-USER. Task 2 memakai helper di **View All**, menyembunyikan settings USER, dan mengganti route non-USER menjadi `/settings`. Smoke test memeriksa seluruh hasil yang diminta.
- **Placeholder scan:** Tidak ada `TBD`, `TODO`, atau langkah tanpa path, kode, dan command yang diperlukan.
- **Type consistency:** `UserRole` dan `getNotificationCenterPath(role)` dipakai sesuai definisi `notificationRouter.ts`; tidak ada interface baru.
