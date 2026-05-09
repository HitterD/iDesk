# Hardware Request — Awaiting Confirmation UX Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix misleading MiniPipeline visual + tambah action-required banner untuk requester di list/card view saat status `AWAITING_USER_CONFIRMATION`.

**Architecture:** Frontend-only. Dua file dimodifikasi. Tidak ada API/backend change. `userId` dari `useHardwareRole()` dibandingkan dengan `r.requesterId` untuk guard banner.

**Tech Stack:** React, TypeScript, Tailwind CSS, Framer Motion, lucide-react

---

## File Map

| File | Change |
|------|--------|
| `apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx` | Fix MiniPipeline + tambah banner |
| `apps/frontend/src/features/hardware-request/components/list/RequestRowDrawer.tsx` | Tambah alert strip |

---

## Task 1: Fix MiniPipeline di RequestCard

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx`

### Context

`MiniPipeline` di `RequestCard.tsx` (baris 9–37) menggunakan logic:
```ts
const done = !terminalBad && i <= idx;
```

Ini menyebabkan bar `AWAITING_USER_CONFIRMATION` (index 6 dari 8) terisi solid — misleading seolah step sudah selesai. Harus ditampilkan sebagai "pending action" (pulsing/animated).

### Steps

- [ ] **Step 1: Baca file aktual**

Buka dan baca:
```
apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx
```

- [ ] **Step 2: Ganti MiniPipeline dengan three-state logic**

Replace seluruh fungsi `MiniPipeline` (baris 9–37) dengan:

```tsx
function MiniPipeline({ current }: { current: RequestStatus }) {
    const terminalBad = current === 'REJECTED' || current === 'CANCELLED';
    const idx = REQUEST_PIPELINE.indexOf(current);
    const isAwaitingConfirm = current === 'AWAITING_USER_CONFIRMATION';

    return (
        <div className="flex flex-col gap-1.5 mt-4">
            <div className="flex items-center gap-1 w-full">
                {REQUEST_PIPELINE.map((step, i) => {
                    const done = !terminalBad && i < idx;
                    const pending = !terminalBad && i === idx && isAwaitingConfirm;
                    const active = !terminalBad && i === idx && !isAwaitingConfirm;
                    const meta = STATUS_META[step];

                    if (pending) {
                        return (
                            <div
                                key={step}
                                className="h-[3px] flex-1 rounded-full animate-pulse"
                                style={{ backgroundColor: meta.hex, opacity: 0.7 }}
                            />
                        );
                    }
                    return (
                        <div
                            key={step}
                            className={`h-[3px] flex-1 rounded-full ${done || active ? '' : 'bg-slate-100 dark:bg-slate-800'}`}
                            style={{
                                backgroundColor: (done || active) ? meta.hex : undefined,
                            }}
                        />
                    );
                })}
            </div>
            <div className="flex justify-end">
                <span className="text-[10px] font-bold" style={{ color: STATUS_META[current]?.hex || '#64748b' }}>
                    {STATUS_META[current]?.label || current}
                </span>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Verifikasi tidak ada TypeScript error**

```bash
cd apps/frontend && npx tsc --noEmit --project tsconfig.app.json 2>&1 | head -30
```

Expected: no errors terkait `RequestCard.tsx`

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx
git commit -m "fix(hardware-request): MiniPipeline show AWAITING_USER_CONFIRMATION as pending not done"
```

---

## Task 2: Tambah Action-Required Banner di RequestCard

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx`

### Context

Ketika `r.status === 'AWAITING_USER_CONFIRMATION'` dan user yang login adalah requester (`r.requesterId === userId`), tampilkan banner "Konfirmasi diperlukan" di dalam card, di atas `MiniPipeline`. Requester harus tahu ada aksi yang perlu dilakukan.

`userId` didapat dari `useHardwareRole()` yang sudah tersedia di `hooks/usePermissions.ts`.

### Steps

- [ ] **Step 1: Baca file aktual**

Buka dan baca:
```
apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx
```

- [ ] **Step 2: Tambah import `useHardwareRole` dan `AlertCircle`**

Di bagian import, tambahkan:

```tsx
import { useHardwareRole } from '../../hooks/usePermissions';
```

Dan di import lucide-react yang sudah ada, tambahkan `AlertCircle`:
```tsx
// sebelumnya mungkin tidak ada lucide import — tambahkan:
import { AlertCircle } from 'lucide-react';
```

- [ ] **Step 3: Tambah `userId` di dalam `RequestCard` function**

Di dalam function `RequestCard({ r })`, tepat setelah baris `const [hovered, setHovered] = useState(false);`, tambahkan:

```tsx
const { userId } = useHardwareRole();
const needsConfirmation = r.status === 'AWAITING_USER_CONFIRMATION' && r.requesterId === userId;
```

- [ ] **Step 4: Tambah banner di atas MiniPipeline**

Di dalam JSX `RequestCard`, tepat sebelum `<MiniPipeline current={r.status} />`, tambahkan:

```tsx
{needsConfirmation && (
    <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
        <AlertCircle className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
        <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
            Konfirmasi instalasi diperlukan
        </span>
    </div>
)}
```

- [ ] **Step 5: Verifikasi tidak ada TypeScript error**

```bash
cd apps/frontend && npx tsc --noEmit --project tsconfig.app.json 2>&1 | head -30
```

Expected: no errors terkait `RequestCard.tsx`

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx
git commit -m "feat(hardware-request): add action-required banner in RequestCard for requester"
```

---

## Task 3: Tambah Alert Strip di RequestRowDrawer

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/list/RequestRowDrawer.tsx`

### Context

`RequestRowDrawer` adalah inline drawer di tabel (desktop view) yang muncul saat row diklik. Sama seperti RequestCard, perlu alert strip ketika `r.status === 'AWAITING_USER_CONFIRMATION'` dan user adalah requester.

Strip ditempatkan setelah top accent bar dan sebelum StatusPipeline strip (setelah baris 54, sebelum baris 56).

### Steps

- [ ] **Step 1: Baca file aktual**

Buka dan baca:
```
apps/frontend/src/features/hardware-request/components/list/RequestRowDrawer.tsx
```

- [ ] **Step 2: Tambah import `useHardwareRole` dan `AlertCircle`**

Di bagian import existing, tambahkan:

```tsx
import { useHardwareRole } from '../../hooks/usePermissions';
```

Di import lucide-react yang sudah ada (`ExternalLink, Info, MessageSquare, Activity, User, MapPin, Calendar, Layers, ChevronRight`), tambahkan `AlertCircle`:

```tsx
import {
    ExternalLink, Info, MessageSquare, Activity,
    User, MapPin, Calendar, Layers, ChevronRight, AlertCircle,
} from 'lucide-react';
```

- [ ] **Step 3: Tambah `userId` dan `needsConfirmation` di `RequestRowDrawer` function**

Di dalam function `RequestRowDrawer({ r, colSpan })`, tepat setelah baris:
```ts
const meta = getStatusMeta(r.status);
```

Tambahkan:
```tsx
const { userId } = useHardwareRole();
const needsConfirmation = r.status === 'AWAITING_USER_CONFIRMATION' && r.requesterId === userId;
```

- [ ] **Step 4: Tambah alert strip setelah top accent bar**

Di dalam JSX, tepat setelah:
```tsx
{/* Top accent bar */}
<div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${meta.hex}, ${meta.hex}40)` }} />
```

Tambahkan:
```tsx
{needsConfirmation && (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 border-b border-cyan-200 dark:border-cyan-800">
        <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                Konfirmasi instalasi diperlukan
            </span>
        </div>
        <Link
            to={`${basePath}/${r.id}`}
            className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 hover:underline underline-offset-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
        >
            Buka detail →
        </Link>
    </div>
)}
```

- [ ] **Step 5: Verifikasi tidak ada TypeScript error**

```bash
cd apps/frontend && npx tsc --noEmit --project tsconfig.app.json 2>&1 | head -30
```

Expected: no errors terkait `RequestRowDrawer.tsx`

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/list/RequestRowDrawer.tsx
git commit -m "feat(hardware-request): add confirmation alert strip in RequestRowDrawer"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** MiniPipeline fix ✓ | Banner di card ✓ | Strip di drawer ✓
- [x] **Placeholders:** Tidak ada TBD/TODO — semua step ada code lengkap
- [x] **Type consistency:** `userId` string, `needsConfirmation` boolean, konsisten di kedua task
- [x] **Guard condition:** `r.requesterId === userId` konsisten di Task 2 dan Task 3
- [x] **No backend changes:** Hanya frontend reads dari data yang sudah ada di list query
