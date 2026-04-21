# Hardware Request — Plan 6: Frontend Core (List · Create Wizard · Detail)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Membangun fondasi frontend `features/hardware-request/` — API client, React Query hooks, real-time socket hook, utilitas, dan 3 halaman inti (List, Create Wizard 3 langkah, Detail dengan pipeline animasi + comment thread real-time + action panel kontekstual).

**Architecture:** Vertical slice feature folder. Tiap layer tipis: API (axios), hooks (React Query + socket subscription), komponen kecil <200 baris, page = orchestrator. Realtime: satu hook `useHardwareRequestRealtime(id)` subscribe ke `request:${id}` → invalidate queries terkait.

**Design language (dari spec §9):** Konsisten dengan zoom-booking redesign. Card radius `rounded-2xl`, shadow `shadow-sm`/`shadow-lg` untuk modal. Typography: heading `font-semibold text-2xl tracking-tight`, body `text-sm`. Palet status sudah di token. Animasi: pipeline step 0.3s ease, comment slide-in (`motion.div` y:8 opacity:0 → 0/1), modal fade+scale (0.98→1 90ms), toast slide-up. Skeleton tiap async section. Mobile-first sm/md/lg.

**Tech Stack:** React 18, TypeScript, React Router v6, @tanstack/react-query v5, axios, react-hook-form + zod, framer-motion, TailwindCSS, socket.io-client, sonner (toast), lucide-react icons. (Semua sudah dipakai di repo — **verify di Task 6.0**.)

**Spec reference:** §3 Frontend tree, §9A/B/C, §10 Data Flow.

**Prerequisites:** Plan 1-5 deployed di staging; endpoint list/detail/comments/activity/submit/cancel bekerja.

---

## Files in this plan

**Create:**
- `apps/frontend/src/features/hardware-request/types/index.ts`
- `apps/frontend/src/features/hardware-request/api/http.ts`
- `apps/frontend/src/features/hardware-request/api/hardware-request.api.ts`
- `apps/frontend/src/features/hardware-request/api/catalog.api.ts`
- `apps/frontend/src/features/hardware-request/api/comments.api.ts`
- `apps/frontend/src/features/hardware-request/api/activity.api.ts`
- `apps/frontend/src/features/hardware-request/utils/status.util.ts`
- `apps/frontend/src/features/hardware-request/utils/aging.util.ts`
- `apps/frontend/src/features/hardware-request/utils/permission.util.ts`
- `apps/frontend/src/features/hardware-request/utils/format.util.ts`
- `apps/frontend/src/features/hardware-request/hooks/usePermissions.ts`
- `apps/frontend/src/features/hardware-request/hooks/useHardwareRequestList.ts`
- `apps/frontend/src/features/hardware-request/hooks/useHardwareRequest.ts`
- `apps/frontend/src/features/hardware-request/hooks/useCatalog.ts`
- `apps/frontend/src/features/hardware-request/hooks/useComments.ts`
- `apps/frontend/src/features/hardware-request/hooks/useActivity.ts`
- `apps/frontend/src/features/hardware-request/hooks/useHardwareRequestRealtime.ts`
- `apps/frontend/src/features/hardware-request/hooks/useHardwareMutations.ts`
- `apps/frontend/src/features/hardware-request/components/common/StatusBadge.tsx`
- `apps/frontend/src/features/hardware-request/components/common/StatusPipeline.tsx`
- `apps/frontend/src/features/hardware-request/components/common/AgingBadge.tsx`
- `apps/frontend/src/features/hardware-request/components/common/EmptyState.tsx`
- `apps/frontend/src/features/hardware-request/components/common/SectionCard.tsx`
- `apps/frontend/src/features/hardware-request/components/list/RequestFilters.tsx`
- `apps/frontend/src/features/hardware-request/components/list/RequestTable.tsx`
- `apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx`
- `apps/frontend/src/features/hardware-request/components/list/RequestListSkeleton.tsx`
- `apps/frontend/src/features/hardware-request/components/create/CreateWizard.tsx`
- `apps/frontend/src/features/hardware-request/components/create/InfoStep.tsx`
- `apps/frontend/src/features/hardware-request/components/create/ItemsStep.tsx`
- `apps/frontend/src/features/hardware-request/components/create/CatalogPicker.tsx`
- `apps/frontend/src/features/hardware-request/components/create/ItemBasket.tsx`
- `apps/frontend/src/features/hardware-request/components/create/ReviewStep.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/RequestInfoCard.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/ItemsCard.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/CommentThread.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/CommentComposer.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/ActivityTimeline.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx`
- `apps/frontend/src/features/hardware-request/components/detail/RejectDialog.tsx`
- `apps/frontend/src/features/hardware-request/components/procurement/ProcurementPanel.tsx`
- `apps/frontend/src/features/hardware-request/components/procurement/InvoiceForm.tsx`
- `apps/frontend/src/features/hardware-request/pages/HardwareRequestListPage.tsx`
- `apps/frontend/src/features/hardware-request/pages/HardwareRequestCreatePage.tsx`
- `apps/frontend/src/features/hardware-request/pages/HardwareRequestDetailPage.tsx`
- `apps/frontend/src/features/hardware-request/routes.tsx`
- `apps/frontend/src/features/hardware-request/__tests__/...` (per component)

**Modify:**
- `apps/frontend/src/app/router.tsx` (register routes)
- `apps/frontend/src/app/sidebar.tsx` (nav entry)

---

## Task 6.0: Dependency audit

- [ ] **Step 1: Verify existing packages**

```bash
cd apps/frontend
pnpm list @tanstack/react-query framer-motion socket.io-client react-hook-form zod sonner lucide-react
```

- [ ] **Step 2: Tambah yang belum ada**

```bash
pnpm add @tanstack/react-query framer-motion socket.io-client react-hook-form zod @hookform/resolvers sonner lucide-react date-fns
```

- [ ] **Step 3: Commit (lockfile)**

```bash
git add pnpm-lock.yaml apps/frontend/package.json
git commit -m "chore(frontend): add hardware-request feature deps"
```

---

## Task 6.1: Types

**Files:** Create `types/index.ts`

- [ ] **Step 1: Types**

```typescript
export type RequestStatus =
    | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED'
    | 'PROCUREMENT' | 'INSTALLATION' | 'COMPLETED'
    | 'REJECTED' | 'CANCELLED';

export const REQUEST_PIPELINE: RequestStatus[] = [
    'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCUREMENT', 'INSTALLATION', 'COMPLETED',
];

export type InstallStatus =
    | 'PROPOSED' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'RESCHEDULED' | 'CANCELLED';

export type HardwareRole = 'USER' | 'ICT_LEAD' | 'ICT_PROCUREMENT' | 'ICT_TECHNICIAN';
export type ItemCategory = 'LAPTOP' | 'MONITOR' | 'ACCESSORY' | 'NETWORK' | 'SOFTWARE' | 'OTHER';

export interface UserLite { id: string; fullName: string; email?: string; avatarUrl?: string | null; role?: HardwareRole; }
export interface SiteLite { id: string; name: string; }

export interface HardwareCatalog {
    id: string; code: string; name: string;
    category: ItemCategory;
    defaultSpecs?: Record<string, unknown>;
    requiredFields?: Record<string, { type: 'string'|'number'|'select'; label: string; options?: string[]; required?: boolean }>;
    active: boolean; displayOrder: number;
}

export interface HardwareRequestItem {
    id: string;
    catalogId?: string | null;
    categorySnapshot: { code: string; name: string; category: ItemCategory; [k: string]: unknown };
    quantity: number;
    actualCost?: number | null;
    vendor?: string | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    notes?: string | null;
    specs?: Record<string, unknown>;
}

export interface InstallationSchedule {
    id: string; requestId: string; technicianId: string; technician?: UserLite;
    scheduledStart: string; scheduledEnd: string;
    status: InstallStatus;
    proposedBy: string; confirmedBy: string | null;
    locationDetail: string | null; rescheduleReason: string | null;
    startedAt: string | null; completedAt: string | null;
}

export interface HardwareAsset {
    id: string; itemId: string; barcode: string;
    assignedToUserId: string; siteId: string;
    installedAt: string; installedBy: string;
}

export interface HardwareRequest {
    id: string; requestNumber: string;
    requesterId: string; requester?: UserLite;
    recipientId?: string | null; recipient?: UserLite | null;
    siteId: string; site?: SiteLite;
    justification: string;
    status: RequestStatus;
    submittedAt?: string | null; reviewedAt?: string | null; approvedAt?: string | null;
    procuredAt?: string | null; installedAt?: string | null; completedAt?: string | null;
    reviewedBy?: string | null; approvedBy?: string | null; procuredBy?: string | null;
    rejectReason?: string | null;
    version: number;
    items: HardwareRequestItem[];
    installationSchedule?: InstallationSchedule | null;
    assets?: HardwareAsset[];
    createdAt: string; updatedAt: string;
}

export interface HardwareRequestActivity {
    id: string; requestId: string; actorId: string; actor?: UserLite;
    action: string; fromStatus?: RequestStatus | null; toStatus?: RequestStatus | null;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

export interface HardwareRequestComment {
    id: string; requestId: string; authorId: string; author?: UserLite;
    body: string;
    attachments: Array<{ url: string; name: string; size: number; mimeType: string }>;
    createdAt: string; editedAt: string | null; deletedAt: string | null;
}

export interface ListFilters {
    status?: RequestStatus[]; category?: ItemCategory[];
    siteId?: string; requesterId?: string;
    scope?: 'my' | 'all'; search?: string;
    page?: number; pageSize?: number;
}

export interface ApiEnvelope<T> { success: boolean; data?: T; error?: string; meta?: { total: number; page: number; pageSize: number } }
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/types/index.ts
git commit -m "feat(frontend/hardware-request): shared types"
```

---

## Task 6.2: Axios client

**Files:** Create `api/http.ts`

- [ ] **Step 1:**

```typescript
import axios from 'axios';

export const hrHttp = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL}/hardware-requests`,
    withCredentials: true,
});

hrHttp.interceptors.response.use(
    (r) => r,
    (err) => {
        const code = err?.response?.data?.error;
        const msg = err?.response?.data?.message ?? code ?? err.message;
        const enriched = new Error(msg);
        (enriched as any).code = code;
        (enriched as any).status = err?.response?.status;
        (enriched as any).response = err?.response;
        return Promise.reject(enriched);
    },
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/api/http.ts
git commit -m "feat(frontend/hardware-request): axios client"
```

---

## Task 6.3: API modules

**Files:** Create 4 API files.

- [ ] **Step 1: `hardware-request.api.ts`**

```typescript
import { hrHttp } from './http';
import type {
    HardwareRequest, ListFilters, ApiEnvelope,
} from '../types';

const unwrap = <T>(e: ApiEnvelope<T>) => { if (!e.success || e.data === undefined) throw new Error(e.error ?? 'API'); return e.data; };

export const HardwareRequestApi = {
    async list(params: ListFilters) {
        const r = await hrHttp.get<ApiEnvelope<HardwareRequest[]>>('/', { params });
        return { rows: unwrap(r.data), meta: r.data.meta };
    },
    async byId(id: string) {
        return unwrap((await hrHttp.get<ApiEnvelope<HardwareRequest>>(`/${id}`)).data);
    },
    async create(payload: { siteId: string; recipientId?: string | null; justification: string; items: Array<{ catalogId: string; quantity: number; specs?: Record<string, unknown> }> }) {
        return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>('/', payload)).data);
    },
    async update(id: string, payload: Partial<{ justification: string; recipientId: string | null; items: unknown[] }>) {
        return unwrap((await hrHttp.patch<ApiEnvelope<HardwareRequest>>(`/${id}`, payload)).data);
    },
    async submit(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/submit`)).data); },
    async cancel(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/cancel`)).data); },
    async review(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/review`)).data); },
    async approve(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/approve`)).data); },
    async reject(id: string, reason: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/reject`, { reason })).data); },
    async updateItem(id: string, itemId: string, payload: Partial<{ actualCost: number; vendor: string; invoiceNumber: string; invoiceDate: string; notes: string }>) {
        return unwrap((await hrHttp.patch<ApiEnvelope<unknown>>(`/${id}/items/${itemId}`, payload)).data);
    },
    async completeProcurement(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/procurement/complete`)).data); },
};
```

- [ ] **Step 2: `catalog.api.ts`**

```typescript
import { hrHttp } from './http';
import type { HardwareCatalog, ApiEnvelope, ItemCategory } from '../types';
const unwrap = <T>(e: ApiEnvelope<T>) => { if (!e.success || e.data === undefined) throw new Error(e.error ?? 'API'); return e.data; };

export const CatalogApi = {
    async list(params?: { category?: ItemCategory; active?: boolean }) {
        return unwrap((await hrHttp.get<ApiEnvelope<HardwareCatalog[]>>('/catalog', { params })).data);
    },
    async create(payload: Omit<HardwareCatalog, 'id' | 'active' | 'displayOrder'> & { displayOrder?: number }) {
        return unwrap((await hrHttp.post<ApiEnvelope<HardwareCatalog>>('/catalog', payload)).data);
    },
    async update(id: string, payload: Partial<HardwareCatalog>) {
        return unwrap((await hrHttp.patch<ApiEnvelope<HardwareCatalog>>(`/catalog/${id}`, payload)).data);
    },
    async remove(id: string) {
        return unwrap((await hrHttp.delete<ApiEnvelope<HardwareCatalog>>(`/catalog/${id}`)).data);
    },
};
```

- [ ] **Step 3: `comments.api.ts`**

```typescript
import { hrHttp } from './http';
import type { HardwareRequestComment, ApiEnvelope } from '../types';
const unwrap = <T>(e: ApiEnvelope<T>) => { if (!e.success || e.data === undefined) throw new Error(e.error ?? 'API'); return e.data; };

export const CommentsApi = {
    async list(requestId: string, page = 1, pageSize = 50) {
        const r = await hrHttp.get<ApiEnvelope<HardwareRequestComment[]>>(`/${requestId}/comments`, { params: { page, pageSize } });
        return { rows: unwrap(r.data), meta: r.data.meta };
    },
    async create(requestId: string, payload: { body: string; attachments?: unknown[] }) {
        return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequestComment>>(`/${requestId}/comments`, payload)).data);
    },
    async update(requestId: string, commentId: string, body: string) {
        return unwrap((await hrHttp.patch<ApiEnvelope<HardwareRequestComment>>(`/${requestId}/comments/${commentId}`, { body })).data);
    },
    async remove(requestId: string, commentId: string) {
        return unwrap((await hrHttp.delete<ApiEnvelope<HardwareRequestComment>>(`/${requestId}/comments/${commentId}`)).data);
    },
};
```

- [ ] **Step 4: `activity.api.ts`**

```typescript
import { hrHttp } from './http';
import type { HardwareRequestActivity, ApiEnvelope } from '../types';
const unwrap = <T>(e: ApiEnvelope<T>) => { if (!e.success || e.data === undefined) throw new Error(e.error ?? 'API'); return e.data; };

export const ActivityApi = {
    async list(requestId: string) {
        return unwrap((await hrHttp.get<ApiEnvelope<HardwareRequestActivity[]>>(`/${requestId}/activity`)).data);
    },
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/api/
git commit -m "feat(frontend/hardware-request): API modules"
```

---

## Task 6.4: Utils

**Files:** 4 files.

- [ ] **Step 1: `status.util.ts`**

```typescript
import type { RequestStatus } from '../types';

export const STATUS_META: Record<RequestStatus, { label: string; tone: string; hex: string }> = {
    DRAFT:        { label: 'Draft',        tone: 'bg-slate-100 text-slate-700 ring-slate-200',   hex: '#94a3b8' },
    SUBMITTED:    { label: 'Submitted',    tone: 'bg-sky-100 text-sky-800 ring-sky-200',         hex: '#0284c7' },
    UNDER_REVIEW: { label: 'Under Review', tone: 'bg-amber-100 text-amber-900 ring-amber-200',   hex: '#b45309' },
    APPROVED:     { label: 'Approved',     tone: 'bg-emerald-100 text-emerald-800 ring-emerald-200', hex: '#047857' },
    PROCUREMENT:  { label: 'Procurement',  tone: 'bg-violet-100 text-violet-800 ring-violet-200',    hex: '#6d28d9' },
    INSTALLATION: { label: 'Installation', tone: 'bg-indigo-100 text-indigo-800 ring-indigo-200',    hex: '#4338ca' },
    COMPLETED:    { label: 'Completed',    tone: 'bg-green-600 text-white ring-green-700',          hex: '#16a34a' },
    REJECTED:     { label: 'Rejected',     tone: 'bg-rose-100 text-rose-800 ring-rose-200',         hex: '#be123c' },
    CANCELLED:    { label: 'Cancelled',    tone: 'bg-zinc-200 text-zinc-700 ring-zinc-300',         hex: '#52525b' },
};

export const isTerminal = (s: RequestStatus) => s === 'COMPLETED' || s === 'REJECTED' || s === 'CANCELLED';
```

- [ ] **Step 2: `aging.util.ts`**

```typescript
const DAY = 86400000;
export const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
export const agingTone = (days: number): 'none' | 'yellow' | 'red' =>
    days > 7 ? 'red' : days > 3 ? 'yellow' : 'none';
```

- [ ] **Step 3: `permission.util.ts`**

```typescript
import type { HardwareRequest, HardwareRole, RequestStatus, InstallStatus } from '../types';

export interface Caps {
    canEditDraft: boolean;
    canSubmit: boolean;
    canCancel: boolean;
    canReview: boolean;
    canApprove: boolean;
    canReject: boolean;
    canEditProcurement: boolean;
    canCompleteProcurement: boolean;
    canPropose: boolean;
    canConfirm: boolean;
    canReschedule: boolean;
    canStartInstall: boolean;
    canScanBarcode: boolean;
    canCompleteInstall: boolean;
    canComment: boolean;
    canManageCatalog: boolean;
}

export function capsFor(user: { id: string; role: HardwareRole }, req: HardwareRequest | null): Caps {
    const r = req?.status as RequestStatus | undefined;
    const mine = !!req && req.requesterId === user.id;
    const sched = req?.installationSchedule;
    const inCal = r === 'INSTALLATION';
    const scheduleStatus: InstallStatus | null = sched?.status ?? null;

    return {
        canEditDraft:      mine && r === 'DRAFT',
        canSubmit:         mine && r === 'DRAFT',
        canCancel:         mine && r === 'SUBMITTED',
        canReview:         user.role === 'ICT_LEAD' && r === 'SUBMITTED',
        canApprove:        user.role === 'ICT_LEAD' && r === 'UNDER_REVIEW',
        canReject:         user.role === 'ICT_LEAD' && r === 'UNDER_REVIEW',
        canEditProcurement:user.role === 'ICT_PROCUREMENT' && (r === 'APPROVED' || r === 'PROCUREMENT'),
        canCompleteProcurement: user.role === 'ICT_PROCUREMENT' && r === 'PROCUREMENT',
        canPropose:        inCal && (mine || user.role === 'ICT_TECHNICIAN') &&
                           (!scheduleStatus || ['RESCHEDULED','CANCELLED','DONE'].includes(scheduleStatus)),
        canConfirm:        inCal && scheduleStatus === 'PROPOSED' && (
                               (user.role === 'ICT_TECHNICIAN' && user.id !== sched?.proposedBy) ||
                               (mine && user.id !== sched?.proposedBy)
                           ),
        canReschedule:     inCal && !!scheduleStatus && !['IN_PROGRESS','DONE','CANCELLED','RESCHEDULED'].includes(scheduleStatus) &&
                           (user.role === 'ICT_TECHNICIAN' || mine),
        canStartInstall:   user.role === 'ICT_TECHNICIAN' && scheduleStatus === 'CONFIRMED',
        canScanBarcode:    user.role === 'ICT_TECHNICIAN' && scheduleStatus === 'IN_PROGRESS',
        canCompleteInstall:user.role === 'ICT_TECHNICIAN' && scheduleStatus === 'IN_PROGRESS',
        canComment:        !!req && (user.role !== 'USER' || mine),
        canManageCatalog:  user.role === 'ICT_LEAD',
    };
}
```

- [ ] **Step 4: `format.util.ts`**

```typescript
import { format, formatDistanceToNow } from 'date-fns';
import { id as ID } from 'date-fns/locale';

export const fmtDate = (iso?: string | null) => iso ? format(new Date(iso), 'dd MMM yyyy', { locale: ID }) : '—';
export const fmtDateTime = (iso?: string | null) => iso ? format(new Date(iso), 'dd MMM yyyy · HH:mm', { locale: ID }) : '—';
export const fmtRelative = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ID });
export const fmtIDR = (v?: number | null) => (v == null) ? '—' : 'Rp ' + Number(v).toLocaleString('id-ID');
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/utils/
git commit -m "feat(frontend/hardware-request): utils"
```

---

## Task 6.5: Query hooks

**Files:** 6 hooks + 1 mutation hook.

- [ ] **Step 1: `usePermissions.ts`**

Asumsi existing `useAuth()` return `{ user: { id, roles: string[] } }`. Mapping:

```typescript
import { useAuth } from '@/app/auth';
import type { HardwareRole } from '../types';

export function useHardwareRole(): { userId: string; role: HardwareRole } {
    const { user } = useAuth();
    const roles = new Set(user?.roles ?? []);
    let role: HardwareRole = 'USER';
    if (roles.has('ICT_LEAD')) role = 'ICT_LEAD';
    else if (roles.has('ICT_PROCUREMENT')) role = 'ICT_PROCUREMENT';
    else if (roles.has('ICT_TECHNICIAN')) role = 'ICT_TECHNICIAN';
    return { userId: user!.id, role };
}
```

- [ ] **Step 2: `useHardwareRequestList.ts`**

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { HardwareRequestApi } from '../api/hardware-request.api';
import type { ListFilters } from '../types';

export const useHardwareRequestList = (filters: ListFilters) =>
    useQuery({
        queryKey: ['hardware-requests', 'list', filters],
        queryFn: () => HardwareRequestApi.list(filters),
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    });
```

- [ ] **Step 3: `useHardwareRequest.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { HardwareRequestApi } from '../api/hardware-request.api';

export const useHardwareRequest = (id: string | undefined) =>
    useQuery({
        queryKey: ['hardware-requests', 'detail', id],
        queryFn: () => HardwareRequestApi.byId(id!),
        enabled: !!id,
        staleTime: 10_000,
    });
```

- [ ] **Step 4: `useCatalog.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { CatalogApi } from '../api/catalog.api';
import type { ItemCategory } from '../types';

export const useCatalog = (params?: { category?: ItemCategory; active?: boolean }) =>
    useQuery({
        queryKey: ['catalog', params ?? {}],
        queryFn: () => CatalogApi.list(params),
        staleTime: 5 * 60_000,
    });
```

- [ ] **Step 5: `useComments.ts` + `useActivity.ts`**

```typescript
// useComments.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { CommentsApi } from '../api/comments.api';

export const useComments = (requestId: string | undefined) =>
    useInfiniteQuery({
        queryKey: ['comments', requestId],
        initialPageParam: 1,
        enabled: !!requestId,
        queryFn: ({ pageParam }) => CommentsApi.list(requestId!, pageParam),
        getNextPageParam: (last) => {
            const m = last.meta; if (!m) return undefined;
            const loaded = m.page * m.pageSize;
            return loaded < m.total ? m.page + 1 : undefined;
        },
        staleTime: 10_000,
    });
```

```typescript
// useActivity.ts
import { useQuery } from '@tanstack/react-query';
import { ActivityApi } from '../api/activity.api';

export const useActivity = (requestId: string | undefined) =>
    useQuery({
        queryKey: ['activity', requestId],
        queryFn: () => ActivityApi.list(requestId!),
        enabled: !!requestId,
        staleTime: 10_000,
    });
```

- [ ] **Step 6: `useHardwareMutations.ts`** (mutations + invalidation + optimistic add comment)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HardwareRequestApi } from '../api/hardware-request.api';
import { CommentsApi } from '../api/comments.api';
import type { HardwareRequest, HardwareRequestComment } from '../types';

export function useHardwareMutations(requestId?: string) {
    const qc = useQueryClient();
    const invalidateDetail = () => { if (requestId) qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', requestId] }); };
    const invalidateList = () => qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] });

    const handle = <T>(p: Promise<T>, okMsg: string) =>
        p.then(v => { toast.success(okMsg); invalidateDetail(); invalidateList(); return v; })
         .catch(err => { toast.error(err?.message ?? 'Gagal'); throw err; });

    return {
        submitMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.submit(id), 'Request disubmit') }),
        cancelMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.cancel(id), 'Request dibatalkan') }),
        reviewMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.review(id), 'Review dimulai') }),
        approveMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.approve(id), 'Request disetujui') }),
        rejectMut: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => handle(HardwareRequestApi.reject(id, reason), 'Request ditolak') }),
        completeProcMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.completeProcurement(id), 'Procurement selesai') }),
        updateItemMut: useMutation({
            mutationFn: ({ itemId, payload }: { itemId: string; payload: Parameters<typeof HardwareRequestApi.updateItem>[2] }) =>
                HardwareRequestApi.updateItem(requestId!, itemId, payload),
            onSuccess: () => invalidateDetail(),
        }),

        addCommentMut: useMutation({
            mutationFn: (body: string) => CommentsApi.create(requestId!, { body }),
            onMutate: async (body: string) => {
                await qc.cancelQueries({ queryKey: ['comments', requestId] });
                const prev = qc.getQueryData(['comments', requestId]);
                const tempId = `temp-${Date.now()}`;
                qc.setQueryData(['comments', requestId], (old: any) => {
                    if (!old) return old;
                    const optimistic: HardwareRequestComment = {
                        id: tempId, requestId: requestId!, authorId: 'me',
                        body, attachments: [], createdAt: new Date().toISOString(),
                        editedAt: null, deletedAt: null, author: undefined,
                    };
                    const first = old.pages[0] ?? { rows: [], meta: { total: 0, page: 1, pageSize: 50 } };
                    return { ...old, pages: [{ ...first, rows: [optimistic, ...first.rows] }, ...old.pages.slice(1)] };
                });
                return { prev };
            },
            onError: (err: any, _body, ctx) => {
                toast.error(err?.message ?? 'Gagal komentar');
                if (ctx?.prev) qc.setQueryData(['comments', requestId], ctx.prev);
            },
            onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', requestId] }),
        }),
    };
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/hardware-request/hooks/
git commit -m "feat(frontend/hardware-request): react-query hooks"
```

---

## Task 6.6: Realtime hook

**Files:** `useHardwareRequestRealtime.ts`

- [ ] **Step 1:**

```typescript
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

let socket: Socket | null = null;
function getSocket() {
    if (!socket) {
        socket = io(`${import.meta.env.VITE_WS_URL}/ws/hardware-requests`, {
            withCredentials: true, transports: ['websocket'],
        });
    }
    return socket;
}

export function useHardwareRequestRealtime(requestId?: string) {
    const qc = useQueryClient();

    useEffect(() => {
        if (!requestId) return;
        const s = getSocket();

        const onStatusChanged = (p: any) => {
            qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', p.requestId] });
            qc.invalidateQueries({ queryKey: ['activity', p.requestId] });
            qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] });
        };
        const onComment = (p: any) => qc.invalidateQueries({ queryKey: ['comments', p.requestId] });
        const onSchedule = (p: any) => qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', p.requestId] });

        s.emit('join-request', { requestId });
        s.on('status-changed', onStatusChanged);
        s.on('comment-added', onComment);
        s.on('schedule-updated', onSchedule);
        s.on('install-progress', onStatusChanged);

        return () => {
            s.emit('leave-request', { requestId });
            s.off('status-changed', onStatusChanged);
            s.off('comment-added', onComment);
            s.off('schedule-updated', onSchedule);
            s.off('install-progress', onStatusChanged);
        };
    }, [requestId, qc]);
}

export function useHardwareGlobalRealtime() {
    const qc = useQueryClient();
    useEffect(() => {
        const s = getSocket();
        let t: any;
        const debounce = (fn: () => void) => { clearTimeout(t); t = setTimeout(fn, 1000); };
        const fn = () => debounce(() => qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] }));
        s.emit('join', { room: 'global' });
        s.on('status-changed', fn);
        return () => { s.off('status-changed', fn); clearTimeout(t); };
    }, [qc]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/hardware-request/hooks/useHardwareRequestRealtime.ts
git commit -m "feat(frontend/hardware-request): realtime hook"
```

---

## Task 6.7: Common components

**Files:** `StatusBadge`, `StatusPipeline`, `AgingBadge`, `SectionCard`, `EmptyState`.

- [ ] **Step 1: `StatusBadge.tsx`**

```tsx
import { STATUS_META } from '../../utils/status.util';
import type { RequestStatus } from '../../types';

export function StatusBadge({ status, size = 'sm' }: { status: RequestStatus; size?: 'sm' | 'md' | 'lg' }) {
    const m = STATUS_META[status];
    const sz = size === 'lg' ? 'text-sm px-3 py-1.5' : size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5';
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full ring-1 ${m.tone} ${sz} font-medium tracking-tight`}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: m.hex }} />
            {m.label}
        </span>
    );
}
```

- [ ] **Step 2: `StatusPipeline.tsx`** — animasi 0.3s ease per step.

```tsx
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { REQUEST_PIPELINE, type RequestStatus } from '../../types';
import { STATUS_META, isTerminal } from '../../utils/status.util';

export function StatusPipeline({ current }: { current: RequestStatus }) {
    const terminalBad = current === 'REJECTED' || current === 'CANCELLED';
    const idx = REQUEST_PIPELINE.indexOf(current);

    return (
        <div role="group" aria-label="Status progress" className="w-full">
            {terminalBad && (
                <div className="mb-3 text-xs font-medium" style={{ color: STATUS_META[current].hex }}>
                    {STATUS_META[current].label}
                </div>
            )}
            <ol className="flex items-center gap-0 overflow-x-auto">
                {REQUEST_PIPELINE.map((step, i) => {
                    const done = !terminalBad && i <= idx;
                    const active = i === idx && !isTerminal(current);
                    const meta = STATUS_META[step];
                    return (
                        <li key={step} className="flex items-center flex-1 min-w-[100px]">
                            <motion.div
                                className="flex flex-col items-center gap-1.5"
                                initial={{ opacity: 0.4, y: 4 }}
                                animate={{ opacity: done || active ? 1 : 0.45, y: 0 }}
                                transition={{ duration: 0.3, ease: 'easeOut', delay: i * 0.04 }}
                            >
                                <div
                                    className={`size-8 rounded-full grid place-items-center ring-2 ${active ? 'ring-offset-2' : ''}`}
                                    style={{
                                        background: done ? meta.hex : 'transparent',
                                        color: done ? '#fff' : meta.hex,
                                        borderColor: meta.hex, borderWidth: done ? 0 : 2, borderStyle: 'solid',
                                    }}
                                    aria-current={active ? 'step' : undefined}
                                >
                                    {done ? <Check className="size-4" /> : <span className="text-[11px] font-semibold">{i + 1}</span>}
                                </div>
                                <span className="text-[10px] font-medium tracking-tight text-slate-600">{meta.label}</span>
                            </motion.div>
                            {i < REQUEST_PIPELINE.length - 1 && (
                                <div className="flex-1 h-0.5 mx-1 bg-slate-200 relative overflow-hidden" aria-hidden>
                                    <motion.div
                                        className="absolute inset-y-0 left-0"
                                        style={{ background: meta.hex }}
                                        initial={{ width: 0 }}
                                        animate={{ width: done && i < idx ? '100%' : '0%' }}
                                        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 + i * 0.04 }}
                                    />
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
```

- [ ] **Step 3: `AgingBadge.tsx`**

```tsx
import { daysSince, agingTone } from '../../utils/aging.util';

export function AgingBadge({ updatedAt, terminal }: { updatedAt: string; terminal: boolean }) {
    if (terminal) return null;
    const d = daysSince(updatedAt);
    const tone = agingTone(d);
    if (tone === 'none') return null;
    const cls = tone === 'red'
        ? 'bg-rose-50 text-rose-700 ring-rose-200'
        : 'bg-amber-50 text-amber-800 ring-amber-200';
    return <span className={`inline-flex items-center gap-1 rounded-full ring-1 ${cls} text-[11px] px-2 py-0.5 font-medium`}>
        {d}h
    </span>;
}
```

- [ ] **Step 4: `SectionCard.tsx`**

```tsx
import type { ReactNode } from 'react';

export function SectionCard({ title, action, children, className = '' }: {
    title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
    return (
        <section className={`rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm ${className}`}>
            {(title || action) && (
                <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
                    {action}
                </header>
            )}
            <div className="p-5">{children}</div>
        </section>
    );
}
```

- [ ] **Step 5: `EmptyState.tsx`**

```tsx
import { PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ title, desc, cta }: { title: string; desc?: string; cta?: ReactNode }) {
    return (
        <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-slate-100 mb-4">
                <PackageOpen className="size-6 text-slate-500" />
            </div>
            <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
            {desc && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{desc}</p>}
            {cta && <div className="mt-4">{cta}</div>}
        </div>
    );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/common/
git commit -m "feat(frontend/hardware-request): common ui primitives"
```

---

## Task 6.8: List page — `RequestFilters`, `RequestTable`, `RequestCard`, `HardwareRequestListPage`

**Files:** 4.

- [ ] **Step 1: `RequestFilters.tsx`**

```tsx
import { Search } from 'lucide-react';
import type { ListFilters, RequestStatus, ItemCategory } from '../../types';

const STATUSES: RequestStatus[] = ['SUBMITTED','UNDER_REVIEW','APPROVED','PROCUREMENT','INSTALLATION','COMPLETED','REJECTED','CANCELLED'];
const CATS: ItemCategory[] = ['LAPTOP','MONITOR','ACCESSORY','NETWORK','SOFTWARE','OTHER'];

export function RequestFilters({
    value, onChange, scopeVisible,
}: { value: ListFilters; onChange: (v: ListFilters) => void; scopeVisible: boolean }) {
    const toggle = <K extends keyof ListFilters>(key: K, v: any) => {
        const arr = (value[key] as any[] | undefined) ?? [];
        const set = new Set(arr);
        set.has(v) ? set.delete(v) : set.add(v);
        onChange({ ...value, [key]: Array.from(set) });
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                        type="text" placeholder="Cari nomor, nama, atau justifikasi…"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                        value={value.search ?? ''}
                        onChange={(e) => onChange({ ...value, search: e.target.value, page: 1 })}
                        aria-label="Cari request"
                    />
                </div>
                {scopeVisible && (
                    <div className="inline-flex rounded-xl ring-1 ring-slate-200 bg-white p-0.5 text-xs">
                        {(['all','my'] as const).map(s => (
                            <button key={s} onClick={() => onChange({ ...value, scope: s })}
                                className={`px-3 py-1.5 rounded-[10px] font-medium ${value.scope===s ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
                                {s === 'all' ? 'Semua' : 'Milik saya'}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter status">
                {STATUSES.map(s => {
                    const on = value.status?.includes(s);
                    return (
                        <button key={s} onClick={() => toggle('status', s)}
                            className={`text-[11px] px-2.5 py-1 rounded-full ring-1 transition ${on ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-400'}`}>
                            {s.replace('_',' ')}
                        </button>
                    );
                })}
                <span className="mx-2 text-slate-300">|</span>
                {CATS.map(c => {
                    const on = value.category?.includes(c);
                    return (
                        <button key={c} onClick={() => toggle('category', c)}
                            className={`text-[11px] px-2.5 py-1 rounded-full ring-1 transition ${on ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-400'}`}>
                            {c}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: `RequestTable.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge';
import { AgingBadge } from '../common/AgingBadge';
import { fmtDate } from '../../utils/format.util';
import { isTerminal } from '../../utils/status.util';
import type { HardwareRequest } from '../../types';

export function RequestTable({ rows }: { rows: HardwareRequest[] }) {
    return (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-white">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                        {['Nomor','Requester','Items','Site','Status','Updated',''].map(h => (
                            <th key={h} className="text-left font-medium px-4 py-3">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3 font-mono text-[12px] text-slate-900">{r.requestNumber}</td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <Avatar name={r.requester?.fullName ?? '—'} src={r.requester?.avatarUrl} />
                                    <span className="text-slate-800">{r.requester?.fullName}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{r.items?.length ?? 0} item</td>
                            <td className="px-4 py-3 text-slate-600">{r.site?.name ?? '—'}</td>
                            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                            <td className="px-4 py-3 text-slate-500 flex items-center gap-2">
                                {fmtDate(r.updatedAt)}
                                <AgingBadge updatedAt={r.updatedAt} terminal={isTerminal(r.status)} />
                            </td>
                            <td className="px-4 py-3">
                                <Link to={`/hardware-requests/${r.id}`} className="text-sm font-medium text-slate-900 hover:underline">Buka →</Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
    if (src) return <img src={src} alt="" className="size-7 rounded-full object-cover" />;
    const initials = name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
    return <span className="size-7 rounded-full bg-slate-200 text-[11px] font-semibold grid place-items-center text-slate-700">{initials}</span>;
}
```

- [ ] **Step 3: `RequestCard.tsx`** (mobile card version — compact vertical)

```tsx
import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge';
import { AgingBadge } from '../common/AgingBadge';
import { fmtRelative } from '../../utils/format.util';
import { isTerminal } from '../../utils/status.util';
import type { HardwareRequest } from '../../types';

export function RequestCard({ r }: { r: HardwareRequest }) {
    return (
        <Link to={`/hardware-requests/${r.id}`}
            className="block rounded-2xl bg-white ring-1 ring-slate-200 p-4 hover:ring-slate-400 transition">
            <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] text-slate-900">{r.requestNumber}</span>
                <StatusBadge status={r.status} />
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900">{r.requester?.fullName}</div>
            <div className="mt-0.5 text-xs text-slate-500">{r.items?.length ?? 0} item · {r.site?.name ?? '—'}</div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Updated {fmtRelative(r.updatedAt)}</span>
                <AgingBadge updatedAt={r.updatedAt} terminal={isTerminal(r.status)} />
            </div>
        </Link>
    );
}
```

- [ ] **Step 4: `HardwareRequestListPage.tsx`** + skeleton

```tsx
// RequestListSkeleton.tsx
export function RequestListSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
        </div>
    );
}
```

```tsx
// HardwareRequestListPage.tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, LayoutGrid, List as ListIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useHardwareRequestList } from '../hooks/useHardwareRequestList';
import { useHardwareRole } from '../hooks/usePermissions';
import { useHardwareGlobalRealtime } from '../hooks/useHardwareRequestRealtime';
import { RequestFilters } from '../components/list/RequestFilters';
import { RequestTable } from '../components/list/RequestTable';
import { RequestCard } from '../components/list/RequestCard';
import { RequestListSkeleton } from '../components/list/RequestListSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import type { ListFilters } from '../types';

export default function HardwareRequestListPage() {
    const { role } = useHardwareRole();
    useHardwareGlobalRealtime();

    const defaults: ListFilters = useMemo(() => ({
        page: 1, pageSize: 20,
        scope: role === 'USER' ? 'my' : 'all',
    }), [role]);

    const [filters, setFilters] = useState<ListFilters>(defaults);
    const [view, setView] = useState<'table' | 'card'>('table');
    const { data, isLoading, isFetching } = useHardwareRequestList(filters);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            <motion.header
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Hardware Requests</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Permintaan, procurement, dan instalasi hardware.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden md:inline-flex rounded-xl ring-1 ring-slate-200 bg-white p-0.5">
                        {[['table',<ListIcon className="size-4"/>],['card',<LayoutGrid className="size-4"/>]].map(([k,icon]: any) => (
                            <button key={k} onClick={() => setView(k)}
                                className={`p-2 rounded-[10px] ${view===k?'bg-slate-900 text-white':'text-slate-600'}`}
                                aria-label={`View ${k}`}>{icon}</button>
                        ))}
                    </div>
                    {role === 'USER' && (
                        <Link to="/hardware-requests/new"
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition shadow-sm">
                            <Plus className="size-4" /> New Request
                        </Link>
                    )}
                </div>
            </motion.header>

            <RequestFilters value={filters} onChange={setFilters} scopeVisible={role !== 'USER'} />

            {isLoading ? <RequestListSkeleton /> :
             !data?.rows?.length ? (
                <EmptyState
                    title="Belum ada request"
                    desc={filters.scope === 'my' ? 'Mulai buat request hardware baru.' : 'Belum ada request dari tim.'}
                    cta={role === 'USER' && (
                        <Link to="/hardware-requests/new"
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium">
                            <Plus className="size-4" /> Buat request
                        </Link>
                    )}
                />
            ) : view === 'table' ? (
                <RequestTable rows={data.rows} />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.rows.map(r => <RequestCard key={r.id} r={r} />)}</div>
            )}

            {data?.meta && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{data.meta.total} total · halaman {data.meta.page}</span>
                    <div className="flex gap-2">
                        <button disabled={filters.page === 1 || isFetching}
                            onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}
                            className="px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white disabled:opacity-50">Prev</button>
                        <button disabled={isFetching || (data.meta.page * data.meta.pageSize >= data.meta.total)}
                            onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
                            className="px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white disabled:opacity-50">Next</button>
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/list/ apps/frontend/src/features/hardware-request/pages/HardwareRequestListPage.tsx
git commit -m "feat(frontend/hardware-request): list page"
```

---

## Task 6.9: Create Wizard (3 langkah)

**Files:** `CreateWizard.tsx`, `InfoStep.tsx`, `ItemsStep.tsx`, `CatalogPicker.tsx`, `ItemBasket.tsx`, `ReviewStep.tsx`, `HardwareRequestCreatePage.tsx`.

- [ ] **Step 1: Zod schema & state**

```tsx
// CreateWizard.tsx
import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { InfoStep } from './InfoStep';
import { ItemsStep } from './ItemsStep';
import { ReviewStep } from './ReviewStep';
import { HardwareRequestApi } from '../../api/hardware-request.api';

const schema = z.object({
    siteId: z.string().uuid(),
    recipientId: z.string().uuid().nullable().optional(),
    justification: z.string().min(20, 'Minimal 20 karakter'),
    items: z.array(z.object({
        catalogId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        specs: z.record(z.unknown()).optional(),
    })).min(1, 'Minimal 1 item'),
});
export type CreateFormValues = z.infer<typeof schema>;

const STEPS = ['Info', 'Items', 'Review'] as const;

export function CreateWizard() {
    const nav = useNavigate();
    const [step, setStep] = useState(0);
    const form = useForm<CreateFormValues>({
        resolver: zodResolver(schema),
        defaultValues: { siteId: '', justification: '', items: [], recipientId: null },
        mode: 'onBlur',
    });
    const [saving, setSaving] = useState(false);

    const onSubmit = async (values: CreateFormValues, action: 'draft' | 'submit') => {
        try {
            setSaving(true);
            const req = await HardwareRequestApi.create(values);
            if (action === 'submit') await HardwareRequestApi.submit(req.id);
            toast.success(action === 'submit' ? 'Request disubmit' : 'Draft disimpan');
            nav(`/hardware-requests/${req.id}`);
        } catch (e: any) {
            toast.error(e?.message ?? 'Gagal');
        } finally { setSaving(false); }
    };

    const next = async () => {
        const fields: (keyof CreateFormValues)[] = step === 0 ? ['siteId', 'justification'] : step === 1 ? ['items'] : [];
        const ok = await form.trigger(fields);
        if (ok) setStep(s => Math.min(2, s + 1));
    };

    return (
        <FormProvider {...form}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight">Request Hardware</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Isi info, pilih item, lalu submit.</p>
                </header>
                <nav aria-label="Wizard" className="flex items-center gap-0">
                    {STEPS.map((label, i) => (
                        <button key={label}
                            onClick={() => i < step && setStep(i)}
                            className="flex items-center gap-2 flex-1"
                            aria-current={i === step ? 'step' : undefined}>
                            <span className={`size-7 rounded-full grid place-items-center text-[11px] font-semibold ring-2 transition
                                ${i < step ? 'bg-emerald-600 text-white ring-emerald-600'
                                : i === step ? 'bg-slate-900 text-white ring-slate-900'
                                : 'bg-white text-slate-500 ring-slate-200'}`}>{i + 1}</span>
                            <span className={`text-xs font-medium ${i <= step ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
                            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
                        </button>
                    ))}
                </nav>
                <AnimatePresence mode="wait">
                    <motion.div key={step}
                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}>
                        {step === 0 && <InfoStep />}
                        {step === 1 && <ItemsStep />}
                        {step === 2 && <ReviewStep />}
                    </motion.div>
                </AnimatePresence>
                <div className="flex justify-between gap-3 pt-2">
                    <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
                        className="px-4 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-sm disabled:opacity-40">Back</button>
                    {step < 2 ? (
                        <button type="button" onClick={next}
                            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium">Next</button>
                    ) : (
                        <div className="flex gap-2">
                            <button type="button" disabled={saving} onClick={form.handleSubmit(v => onSubmit(v, 'draft'))}
                                className="px-4 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-sm">Save as Draft</button>
                            <button type="button" disabled={saving} onClick={form.handleSubmit(v => onSubmit(v, 'submit'))}
                                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium">Submit</button>
                        </div>
                    )}
                </div>
            </div>
        </FormProvider>
    );
}
```

- [ ] **Step 2: `InfoStep.tsx`**

```tsx
import { useFormContext } from 'react-hook-form';
import { useSites } from '@/features/sites/hooks/useSites'; // existing hook
import { useUsers } from '@/features/users/hooks/useUsers';  // existing hook
import { SectionCard } from '../common/SectionCard';
import type { CreateFormValues } from './CreateWizard';

export function InfoStep() {
    const { register, watch, setValue, formState: { errors } } = useFormContext<CreateFormValues>();
    const sites = useSites();
    const users = useUsers({ limit: 50 });
    const just = watch('justification') ?? '';

    return (
        <SectionCard title="Info Permintaan">
            <div className="grid gap-4">
                <div>
                    <label className="text-xs font-medium text-slate-700">Site</label>
                    <select {...register('siteId')}
                        className="mt-1 w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-sm focus:ring-2 focus:ring-slate-900 outline-none">
                        <option value="">Pilih site…</option>
                        {sites.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {errors.siteId && <p className="text-xs text-rose-600 mt-1">Site wajib</p>}
                </div>

                <div>
                    <label className="text-xs font-medium text-slate-700">Recipient (default: diri sendiri)</label>
                    <select onChange={(e) => setValue('recipientId', e.target.value || null)}
                        className="mt-1 w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-sm">
                        <option value="">— Saya sendiri —</option>
                        {users.data?.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                    </select>
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700">Justifikasi</label>
                        <span className={`text-[11px] ${just.length >= 20 ? 'text-emerald-600' : 'text-slate-400'}`}>{just.length}/20</span>
                    </div>
                    <textarea {...register('justification')} rows={4}
                        placeholder="Jelaskan kebutuhan & urgency…"
                        className="mt-1 w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-sm focus:ring-2 focus:ring-slate-900 outline-none" />
                    {errors.justification && <p className="text-xs text-rose-600 mt-1">{errors.justification.message}</p>}
                </div>
            </div>
        </SectionCard>
    );
}
```

- [ ] **Step 3: `CatalogPicker.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import type { HardwareCatalog, ItemCategory } from '../../types';
import { SectionCard } from '../common/SectionCard';

const CATS: ItemCategory[] = ['LAPTOP','MONITOR','ACCESSORY','NETWORK','SOFTWARE','OTHER'];

export function CatalogPicker({ onAdd }: { onAdd: (c: HardwareCatalog) => void }) {
    const [cat, setCat] = useState<ItemCategory | 'ALL'>('ALL');
    const { data } = useCatalog({ active: true });
    const rows = useMemo(() => (data ?? []).filter(c => cat === 'ALL' || c.category === cat), [data, cat]);

    return (
        <SectionCard title="Catalog" action={
            <div className="inline-flex flex-wrap gap-1">
                {['ALL', ...CATS].map(c => (
                    <button key={c} onClick={() => setCat(c as any)}
                        className={`text-[11px] px-2 py-1 rounded-full ring-1 ${cat===c ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-200 text-slate-600'}`}>{c}</button>
                ))}
            </div>
        }>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {rows.map(c => (
                    <button key={c.id} type="button" onClick={() => onAdd(c)}
                        className="text-left rounded-xl p-3 ring-1 ring-slate-200 bg-white hover:ring-slate-400 transition">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.category}</div>
                        <div className="mt-0.5 text-sm font-medium text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{c.code}</div>
                    </button>
                ))}
                {!rows.length && <div className="text-xs text-slate-500 col-span-full">Kategori kosong.</div>}
            </div>
        </SectionCard>
    );
}
```

- [ ] **Step 4: `ItemBasket.tsx`**

```tsx
import { useFormContext } from 'react-hook-form';
import { Trash2, Minus, Plus } from 'lucide-react';
import type { CreateFormValues } from './CreateWizard';
import type { HardwareCatalog } from '../../types';

export function ItemBasket({ catalog }: { catalog: HardwareCatalog[] }) {
    const { watch, setValue } = useFormContext<CreateFormValues>();
    const items = watch('items') ?? [];

    const find = (id: string) => catalog.find(c => c.id === id);
    const setQty = (i: number, q: number) => {
        const copy = [...items]; copy[i] = { ...copy[i], quantity: Math.max(1, q) };
        setValue('items', copy, { shouldValidate: true });
    };
    const remove = (i: number) => setValue('items', items.filter((_, idx) => idx !== i), { shouldValidate: true });

    if (!items.length) return <div className="rounded-2xl ring-1 ring-dashed ring-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Belum ada item. Pilih dari katalog di sebelah.
    </div>;

    return (
        <div className="rounded-2xl ring-1 ring-slate-200 bg-white divide-y divide-slate-100">
            {items.map((it, i) => {
                const cat = find(it.catalogId);
                return (
                    <div key={i} className="p-3 flex items-center gap-3">
                        <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">{cat?.name ?? '—'}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{cat?.code}</div>
                            {cat?.requiredFields && <DynamicFields index={i} schema={cat.requiredFields} />}
                        </div>
                        <div className="inline-flex items-center rounded-xl ring-1 ring-slate-200 bg-white">
                            <button onClick={() => setQty(i, it.quantity - 1)} className="px-2 py-1"><Minus className="size-3.5" /></button>
                            <input type="number" value={it.quantity} min={1}
                                onChange={(e) => setQty(i, Number(e.target.value) || 1)}
                                className="w-12 text-center text-sm outline-none" />
                            <button onClick={() => setQty(i, it.quantity + 1)} className="px-2 py-1"><Plus className="size-3.5" /></button>
                        </div>
                        <button onClick={() => remove(i)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg">
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

function DynamicFields({ index, schema }: { index: number; schema: Record<string, { type: 'string'|'number'|'select'; label: string; options?: string[] }> }) {
    const { register } = useFormContext<CreateFormValues>();
    return (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(schema).map(([key, field]) => (
                <div key={key}>
                    <label className="text-[10px] uppercase text-slate-500">{field.label}</label>
                    {field.type === 'select' ? (
                        <select {...register(`items.${index}.specs.${key}` as any)} className="mt-0.5 w-full text-xs px-2 py-1 rounded-lg ring-1 ring-slate-200">
                            <option value="">—</option>
                            {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : (
                        <input type={field.type === 'number' ? 'number' : 'text'}
                            {...register(`items.${index}.specs.${key}` as any)}
                            className="mt-0.5 w-full text-xs px-2 py-1 rounded-lg ring-1 ring-slate-200" />
                    )}
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 5: `ItemsStep.tsx`**

```tsx
import { useFormContext } from 'react-hook-form';
import { useCatalog } from '../../hooks/useCatalog';
import { CatalogPicker } from './CatalogPicker';
import { ItemBasket } from './ItemBasket';
import type { CreateFormValues } from './CreateWizard';

export function ItemsStep() {
    const { data: catalog = [] } = useCatalog({ active: true });
    const { watch, setValue, formState: { errors } } = useFormContext<CreateFormValues>();
    const items = watch('items') ?? [];

    const add = (c: any) => {
        const existing = items.findIndex(i => i.catalogId === c.id);
        if (existing >= 0) {
            const copy = [...items]; copy[existing].quantity += 1;
            setValue('items', copy, { shouldValidate: true });
        } else {
            setValue('items', [...items, { catalogId: c.id, quantity: 1 }], { shouldValidate: true });
        }
    };

    return (
        <div className="grid md:grid-cols-5 gap-4">
            <div className="md:col-span-3"><CatalogPicker onAdd={add} /></div>
            <div className="md:col-span-2 space-y-2">
                <div className="text-xs font-semibold tracking-tight text-slate-700">Keranjang</div>
                <ItemBasket catalog={catalog} />
                {errors.items && <p className="text-xs text-rose-600">{errors.items.message as string}</p>}
            </div>
        </div>
    );
}
```

- [ ] **Step 6: `ReviewStep.tsx`**

```tsx
import { useFormContext } from 'react-hook-form';
import { useCatalog } from '../../hooks/useCatalog';
import { useSites } from '@/features/sites/hooks/useSites';
import { SectionCard } from '../common/SectionCard';
import type { CreateFormValues } from './CreateWizard';

export function ReviewStep() {
    const { watch } = useFormContext<CreateFormValues>();
    const { data: catalog = [] } = useCatalog({ active: true });
    const { data: sites = [] } = useSites();
    const v = watch();
    const site = sites.find(s => s.id === v.siteId);

    return (
        <div className="grid gap-4">
            <SectionCard title="Ringkasan">
                <dl className="grid grid-cols-2 gap-y-3 text-sm">
                    <dt className="text-slate-500">Site</dt><dd className="text-slate-900">{site?.name ?? '—'}</dd>
                    <dt className="text-slate-500">Recipient</dt><dd className="text-slate-900">{v.recipientId ?? 'Saya sendiri'}</dd>
                    <dt className="text-slate-500 col-span-2">Justifikasi</dt>
                    <dd className="col-span-2 text-slate-800 whitespace-pre-wrap">{v.justification}</dd>
                </dl>
            </SectionCard>
            <SectionCard title="Items">
                <ul className="divide-y divide-slate-100">
                    {v.items.map((it, i) => {
                        const c = catalog.find(x => x.id === it.catalogId);
                        return (
                            <li key={i} className="py-2 flex justify-between text-sm">
                                <span>{c?.name ?? '—'} <span className="text-[11px] text-slate-500 font-mono">· {c?.code}</span></span>
                                <span className="text-slate-700">× {it.quantity}</span>
                            </li>
                        );
                    })}
                </ul>
            </SectionCard>
        </div>
    );
}
```

- [ ] **Step 7: `HardwareRequestCreatePage.tsx`**

```tsx
import { CreateWizard } from '../components/create/CreateWizard';
export default function HardwareRequestCreatePage() { return <CreateWizard />; }
```

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/create/ apps/frontend/src/features/hardware-request/pages/HardwareRequestCreatePage.tsx
git commit -m "feat(frontend/hardware-request): create wizard"
```

---

## Task 6.10: Detail — `RequestInfoCard`, `ItemsCard`, `CommentThread`, `ActivityTimeline`, `ActionPanel`, `ProcurementPanel`, page

**Files:** banyak; masing-masing kecil.

- [ ] **Step 1: `RequestInfoCard.tsx`**

```tsx
import { SectionCard } from '../common/SectionCard';
import { fmtDateTime } from '../../utils/format.util';
import type { HardwareRequest } from '../../types';

export function RequestInfoCard({ r }: { r: HardwareRequest }) {
    return (
        <SectionCard title="Info">
            <dl className="grid sm:grid-cols-2 gap-y-3 text-sm">
                <dt className="text-slate-500">Requester</dt>
                <dd className="text-slate-900">{r.requester?.fullName ?? '—'}</dd>
                <dt className="text-slate-500">Recipient</dt>
                <dd className="text-slate-900">{r.recipient?.fullName ?? 'Sama dengan requester'}</dd>
                <dt className="text-slate-500">Site</dt>
                <dd className="text-slate-900">{r.site?.name ?? '—'}</dd>
                <dt className="text-slate-500">Submitted</dt>
                <dd className="text-slate-900">{fmtDateTime(r.submittedAt)}</dd>
                <dt className="text-slate-500 col-span-2">Justifikasi</dt>
                <dd className="col-span-2 text-slate-800 whitespace-pre-wrap">{r.justification}</dd>
                {r.rejectReason && (<>
                    <dt className="text-rose-600 col-span-2">Alasan ditolak</dt>
                    <dd className="col-span-2 text-rose-700 whitespace-pre-wrap">{r.rejectReason}</dd>
                </>)}
            </dl>
        </SectionCard>
    );
}
```

- [ ] **Step 2: `ItemsCard.tsx`**

```tsx
import { SectionCard } from '../common/SectionCard';
import { fmtIDR, fmtDate } from '../../utils/format.util';
import type { HardwareRequest } from '../../types';

export function ItemsCard({ r, children }: { r: HardwareRequest; children?: React.ReactNode }) {
    return (
        <SectionCard title="Items">
            <ul className="divide-y divide-slate-100">
                {r.items.map(it => {
                    const snap = it.categorySnapshot;
                    const assets = (r.assets ?? []).filter(a => a.itemId === it.id);
                    return (
                        <li key={it.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="text-sm font-medium text-slate-900">{String(snap.name ?? '—')}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{String(snap.code ?? '')}</div>
                                {assets.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {assets.map(a => (
                                            <span key={a.id} className="text-[10px] font-mono rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 px-2 py-0.5">
                                                {a.barcode}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="text-sm text-right">
                                <div className="text-slate-800">× {it.quantity}</div>
                                {it.actualCost != null && <div className="text-[11px] text-slate-500">{fmtIDR(it.actualCost)}/unit</div>}
                                {it.vendor && <div className="text-[11px] text-slate-500">{it.vendor}</div>}
                                {it.invoiceNumber && <div className="text-[11px] text-slate-500">Inv {it.invoiceNumber} · {fmtDate(it.invoiceDate)}</div>}
                            </div>
                        </li>
                    );
                })}
            </ul>
            {children}
        </SectionCard>
    );
}
```

- [ ] **Step 3: `CommentComposer.tsx`**

```tsx
import { useState } from 'react';
import { Send } from 'lucide-react';
import { useHardwareMutations } from '../../hooks/useHardwareMutations';

export function CommentComposer({ requestId }: { requestId: string }) {
    const [text, setText] = useState('');
    const { addCommentMut } = useHardwareMutations(requestId);

    const submit = () => {
        if (!text.trim()) return;
        addCommentMut.mutate(text.trim());
        setText('');
    };

    return (
        <div className="mt-2 rounded-xl ring-1 ring-slate-200 bg-white p-2 flex gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
                placeholder="Tulis komentar…"
                className="flex-1 resize-none px-2 py-1 text-sm outline-none" />
            <button type="button" onClick={submit} disabled={!text.trim() || addCommentMut.isPending}
                className="self-end inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs disabled:opacity-40">
                <Send className="size-3.5" /> Kirim
            </button>
        </div>
    );
}
```

- [ ] **Step 4: `CommentThread.tsx`** — slide-in animation.

```tsx
import { motion } from 'framer-motion';
import { useComments } from '../../hooks/useComments';
import { fmtRelative } from '../../utils/format.util';
import { SectionCard } from '../common/SectionCard';
import { CommentComposer } from './CommentComposer';

export function CommentThread({ requestId, canComment }: { requestId: string; canComment: boolean }) {
    const q = useComments(requestId);
    const rows = q.data?.pages.flatMap(p => p.rows) ?? [];

    return (
        <SectionCard title={`Komentar · ${rows.length}`}>
            {canComment && <CommentComposer requestId={requestId} />}
            <ul className="mt-3 space-y-3">
                {rows.map(c => (
                    <motion.li key={c.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                        className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="font-semibold text-slate-900">{c.author?.fullName ?? 'Unknown'}</span>
                            {c.author?.role && <span className="text-[10px] rounded-full bg-white ring-1 ring-slate-200 px-1.5 py-0.5">{c.author.role}</span>}
                            <span>· {fmtRelative(c.createdAt)}</span>
                            {c.editedAt && <span className="italic text-slate-400">(edited)</span>}
                        </div>
                        <p className="mt-1.5 text-sm text-slate-800 whitespace-pre-wrap">{c.body}</p>
                    </motion.li>
                ))}
                {q.hasNextPage && (
                    <button onClick={() => q.fetchNextPage()} className="text-xs text-slate-600 hover:underline">
                        Load older…
                    </button>
                )}
                {rows.length === 0 && <div className="text-center text-xs text-slate-500 py-6">Belum ada komentar.</div>}
            </ul>
        </SectionCard>
    );
}
```

- [ ] **Step 5: `ActivityTimeline.tsx`**

```tsx
import { useActivity } from '../../hooks/useActivity';
import { fmtRelative } from '../../utils/format.util';
import { SectionCard } from '../common/SectionCard';

const ACTION_LABEL: Record<string, string> = {
    REQUEST_CREATED: 'Request dibuat',
    REQUEST_SUBMITTED: 'Request disubmit',
    REQUEST_REVIEWED: 'Mulai direview',
    REQUEST_APPROVED: 'Disetujui',
    REQUEST_REJECTED: 'Ditolak',
    REQUEST_CANCELLED: 'Dibatalkan',
    PROCUREMENT_COMPLETED: 'Procurement selesai',
    ITEM_UPDATED: 'Item diperbarui',
    SCHEDULE_PROPOSED: 'Jadwal diusulkan',
    SCHEDULE_CONFIRMED: 'Jadwal dikonfirmasi',
    SCHEDULE_RESCHEDULED: 'Jadwal diubah',
    INSTALL_STARTED: 'Instalasi dimulai',
    INSTALL_SCHEDULE_DONE: 'Instalasi selesai (jadwal)',
    REQUEST_COMPLETED: 'Request COMPLETED',
};

export function ActivityTimeline({ requestId }: { requestId: string }) {
    const q = useActivity(requestId);
    const rows = q.data ?? [];
    return (
        <SectionCard title="Aktivitas">
            <ol className="space-y-3">
                {rows.map(a => (
                    <li key={a.id} className="flex gap-3">
                        <div className="relative pt-1.5">
                            <span className="block size-2 rounded-full bg-slate-900" />
                            <span className="absolute left-1/2 top-4 bottom-[-12px] w-px bg-slate-200 -translate-x-1/2" aria-hidden />
                        </div>
                        <div>
                            <div className="text-sm text-slate-900 font-medium">{ACTION_LABEL[a.action] ?? a.action}</div>
                            <div className="text-[11px] text-slate-500">
                                {a.actor?.fullName ?? 'System'} · {fmtRelative(a.createdAt)}
                            </div>
                        </div>
                    </li>
                ))}
                {rows.length === 0 && <li className="text-xs text-slate-500">Belum ada aktivitas.</li>}
            </ol>
        </SectionCard>
    );
}
```

- [ ] **Step 6: `RejectDialog.tsx`**

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function RejectDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
    const [reason, setReason] = useState('');

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div className="fixed inset-0 bg-black/40 z-40"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
                    <motion.div role="dialog" aria-modal="true"
                        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.09 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(95vw,440px)] rounded-2xl bg-white shadow-lg z-50 p-5">
                        <h2 className="text-base font-semibold tracking-tight">Tolak Request</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Alasan akan dikirim ke requester.</p>
                        <textarea rows={4} value={reason} onChange={e => setReason(e.target.value)}
                            className="mt-3 w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900" />
                        <div className="mt-3 flex justify-end gap-2">
                            <button onClick={onClose} className="px-3 py-1.5 rounded-xl ring-1 ring-slate-200 text-sm">Batal</button>
                            <button onClick={() => { onConfirm(reason); onClose(); }}
                                disabled={reason.trim().length < 5}
                                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-sm disabled:opacity-50">Tolak</button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
```

- [ ] **Step 7: `ActionPanel.tsx`**

```tsx
import { useState } from 'react';
import { SectionCard } from '../common/SectionCard';
import { useHardwareMutations } from '../../hooks/useHardwareMutations';
import { capsFor } from '../../utils/permission.util';
import { useHardwareRole } from '../../hooks/usePermissions';
import { RejectDialog } from './RejectDialog';
import type { HardwareRequest } from '../../types';

export function ActionPanel({ r }: { r: HardwareRequest }) {
    const { userId, role } = useHardwareRole();
    const caps = capsFor({ id: userId, role }, r);
    const m = useHardwareMutations(r.id);
    const [rejectOpen, setRejectOpen] = useState(false);

    const primary = 'inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-medium disabled:opacity-40 w-full';
    const secondary = 'inline-flex items-center justify-center rounded-xl ring-1 ring-slate-200 bg-white px-3 py-2 text-xs font-medium w-full';
    const danger = 'inline-flex items-center justify-center rounded-xl bg-rose-600 text-white px-3 py-2 text-xs font-medium w-full';

    const actions: Array<[boolean, JSX.Element]> = [
        [caps.canSubmit, <button key="sub" className={primary} onClick={() => m.submitMut.mutate(r.id)}>Submit</button>],
        [caps.canCancel, <button key="cancel" className={secondary} onClick={() => m.cancelMut.mutate(r.id)}>Cancel request</button>],
        [caps.canReview, <button key="rev" className={primary} onClick={() => m.reviewMut.mutate(r.id)}>Start review</button>],
        [caps.canApprove, <button key="appr" className={primary} onClick={() => m.approveMut.mutate(r.id)}>Approve</button>],
        [caps.canReject, <button key="rej" className={danger} onClick={() => setRejectOpen(true)}>Reject…</button>],
        [caps.canCompleteProcurement, <button key="procC" className={primary} onClick={() => m.completeProcMut.mutate(r.id)}>Complete procurement</button>],
    ];
    const visible = actions.filter(([ok]) => ok);

    return (
        <SectionCard title="Actions">
            {visible.length === 0 ? (
                <div className="text-xs text-slate-500">Tidak ada aksi untuk kamu saat ini.</div>
            ) : (
                <div className="flex flex-col gap-2">{visible.map(([, el]) => el)}</div>
            )}
            <RejectDialog
                open={rejectOpen} onClose={() => setRejectOpen(false)}
                onConfirm={(reason) => m.rejectMut.mutate({ id: r.id, reason })} />
        </SectionCard>
    );
}
```

- [ ] **Step 8: Procurement panel**

```tsx
// ProcurementPanel.tsx
import { SectionCard } from '../common/SectionCard';
import { InvoiceForm } from './InvoiceForm';
import type { HardwareRequest } from '../../types';

export function ProcurementPanel({ r }: { r: HardwareRequest }) {
    return (
        <SectionCard title="Procurement">
            <div className="space-y-3">
                {r.items.map(it => <InvoiceForm key={it.id} requestId={r.id} item={it} />)}
            </div>
        </SectionCard>
    );
}
```

```tsx
// InvoiceForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useHardwareMutations } from '../../hooks/useHardwareMutations';
import type { HardwareRequestItem } from '../../types';

const schema = z.object({
    actualCost: z.preprocess(v => v === '' ? undefined : Number(v), z.number().min(0)),
    vendor: z.string().min(1),
    invoiceNumber: z.string().min(1),
    invoiceDate: z.string().min(1),
    notes: z.string().optional(),
});

export function InvoiceForm({ requestId, item }: { requestId: string; item: HardwareRequestItem }) {
    const { register, handleSubmit, formState: { isDirty } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            actualCost: item.actualCost ?? undefined,
            vendor: item.vendor ?? '',
            invoiceNumber: item.invoiceNumber ?? '',
            invoiceDate: item.invoiceDate ?? '',
            notes: item.notes ?? '',
        },
    });
    const { updateItemMut } = useHardwareMutations(requestId);

    const onSubmit = handleSubmit(values => {
        updateItemMut.mutate({ itemId: item.id, payload: values as any });
    });

    return (
        <form onSubmit={onSubmit} className="rounded-xl ring-1 ring-slate-200 p-3 grid sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2 text-xs font-medium text-slate-700">{String(item.categorySnapshot.name ?? '—')} × {item.quantity}</div>
            <Field label="Harga satuan (IDR)"><input type="number" step="1" {...register('actualCost')} className={inp} /></Field>
            <Field label="Vendor"><input {...register('vendor')} className={inp} /></Field>
            <Field label="Invoice #"><input {...register('invoiceNumber')} className={inp} /></Field>
            <Field label="Tgl invoice"><input type="date" {...register('invoiceDate')} className={inp} /></Field>
            <Field label="Catatan" wide><textarea rows={2} {...register('notes')} className={inp} /></Field>
            <div className="sm:col-span-2 flex justify-end">
                <button type="submit" disabled={!isDirty || updateItemMut.isPending}
                    className="rounded-xl bg-slate-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40">Simpan</button>
            </div>
        </form>
    );
}

const inp = 'mt-1 w-full px-2 py-1.5 rounded-lg ring-1 ring-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900';
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
    return <label className={`text-[11px] uppercase tracking-wider text-slate-500 ${wide ? 'sm:col-span-2' : ''}`}>
        {label}{children}
    </label>;
}
```

- [ ] **Step 9: `HardwareRequestDetailPage.tsx`**

```tsx
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useHardwareRequest } from '../hooks/useHardwareRequest';
import { useHardwareRequestRealtime } from '../hooks/useHardwareRequestRealtime';
import { useHardwareRole } from '../hooks/usePermissions';
import { capsFor } from '../utils/permission.util';
import { StatusBadge } from '../components/common/StatusBadge';
import { StatusPipeline } from '../components/common/StatusPipeline';
import { RequestInfoCard } from '../components/detail/RequestInfoCard';
import { ItemsCard } from '../components/detail/ItemsCard';
import { CommentThread } from '../components/detail/CommentThread';
import { ActivityTimeline } from '../components/detail/ActivityTimeline';
import { ActionPanel } from '../components/detail/ActionPanel';
import { ProcurementPanel } from '../components/procurement/ProcurementPanel';

export default function HardwareRequestDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { data: r, isLoading, isError } = useHardwareRequest(id);
    const { userId, role } = useHardwareRole();
    useHardwareRequestRealtime(id);

    if (isLoading) return <DetailSkeleton />;
    if (isError || !r) return <div className="max-w-7xl mx-auto p-6 text-sm text-rose-600">Gagal memuat request.</div>;

    const caps = capsFor({ id: userId, role }, r);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            <motion.header
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-slate-500">{r.requestNumber}</span>
                        <StatusBadge status={r.status} size="md" />
                    </div>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                        {r.items.length} item{r.items.length > 1 ? 's' : ''} · {r.site?.name}
                    </h1>
                </div>
            </motion.header>

            <StatusPipeline current={r.status} />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                    <RequestInfoCard r={r} />
                    <ItemsCard r={r}>
                        {caps.canEditProcurement && <div className="mt-4"><ProcurementPanel r={r} /></div>}
                    </ItemsCard>
                    <CommentThread requestId={r.id} canComment={caps.canComment} />
                </div>
                <aside className="space-y-4">
                    <ActionPanel r={r} />
                    <ActivityTimeline requestId={r.id} />
                </aside>
            </div>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            <div className="h-8 w-72 bg-slate-100 animate-pulse rounded-lg" />
            <div className="h-14 bg-slate-100 animate-pulse rounded-2xl" />
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />)}
                </div>
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />)}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 10: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/detail/ apps/frontend/src/features/hardware-request/components/procurement/ apps/frontend/src/features/hardware-request/pages/HardwareRequestDetailPage.tsx
git commit -m "feat(frontend/hardware-request): detail page + action panel"
```

---

## Task 6.11: Routes & sidebar

**Files:** Modify `app/router.tsx`, `app/sidebar.tsx`. Create `features/hardware-request/routes.tsx`.

- [ ] **Step 1: `routes.tsx`**

```tsx
import { lazy } from 'react';

export const hardwareRequestRoutes = [
    { path: '/hardware-requests', element: lazyPage(() => import('./pages/HardwareRequestListPage')) },
    { path: '/hardware-requests/new', element: lazyPage(() => import('./pages/HardwareRequestCreatePage')) },
    { path: '/hardware-requests/:id', element: lazyPage(() => import('./pages/HardwareRequestDetailPage')) },
];

function lazyPage(loader: () => Promise<{ default: React.ComponentType }>) {
    const C = lazy(loader);
    return <C />;
}
```

- [ ] **Step 2: Router**

Di `app/router.tsx` tambahkan `...hardwareRequestRoutes` setelah route existing (wrap `Suspense` jika perlu).

- [ ] **Step 3: Sidebar entry**

Tambah item `{ label: 'Hardware Requests', to: '/hardware-requests', icon: 'Boxes' }`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(frontend/hardware-request): routes + sidebar"
```

---

## Task 6.12: Component tests (Vitest + RTL)

**Files:** `__tests__/StatusPipeline.test.tsx`, `__tests__/permission.util.test.ts`, `__tests__/aging.util.test.ts`, `__tests__/RejectDialog.test.tsx`, `__tests__/CatalogPicker.test.tsx`.

- [ ] **Step 1: Util tests (RED→GREEN trivial)**

```typescript
// aging.util.test.ts
import { describe, it, expect } from 'vitest';
import { agingTone, daysSince } from '../utils/aging.util';
describe('aging', () => {
    it('none under 3 days', () => expect(agingTone(2)).toBe('none'));
    it('yellow 3-7', () => expect(agingTone(5)).toBe('yellow'));
    it('red >7', () => expect(agingTone(8)).toBe('red'));
});
```

- [ ] **Step 2: Pipeline test**

```tsx
import { render, screen } from '@testing-library/react';
import { StatusPipeline } from '../components/common/StatusPipeline';

it('marks completed steps up to current', () => {
    render(<StatusPipeline current="APPROVED" />);
    // step UNDER_REVIEW labeled, step PROCUREMENT not done
    expect(screen.getByText('Approved')).toBeInTheDocument();
});
```

- [ ] **Step 3: RejectDialog test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { RejectDialog } from '../components/detail/RejectDialog';

it('disables confirm when reason <5 char', () => {
    render(<RejectDialog open onClose={() => {}} onConfirm={() => {}} />);
    const btn = screen.getByRole('button', { name: /tolak/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tidak sesuai' } });
    expect(btn).not.toBeDisabled();
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter frontend test -- hardware-request
git add -A && git commit -m "test(frontend/hardware-request): component + util tests"
```

---

## Task 6.13: Responsiveness + a11y polish

- [ ] **Step 1: Manual checks**

- List: resize 320px → 1440px, table → card di <640px
- Wizard: keyboard tab order, stepper `aria-current="step"`
- Dialog: Esc to close, focus trap (pakai radix atau manual via `useRef`)
- Colors: kontras `aa` minimal 4.5:1 untuk text di badge

- [ ] **Step 2: Install axe test**

```bash
pnpm add -D @axe-core/react
```

Jalankan di dev di `main.tsx`:

```typescript
if (import.meta.env.DEV) {
    import('@axe-core/react').then(({ default: axe }) => axe(React, ReactDOM, 1000));
}
```

- [ ] **Step 3: Commit fixes if any**

```bash
git add -A && git commit -m "chore(frontend/hardware-request): a11y polish"
```

---

## Verification Checklist (Plan 6)

- [ ] `/hardware-requests` render list + filter berfungsi
- [ ] Realtime: buka 2 tab, submit di tab A → status berubah di tab B <2s
- [ ] Wizard: min 20 char justification enforced; empty items blocked
- [ ] Detail: pipeline animasi mulus; comment optimistic add
- [ ] Procurement panel muncul hanya untuk ICT_PROCUREMENT saat status APPROVED/PROCUREMENT
- [ ] Reject dialog memaksa reason ≥5 char
- [ ] A11y: keyboard-only flow works; focus ring visible
- [ ] Mobile: card view di <640px

**Next:** Plan 7 — Calendar, Dashboard, Catalog Admin, E2E, Route redirects.
