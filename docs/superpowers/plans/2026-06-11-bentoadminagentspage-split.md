# Split BentoAdminAgentsPage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pecah `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx` (1521 baris) menjadi sub-komponen presentational + custom hooks via **ekstraksi murni tanpa ubah behavior**, sehingga file induk turun di bawah 800 baris (CLAUDE.md §4).

**Architecture:** Refactor-only. Pertama pasang jaring pengaman (characterization render test), lalu ekstrak blok JSX menjadi komponen presentational di `features/admin/components/agent-management/` (pola yang sudah ada — folder ini sudah berisi `AgentCard`, `StatCard`, `RoleSection`, `UnifiedUserTable`, dll). Terakhir (opsional, untuk kohesi) ekstrak logika query & mutation ke custom hooks. Tidak ada perubahan UI, props, atau API. Setiap task: ekstrak → jaring pengaman hijau → commit.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Radix UI, TailwindCSS, Vitest + Testing Library.

---

## Konvensi Ekstraksi (baca dulu)

Ini refactor **cut-paste**, bukan tulis ulang. Untuk tiap komponen yang diekstrak:

1. Body JSX **disalin verbatim** dari rentang baris yang disebut di file asli `BentoAdminAgentsPage.tsx`. Plan ini menyebut rentang baris + **kontrak props lengkap** (interface) + **JSX pengganti** di file induk. Jangan mengubah className, struktur, atau logika di dalam body.
2. Variabel yang sebelumnya berasal dari scope komponen induk (state, handler, data) diganti jadi **props**. Pemetaannya disebut eksplisit per task.
3. Import yang dipakai body (mis. `lucide-react` icons, `cn`, Radix) ikut dipindah ke file komponen baru; hapus import yang jadi tak terpakai di induk **hanya saat verifikasi typecheck menandainya** (jangan tebak).
4. Setiap komponen baru di-export lewat barrel `features/admin/components/agent-management/index.ts`.

**Jaring pengaman** = file test `BentoAdminAgentsPage.smoke.test.tsx` (dibuat di Task 1). Setiap task sesudahnya **wajib** menjalankan ulang test ini dan harus tetap PASS — itu bukti behavior tidak berubah.

Perintah verifikasi standar (jalankan dari `apps/frontend/`):
- Test jaring pengaman: `npx vitest run src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx`
- Typecheck: `npx tsc -b --noEmit` *(jika `-b` menolak `--noEmit`, pakai `npx tsc --noEmit -p tsconfig.app.json`)*
- Line count induk: `wc -l src/features/admin/pages/BentoAdminAgentsPage.tsx`

---

## File Structure

**Dibuat:**
- `src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx` — characterization test
- `src/features/admin/components/agent-management/AgentManagementHeader.tsx`
- `src/features/admin/components/agent-management/AgentFiltersToolbar.tsx`
- `src/features/admin/components/agent-management/AgentStatsDashboard.tsx`
- `src/features/admin/components/agent-management/AgentPerformancePanel.tsx`
- `src/features/admin/components/agent-management/UsersByRoleSection.tsx`
- `src/features/admin/components/agent-management/AgentPaginationBar.tsx`
- `src/features/admin/components/agent-management/KeyboardShortcutsHelpDialog.tsx`
- `src/features/admin/components/agent-management/AgentManagementDialogs.tsx`
- (opsional) `src/features/admin/hooks/useAgentData.ts`, `useAgentMutations.ts` + tests

**Dimodifikasi:**
- `src/features/admin/pages/BentoAdminAgentsPage.tsx` — ganti blok inline jadi pemanggilan komponen
- `src/features/admin/components/agent-management/index.ts` — tambah export

---

## Task 1: Characterization smoke test (jaring pengaman)

**Files:**
- Create: `src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx`

- [ ] **Step 1: Tulis test yang me-render halaman dengan api & auth ter-mock**

Mock mengikuti pola repo (`vi.mock('@/lib/api')`, `QueryClientProvider` wrapper). Endpoint yang dipanggil halaman: `GET /users`, `GET /sites/active`, `GET /users/agents/stats`. Hook `usePermissionPresets` memakai `@/lib/api` yang sama, jadi cukup mock `api`. `useAuth` di-mock agar mengembalikan user ADMIN.

```tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BentoAdminAgentsPage } from '../BentoAdminAgentsPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url.startsWith('/users/agents/stats')) return Promise.resolve({ data: { summary: {}, agents: [] } });
            if (url.startsWith('/sites/active')) return Promise.resolve({ data: [] });
            if (url.startsWith('/users')) return Promise.resolve({ data: { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 1, hasNextPage: false, hasPrevPage: false } } });
            return Promise.resolve({ data: {} });
        }),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'admin-1', role: 'ADMIN', siteId: null } }),
}));

vi.mock('../../components/OnboardingTutorial', () => ({
    OnboardingTutorial: () => null,
    shouldShowOnboarding: () => false,
}));

describe('BentoAdminAgentsPage (characterization)', () => {
    const renderPage = () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        return render(
            <QueryClientProvider client={qc}>
                <BentoAdminAgentsPage />
            </QueryClientProvider>
        );
    };

    it('renders header and primary actions', async () => {
        renderPage();
        expect(await screen.findByText('Agent Management')).toBeInTheDocument();
        expect(screen.getByText('Add User')).toBeInTheDocument();
    });

    it('renders stat cards', async () => {
        renderPage();
        expect(await screen.findByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('Active (In Progress)')).toBeInTheDocument();
        expect(screen.getByText('Resolved (Month)')).toBeInTheDocument();
    });

    it('renders empty state when no users', async () => {
        renderPage();
        expect(await screen.findByText('No Users Found')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Jalankan test — harus PASS terhadap kode existing (baseline hijau sebelum refactor)**

Run: `npx vitest run src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx`
Expected: 3 passed. (Jika gagal karena mock kurang, perbaiki mock — JANGAN ubah halaman. Halaman belum boleh berubah di task ini.)

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx
git commit -m "test(admin): add characterization smoke test for BentoAdminAgentsPage"
```

---

## Task 2: Ekstrak `AgentPaginationBar` (pemanasan, blok terkecil & terisolasi)

Sumber: baris **1290–1338** (`{paginationMeta && paginationMeta.totalPages > 1 && (...)}`).

**Files:**
- Create: `src/features/admin/components/agent-management/AgentPaginationBar.tsx`
- Modify: `src/features/admin/components/agent-management/index.ts`
- Modify: `src/features/admin/pages/BentoAdminAgentsPage.tsx:1290-1338`

- [ ] **Step 1: Buat komponen baru** — salin body verbatim dari 1290–1338, ganti variabel scope jadi props.

Pemetaan: `paginationMeta`→`meta`, `pageSize`→`pageSize`, `PAGE_SIZE_OPTIONS`→`pageSizeOptions`, `setPageSize(n); setCurrentPage(1)`→`onPageSizeChange(n)`, `setCurrentPage(p => Math.max(1, p-1))`→`onPrev()`, `setCurrentPage(p => p+1)`→`onNext()`.

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginatedResponse } from '@/types/admin.types';

type PaginationMeta = NonNullable<PaginatedResponse<unknown>['meta']>;

interface AgentPaginationBarProps {
    meta: PaginationMeta;
    pageSize: number;
    pageSizeOptions: number[];
    onPageSizeChange: (size: number) => void;
    onPrev: () => void;
    onNext: () => void;
}

export function AgentPaginationBar({ meta, pageSize, pageSizeOptions, onPageSizeChange, onPrev, onNext }: AgentPaginationBarProps) {
    if (meta.totalPages <= 1) return null;
    // BODY: salin verbatim isi <div className="sticky bottom-4 ..."> dari baris 1292-1337,
    // mengganti `paginationMeta`→`meta`, select onChange→`onPageSizeChange(Number(e.target.value))`,
    // tombol Previous onClick→`onPrev`, Next onClick→`onNext`, `PAGE_SIZE_OPTIONS`→`pageSizeOptions`.
    return ( /* ...verbatim... */ );
}
```

> Catatan: tipe `PaginationMeta` harus memuat `page, limit, total, totalPages, hasNextPage, hasPrevPage` sesuai pemakaian di body. Jika `PaginatedResponse['meta']` tidak punya field tsb, definisikan interface `PaginationMeta` eksplisit di file ini sesuai field yang dipakai (jangan pakai `any`).

- [ ] **Step 2: Export di barrel**

Tambah ke `index.ts`: `export { AgentPaginationBar } from './AgentPaginationBar';`

- [ ] **Step 3: Ganti blok di induk** — `BentoAdminAgentsPage.tsx`, ganti baris 1290–1338 dengan:

```tsx
{paginationMeta && (
    <AgentPaginationBar
        meta={paginationMeta}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        onPrev={() => setCurrentPage(p => Math.max(1, p - 1))}
        onNext={() => setCurrentPage(p => p + 1)}
    />
)}
```

Tambah import: `import { AgentPaginationBar } from '../components/agent-management';`

- [ ] **Step 4: Verifikasi** — typecheck + jaring pengaman.

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx`
Expected: typecheck bersih, 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/components/agent-management/AgentPaginationBar.tsx src/features/admin/components/agent-management/index.ts src/features/admin/pages/BentoAdminAgentsPage.tsx
git commit -m "refactor(admin): extract AgentPaginationBar from BentoAdminAgentsPage"
```

---

## Task 3: Ekstrak `KeyboardShortcutsHelpDialog`

Sumber: baris **1469–1503** (`{showKeyboardHelp && (...)}`).

**Files:**
- Create: `src/features/admin/components/agent-management/KeyboardShortcutsHelpDialog.tsx`
- Modify: `index.ts`, `BentoAdminAgentsPage.tsx:1469-1503`

- [ ] **Step 1: Buat komponen** — body verbatim dari 1470–1502, `setShowKeyboardHelp(false)`→`onClose`.

```tsx
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpDialogProps {
    open: boolean;
    onClose: () => void;
}

export function KeyboardShortcutsHelpDialog({ open, onClose }: KeyboardShortcutsHelpDialogProps) {
    if (!open) return null;
    // BODY: salin verbatim isi <div className="fixed inset-0 z-50 ..."> baris 1470-1502,
    // ganti semua `setShowKeyboardHelp(false)` → `onClose`.
    return ( /* ...verbatim... */ );
}
```

- [ ] **Step 2: Export di barrel** — `export { KeyboardShortcutsHelpDialog } from './KeyboardShortcutsHelpDialog';`

- [ ] **Step 3: Ganti di induk** baris 1469–1503 dengan:

```tsx
<KeyboardShortcutsHelpDialog open={showKeyboardHelp} onClose={() => setShowKeyboardHelp(false)} />
```

Tambah `KeyboardShortcutsHelpDialog` ke import barrel. Hapus import `Keyboard` dari induk **jika** typecheck menandai tak terpakai.

- [ ] **Step 4: Verifikasi** — `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx`
Expected: bersih + 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(admin): extract KeyboardShortcutsHelpDialog from BentoAdminAgentsPage"
```

---

## Task 4: Ekstrak `AgentStatsDashboard`

Sumber: baris **807–860** (grid 4 StatCard + indikator filter aktif).

**Files:**
- Create: `src/features/admin/components/agent-management/AgentStatsDashboard.tsx`
- Modify: `index.ts`, `BentoAdminAgentsPage.tsx:807-860`

- [ ] **Step 1: Buat komponen.** Dependensi body: `paginationMeta?.total`, `dashboardStats` (`{ totalAgents, totalActive, totalResolved, topPerformer, topPerformerTickets }`), `statsFilter`, `setStatsFilter`. Pakai `StatCard` & `TopPerformerCard` yang sudah ada.

```tsx
import { Users, BarChart3, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCard } from './StatCard';
import { TopPerformerCard } from './AgentTopPerformerCard';

type StatsFilter = 'all' | 'active' | 'resolved' | 'top';

interface DashboardStats {
    totalAgents: number;
    totalActive: number;
    totalResolved: number;
    topPerformer: string;
    topPerformerTickets: number;
}

interface AgentStatsDashboardProps {
    total: number | undefined;
    dashboardStats: DashboardStats;
    statsFilter: StatsFilter;
    onStatsFilterChange: (filter: StatsFilter) => void;
}

export function AgentStatsDashboard({ total, dashboardStats, statsFilter, onStatsFilterChange }: AgentStatsDashboardProps) {
    // BODY: gabung baris 808-860 (grid stats + indikator filter aktif) verbatim.
    // - StatCard "Total Users" value: `total ?? dashboardStats.totalAgents`
    // - onClick handler `setStatsFilter(x)` → `onStatsFilterChange(x)`
    return ( /* ...verbatim (wrap dua blok dalam <> </>)... */ );
}
```

- [ ] **Step 2: Export di barrel.**

- [ ] **Step 3: Ganti di induk** baris 807–860 dengan:

```tsx
<AgentStatsDashboard
    total={paginationMeta?.total}
    dashboardStats={dashboardStats}
    statsFilter={statsFilter}
    onStatsFilterChange={setStatsFilter}
/>
```

- [ ] **Step 4: Verifikasi** — typecheck + smoke (3 passed; cek teks "Total Users" masih ketemu).

- [ ] **Step 5: Commit** — `refactor(admin): extract AgentStatsDashboard from BentoAdminAgentsPage`

---

## Task 5: Ekstrak `AgentManagementHeader`

Sumber: baris **563–675** (`<div className="flex items-center justify-between">` header + tombol aksi). Jangan ikutkan `<h1>` wrapper luar? Ikutkan — header termasuk judul + grup tombol.

**Files:**
- Create: `.../AgentManagementHeader.tsx`; Modify: `index.ts`, induk 563–675.

- [ ] **Step 1: Buat komponen.** Dependensi → props:

```tsx
interface AgentManagementHeaderProps {
    selectedCount: number;
    viewMode: 'grid' | 'table';
    onViewModeChange: (mode: 'grid' | 'table') => void;
    onBulkRoleChange: () => void;
    onBulkSiteChange: () => void;
    onCompare: () => void;        // hanya dipakai saat selectedCount === 2
    onBulkDelete: () => void;
    onExport: () => void;
    onImport: () => void;
    onManagePresets: () => void;
    onAddUser: () => void;
}
```

Body verbatim dari 563–675; mapping: `selectedUserIds.size`→`selectedCount`, `setIsBulkRoleChangeOpen(true)`→`onBulkRoleChange()`, `setIsBulkSiteChangeOpen(true)`→`onBulkSiteChange()`, `setIsComparisonOpen(true)`→`onCompare()`, `setIsBulkDeleteOpen(true)`→`onBulkDelete()`, `setViewMode(x)`→`onViewModeChange(x)`, `setIsExportPreviewOpen(true)`→`onExport()`, `setIsImportModalOpen(true)`→`onImport()`, `setIsPresetManageOpen(true)`→`onManagePresets()`, `setIsAddUserModalOpen(true)`→`onAddUser()`. Pindah import icon yang dipakai (`CheckSquare, ChevronDown, Shield, MapPin, BarChart3, Trash2, LayoutGrid, List, Download, Upload, Settings, Plus`), `cn`, dan `DropdownMenu*`.

- [ ] **Step 2: Export di barrel.**

- [ ] **Step 3: Ganti di induk** baris 563–675 dengan:

```tsx
<AgentManagementHeader
    selectedCount={selectedUserIds.size}
    viewMode={viewMode}
    onViewModeChange={setViewMode}
    onBulkRoleChange={() => setIsBulkRoleChangeOpen(true)}
    onBulkSiteChange={() => setIsBulkSiteChangeOpen(true)}
    onCompare={() => setIsComparisonOpen(true)}
    onBulkDelete={() => setIsBulkDeleteOpen(true)}
    onExport={() => setIsExportPreviewOpen(true)}
    onImport={() => setIsImportModalOpen(true)}
    onManagePresets={() => setIsPresetManageOpen(true)}
    onAddUser={() => setIsAddUserModalOpen(true)}
/>
```

- [ ] **Step 4: Verifikasi** — typecheck + smoke (cek "Agent Management" & "Add User"). Hapus import icon yang kini tak terpakai di induk hanya bila typecheck menandai.

- [ ] **Step 5: Commit** — `refactor(admin): extract AgentManagementHeader from BentoAdminAgentsPage`

---

## Task 6: Ekstrak `AgentFiltersToolbar`

Sumber: baris **677–805** (search bar + Site Tabs + Role pills).

**Files:** Create `.../AgentFiltersToolbar.tsx`; Modify `index.ts`, induk 677–805.

- [ ] **Step 1: Buat komponen.** Props:

```tsx
import type { Site, User, PaginatedResponse } from '@/types/admin.types';

type RoleFilter = 'ALL' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT';

interface AgentFiltersToolbarProps {
    searchQuery: string;
    deferredSearchQuery: string;
    onSearchChange: (value: string) => void;
    selectedCount: number;
    onBulkDelete: () => void;
    sites: { code: string; name: string; id: string }[];
    selectedSite: string;
    isAgentRole: boolean;
    onSiteChange: (site: string) => void;
    siteCounts: Record<string, number>;
    selectedRole: RoleFilter;
    onRoleChange: (role: RoleFilter) => void;
    users: User[];
    paginationMeta: PaginatedResponse<User>['meta'];
}
```

Body verbatim 678–805. Mapping: `searchQuery`/`deferredSearchQuery` props; `setSearchQuery(e.target.value)`→`onSearchChange(e.target.value)`, `setSearchQuery('')`→`onSearchChange('')`; `selectedUserIds.size`→`selectedCount`; `setIsBulkDeleteOpen(true)`→`onBulkDelete()`; `SITES`→`sites`; `handleSiteChange`→`onSiteChange`; `setSelectedRole(role); setCurrentPage(1)`→`onRoleChange(role)`. `ROLE_CONFIG` di-import dari `./agent-utils` (sudah ada). Pindah import icon: `Search, X, Trash2, MapPin, Shield, Users`, `cn`, `* as Tabs`.

- [ ] **Step 2: Export di barrel.**

- [ ] **Step 3: Ganti di induk** baris 677–805 dengan:

```tsx
<AgentFiltersToolbar
    searchQuery={searchQuery}
    deferredSearchQuery={deferredSearchQuery}
    onSearchChange={setSearchQuery}
    selectedCount={selectedUserIds.size}
    onBulkDelete={() => setIsBulkDeleteOpen(true)}
    sites={SITES}
    selectedSite={selectedSite}
    isAgentRole={isAgentRole}
    onSiteChange={handleSiteChange}
    siteCounts={siteCounts}
    selectedRole={selectedRole}
    onRoleChange={(role) => { setSelectedRole(role); setCurrentPage(1); }}
    users={users}
    paginationMeta={paginationMeta}
/>
```

- [ ] **Step 4: Verifikasi** — typecheck + smoke (3 passed).

- [ ] **Step 5: Commit** — `refactor(admin): extract AgentFiltersToolbar from BentoAdminAgentsPage`

---

## Task 7: Ekstrak `UsersByRoleSection`

Sumber: baris **1169–1288** (loading skeleton / error / empty state / `UnifiedUserTable` vs `RoleSection` list).

**Files:** Create `.../UsersByRoleSection.tsx`; Modify `index.ts`, induk 1169–1288.

- [ ] **Step 1: Buat komponen.** Props (banyak handler — pertahankan signature yang sama dengan `UnifiedUserTable`/`RoleSection` existing):

```tsx
import type { User } from '@/types/admin.types';
import type { PermissionPreset } from './agent-types';

interface UsersByRoleSectionProps {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    onRetry: () => void;
    filteredUsers: User[];
    usersByRole: { ADMIN: User[]; MANAGER: User[]; AGENT: User[]; USER: User[] };
    displayMode: 'unified' | 'collapsed';
    searchQuery: string;
    deferredSearchQuery: string;
    selectedSite: string;
    selectedRole: string;
    selectedUserIds: Set<string>;
    onClearSearch: () => void;
    onAddUser: () => void;
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
    onResetPassword: (user: User) => void;
    onToggleSelection: (userId: string) => void;
    onSelectAll: () => void;
    presets: PermissionPreset[];
    onApplyPreset: (userId: string, presetId: string, presetName: string) => void;
    applyingPresetUserId: string | null;
}
```

Body verbatim 1170–1288. Mapping: `(error as Error)?.message`→pakai `error` prop; `refetch()`→`onRetry()`; `setSearchQuery('')`→`onClearSearch()`; `setIsAddUserModalOpen(true)`→`onAddUser()`; handler `handleEditUser`/`handleDeleteUser`/`handleResetPassword`→`onEdit`/`onDelete`/`onResetPassword`; `toggleUserSelection`→`onToggleSelection`; `deferredSearchQuery` prop; inline `onSelectAll` closure (baris 1222–1230) → `onSelectAll` prop. Import `AgentTableSkeleton, ErrorState` dari `./AgentTableSkeletons`, `UnifiedUserTable`, `RoleSection`, icon `Users, RefreshCw, Plus`.

- [ ] **Step 2: Export di barrel.**

- [ ] **Step 3: Ganti di induk** baris 1169–1288 dengan:

```tsx
<UsersByRoleSection
    isLoading={isLoading}
    isError={isError}
    error={error}
    onRetry={() => refetch()}
    filteredUsers={filteredUsers}
    usersByRole={usersByRole}
    displayMode={displayMode}
    searchQuery={searchQuery}
    deferredSearchQuery={deferredSearchQuery}
    selectedSite={selectedSite}
    selectedRole={selectedRole}
    selectedUserIds={selectedUserIds}
    onClearSearch={() => setSearchQuery('')}
    onAddUser={() => setIsAddUserModalOpen(true)}
    onEdit={handleEditUser}
    onDelete={handleDeleteUser}
    onResetPassword={handleResetPassword}
    onToggleSelection={toggleUserSelection}
    onSelectAll={() => {
        const allIds = filteredUsers.map(u => u.id);
        const allSelected = filteredUsers.every(u => selectedUserIds.has(u.id));
        setSelectedUserIds(allSelected ? new Set() : new Set(allIds));
    }}
    presets={presets}
    onApplyPreset={handleApplyPreset}
    applyingPresetUserId={applyingPresetUserId}
/>
```

- [ ] **Step 4: Verifikasi** — typecheck + smoke (cek "No Users Found" empty state masih render).

- [ ] **Step 5: Commit** — `refactor(admin): extract UsersByRoleSection from BentoAdminAgentsPage`

---

## Task 8: Ekstrak `AgentPerformancePanel` (blok terbesar, ~305 baris)

Sumber: baris **862–1167** (`{displayedAgentStats.length > 0 && (...)}` — grid virtualized/standar + tabel performa).

**Files:** Create `.../AgentPerformancePanel.tsx`; Modify `index.ts`, induk 862–1167.

- [ ] **Step 1: Buat komponen.** Ini blok dengan banyak closure ke `users.find(...)` + mutation. Pertahankan perilaku: lewatkan `users` + callback. Props:

```tsx
import type { User, AgentStats } from '@/types/admin.types';

type SortKey = 'fullName' | 'openTickets' | 'inProgressTickets' | 'resolvedThisWeek' | 'resolvedThisMonth' | 'slaCompliance' | 'appraisalPoints' | 'activeWorkloadPoints';

interface AgentPerformancePanelProps {
    displayedAgentStats: AgentStats[];
    filteredAgentStats: AgentStats[];
    viewMode: 'grid' | 'table';
    statsFilter: 'all' | 'active' | 'resolved' | 'top';
    selectedSite: string;
    selectedRole: string;
    users: User[];
    selectedUserIds: Set<string>;
    sortConfig: { key: SortKey; dir: 'asc' | 'desc' };
    onSort: (key: SortKey) => void;
    onToggleSelection: (id: string) => void;
    onViewDetails: (agent: { id: string; fullName: string; email: string; role: string; site?: Site }) => void;
    onEditUser: (id: string) => void;
    onToggleActive: (id: string) => void;
    onResetPassword: (id: string) => void;
}
```

Body verbatim 863–1166. Mapping closure:
- `setSelectedAgentDetail({...})` → `onViewDetails({...})` (kirim objek yang sama).
- `const fullUser = users.find(...); if (fullUser) handleEditUser(fullUser)` → `onEditUser(user.id)` (logika `find`+guard pindah ke handler induk).
- `toggleActiveMutation.mutate({ userId, isActive: !fullUser.isActive })` → `onToggleActive(user.id)`.
- `setSelectedUser(fullUser); setIsResetPasswordOpen(true)` → `onResetPassword(user.id)`.
- `toggleUserSelection`→`onToggleSelection`; `handleSort`→`onSort`.
- `users.find(u => u.id === agent.id)?.isActive` (untuk `isActive` AgentCard) tetap — `users` tersedia sebagai prop.

Import yang dipindah: `VirtualizedAgentGrid`, `{ AgentCard, AgentCardErrorBoundary }`, `{ SITE_COLORS, ROLE_CONFIG }` dari `./agent-utils`, `* as Tooltip`, `cn`, icon `BarChart3, Eye, Info`.

> **Penting (jaga behavior):** handler `onEditUser`/`onToggleActive`/`onResetPassword` di induk harus tetap melakukan `users.find` + guard seperti kode asli, supaya tidak ada perubahan perilaku saat user tidak ditemukan.

- [ ] **Step 2: Export di barrel.**

- [ ] **Step 3: Ganti di induk** baris 862–1167 dengan:

```tsx
<AgentPerformancePanel
    displayedAgentStats={displayedAgentStats}
    filteredAgentStats={filteredAgentStats}
    viewMode={viewMode}
    statsFilter={statsFilter}
    selectedSite={selectedSite}
    selectedRole={selectedRole}
    users={users}
    selectedUserIds={selectedUserIds}
    sortConfig={sortConfig}
    onSort={handleSort}
    onToggleSelection={toggleUserSelection}
    onViewDetails={(agent) => setSelectedAgentDetail({ ...agent, createdAt: '' } as User)}
    onEditUser={(id) => { const u = users.find(u => u.id === id); if (u) handleEditUser(u); }}
    onToggleActive={(id) => { const u = users.find(u => u.id === id); if (u) toggleActiveMutation.mutate({ userId: id, isActive: !u.isActive }); }}
    onResetPassword={(id) => { const u = users.find(u => u.id === id); if (u) { setSelectedUser(u); setIsResetPasswordOpen(true); } }}
/>
```

> Verifikasi tipe objek `onViewDetails` sesuai pemakaian asli (asli mengirim `{ id, fullName, email, role, site, createdAt: '' }`). Sesuaikan agar identik dengan yang lama; jangan tambah/kurang field.

- [ ] **Step 4: Verifikasi** — typecheck + smoke. Karena `displayedAgentStats` kosong di test (agents: []), panel tidak render — tambahkan **satu** test baru yang mem-mock `GET /users/agents/stats` mengembalikan 1 agent dan assert `screen.findByText('Agent Cards')` muncul, untuk menutupi jalur render panel.

```tsx
it('renders performance panel when agents exist', async () => {
    (apiModule.default.get as any).mockImplementation((url: string) => {
        if (url.startsWith('/users/agents/stats')) return Promise.resolve({ data: { summary: {}, agents: [{ id: 'a1', fullName: 'Budi', email: 'b@x.com', role: 'AGENT', site: { code: 'JKT', name: 'Jakarta', id: 's1' }, openTickets: 1, inProgressTickets: 0, resolvedThisWeek: 0, resolvedThisMonth: 2, slaCompliance: 95, appraisalPoints: 0, activeWorkloadPoints: 0 }] } });
        if (url.startsWith('/sites/active')) return Promise.resolve({ data: [{ code: 'JKT', name: 'Jakarta', id: 's1' }] });
        if (url.startsWith('/users')) return Promise.resolve({ data: { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 1, hasNextPage: false, hasPrevPage: false } } });
        return Promise.resolve({ data: {} });
    });
    // render + expect(await screen.findByText('Agent Cards')).toBeInTheDocument();
});
```

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/features/admin/pages/__tests__/BentoAdminAgentsPage.smoke.test.tsx`
Expected: bersih + semua passed.

- [ ] **Step 5: Commit** — `refactor(admin): extract AgentPerformancePanel from BentoAdminAgentsPage`

---

## Task 9: Ekstrak `AgentManagementDialogs` (cluster dialog)

Sumber: baris **1340–1466** + **1505–1516** (semua dialog kecuali keyboard help yang sudah diekstrak): `ImportUsersDialog, AddUserDialog, ResetPasswordDialog, EditUserDialog, AgentDetailModal, ConfirmDialog (×2), BulkRoleChangeDialog, PresetDrawer, ExportPreviewDialog, AgentComparisonDialog, BulkSiteChangeDialog, ExportPdfDialog, OnboardingTutorial`.

**Files:** Create `.../AgentManagementDialogs.tsx`; Modify `index.ts`, induk.

- [ ] **Step 1: Buat komponen container** yang menerima state + handler dialog sebagai props. Karena jumlah prop besar, kelompokkan jadi satu interface eksplisit (tanpa `any`). Sertakan semua boolean open + entity terpilih + handler mutate + data turunan (`agentStats`, `users`, `selectedSite`, `selectedRole`). Body verbatim dari 1340–1466 dan 1505–1516 (gabung berurutan dalam satu fragment), ganti referensi scope → props. Pertahankan komputasi inline `AgentDetailModal.agent` (1367–1383) dan `AgentComparisonDialog.agents` (1441–1457) verbatim, dengan `agentStats`/`users` dari props, serta mutation `deleteMutation`/`bulkDeleteMutation`/`bulkRoleChangeMutation` dilewatkan sebagai handler + flag `isPending`.

Definisikan props sesuai pemakaian aktual (daftar lengkap — turunkan dari baris 1340–1516):
`importOpen, onImportClose, addUserOpen, onAddUserClose, resetPasswordOpen, onResetPasswordClose, selectedUser, editUserOpen, onEditUserClose, editingUser, selectedAgentDetail, onAgentDetailClose, agentStats, confirmDeleteOpen, onConfirmDeleteClose, onConfirmDelete, userToDelete, isDeleting, bulkDeleteOpen, onBulkDeleteClose, onConfirmBulkDelete, selectedCount, isBulkDeleting, bulkRoleOpen, onBulkRoleClose, onConfirmBulkRole, isBulkRolePending, presetManageOpen, onPresetManageClose, exportPreviewOpen, onExportPreviewClose, selectedSite, selectedRole, comparisonOpen, onComparisonClose, comparisonAgents, bulkSiteOpen, onBulkSiteClose, selectedUserIds, pdfExportOpen, onPdfExportClose, totalUsers, showOnboarding, onOnboardingComplete`.

> Ini container besar tapi murni deklaratif. Tujuannya memindah ~140 baris JSX keluar dari induk. Tidak ada logika baru.

- [ ] **Step 2: Export di barrel.**

- [ ] **Step 3: Ganti di induk** baris 1340–1466 dan 1505–1516 dengan satu `<AgentManagementDialogs ... />`, memetakan tiap prop ke state/handler yang ada (mis. `confirmDeleteOpen={isConfirmDeleteOpen}`, `onConfirmDelete={() => { if (userToDelete && !deleteMutation.isPending) deleteMutation.mutate(userToDelete.id); }}`, `isDeleting={deleteMutation.isPending}`, `comparisonAgents={Array.from(selectedUserIds).slice(0,2).map(...)}` — salin komputasi map verbatim dari 1441–1457). Biarkan `<KeyboardShortcutsHelpDialog />` (Task 3) tetap di induk pada posisinya.

- [ ] **Step 4: Verifikasi** — typecheck + smoke. Pastikan tidak ada dialog yang hilang: smoke test render default tidak menampilkan dialog (semua tertutup) → tetap 3+ passed. Hapus import dialog yang kini tak terpakai di induk **hanya** bila typecheck menandai.

- [ ] **Step 5: Commit** — `refactor(admin): extract AgentManagementDialogs cluster from BentoAdminAgentsPage`

---

## Task 10: Verifikasi DoD & finalisasi

- [ ] **Step 1: Cek line count induk turun < 800.**

Run: `wc -l src/features/admin/pages/BentoAdminAgentsPage.tsx`
Expected: < 800 (estimasi ~330–420 baris: logika query/mutation/handler + render tipis). Jika masih > 800, lanjut Task 11 (ekstrak hooks).

- [ ] **Step 2: Jalankan SELURUH test admin + typecheck penuh.**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/features/admin`
Expected: typecheck bersih, semua test passed.

- [ ] **Step 3: Build produksi (smoke build).**

Run: `npm run build`
Expected: `tsc -b` + `vite build` sukses tanpa error.

- [ ] **Step 4: Lint.**

Run: `npm run lint`
Expected: tidak ada error baru pada file yang disentuh.

- [ ] **Step 5: Commit final (jika ada perubahan lint/cleanup).**

```bash
git add -A && git commit -m "chore(admin): finalize BentoAdminAgentsPage split (under 800 LOC)"
```

---

## Task 11 (opsional — hanya jika induk masih > 800 LOC atau ingin kohesi lebih): Ekstrak hooks data & mutation

**Files:**
- Create: `src/features/admin/hooks/useAgentData.ts` + `__tests__/useAgentData.test.tsx`
- Create: `src/features/admin/hooks/useAgentMutations.ts` + `__tests__/useAgentMutations.test.tsx`
- Modify: `BentoAdminAgentsPage.tsx`

- [ ] **Step 1: Tulis test `useAgentData` dulu (RED).** Pola: `renderHook` + `QueryClientProvider` + `vi.mock('@/lib/api')` (lihat Task 1). Assert hook mengembalikan `users`, `agentStats`, `sites`, `dashboardStats` dengan data ter-mock.

```tsx
// useAgentData.test.tsx — mock api.get per-URL spt Task 1, lalu:
// const { result } = renderHook(() => useAgentData({ currentPage:1, pageSize:50, selectedSite:'ALL', deferredSearchQuery:'', selectedRole:'ALL', statsFilter:'all', sortConfig:{key:'resolvedThisMonth',dir:'desc'} }), { wrapper });
// await waitFor(() => expect(result.current.users).toEqual([]));
// expect(result.current.dashboardStats.totalAgents).toBe(0);
```

- [ ] **Step 2: Jalankan test → FAIL** (hook belum ada). Run: `npx vitest run src/features/admin/hooks/__tests__/useAgentData.test.tsx` → Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implementasi `useAgentData(filters)`** — pindahkan verbatim dari induk: query `users` (baris 119–133), `sites` (139–146), `SITES` memo (149–152), AGENT-lock `useEffect` (155–162), query `agentStats` (166–174), `usePermissionPresets` (180), memo `usersByRole` (272–277), `filteredAgentStats` (280–289), `dashboardStats` (292–304), `displayedAgentStats` (307–337), `siteCounts` (342–348). Hook menerima `filters` (semua state filter) sebagai argumen, mengembalikan objek `{ usersResponse, users, paginationMeta, sitesData, SITES, agentStats, presets, usersByRole, filteredAgentStats, dashboardStats, displayedAgentStats, siteCounts, isLoading, isError, error, refetch }`. State filter tetap di komponen induk dan dilewatkan masuk.

- [ ] **Step 4: Jalankan test → PASS.** Run: `npx vitest run src/features/admin/hooks/__tests__/useAgentData.test.tsx` → Expected: PASS.

- [ ] **Step 5: Wire induk ke `useAgentData`,** hapus blok yang dipindah. Jalankan smoke + typecheck. Commit: `refactor(admin): extract useAgentData hook`.

- [ ] **Step 6: Ulangi pola RED→GREEN untuk `useAgentMutations`.** Pindahkan `tableApplyPresetMutation`+`handleApplyPreset` (186–225), `deleteMutation` (350–393), `bulkDeleteMutation` (395–439), `toggleActiveMutation` (492–533), `bulkRoleChangeMutation` (536–558), `handleExportUsers` (451–479). Hook menerima `{ queryClient, cacheKeyParts, setters }` yang dibutuhkan (mis. `setApplyingPresetUserId`, `setIsConfirmDeleteOpen`, `setUserToDelete`, `setSelectedUserIds`, `setIsBulkDeleteOpen`, `setIsBulkRoleChangeOpen`), mengembalikan objek mutation + handler. **Kritis:** pertahankan tuple cache key `['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole]` identik agar optimistic update tidak rusak. Test: assert `delete`/`bulkDelete` memanggil `api.delete`/`api.post` dengan argumen benar (pola `useProcurementDecision.test.tsx`). Commit: `refactor(admin): extract useAgentMutations hook`.

- [ ] **Step 7: Verifikasi akhir** — ulangi Task 10 Step 1–4. Pastikan induk < 800 LOC, semua test + build + lint hijau.

---

## Self-Review (sudah dijalankan penulis plan)

- **Spec coverage:** Tujuan WS3-P1 = pecah file 1521→<800 LOC via ekstraksi murni + smoke test per langkah. Tercakup: Task 1 (jaring pengaman), Task 2–9 (ekstraksi presentational), Task 10 (verifikasi DoD), Task 11 (hooks bila perlu). ✓
- **Placeholder scan:** Body besar dirujuk via rentang baris + konvensi cut-paste eksplisit (bukan "TODO"); semua kontrak props ditulis lengkap; perintah verifikasi konkret dengan expected output. Tidak ada "tambah error handling" tanpa detail. ✓
- **Type consistency:** Nama props & handler konsisten antar task (`onToggleSelection`, `onEditUser`, `selectedUserIds`, `displayedAgentStats`, `sortConfig.key: SortKey`). Tuple cache key dijaga identik di Task 11. ✓
- **Risiko utama:** behavior change pada closure `users.find` di AgentPerformancePanel → dimitigasi dengan menaruh `find`+guard di handler induk (Task 8 Step 3) + test jalur panel (Task 8 Step 4).
