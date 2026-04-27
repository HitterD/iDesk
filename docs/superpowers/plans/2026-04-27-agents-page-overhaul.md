# Agents Page Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve agents page with a slide-over preset drawer, enforce site isolation on ticket assignment, and upgrade export/import with field selection, row validation, upsert mode, and result summary.

**Architecture:** Three independent phases — site isolation (backend filter + frontend labels), preset drawer (replaces double-modal), export/import (6 UX improvements). Each phase is self-contained and can be shipped separately.

**Tech Stack:** NestJS + TypeORM (backend), React + TanStack Query + Radix UI + Tailwind (frontend), Papa Parse (CSV), XLSX (export)

---

## File Map

### Phase 1 — Site Isolation
- **Modify:** `apps/backend/src/modules/users/users.service.ts` — `getAgents(siteId?)` add optional filter + join site
- **Modify:** `apps/backend/src/modules/users/users.controller.ts` — add `SiteGuard`, pass `req.query.siteId`
- **Create:** `apps/frontend/src/features/ticket-board/components/AgentSelectList.tsx` — shared site-labeled agent dropdown content
- **Modify:** `apps/frontend/src/features/ticket-board/pages/BentoTicketDetailPage.tsx` — use AgentSelectList
- **Modify:** `apps/frontend/src/features/ticket-board/components/BentoTicketKanban.tsx` — use AgentSelectList
- **Modify:** `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx` — use AgentSelectList
- **Modify:** `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx` — lock site tabs for AGENT role

### Phase 2 — Preset Drawer
- **Create:** `apps/frontend/src/features/admin/components/PresetDrawer.tsx` — 2-column slide-over
- **Modify:** `apps/frontend/src/features/admin/components/agent-management/PresetDropdown.tsx` — add "Manage Presets" link + hover tooltip
- **Modify:** `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx` — wire PresetDrawer, remove PresetManagementDialog import/state
- **Delete:** `apps/frontend/src/features/admin/components/PresetManagementDialog.tsx`

### Phase 3 — Export/Import
- **Modify:** `apps/frontend/src/features/admin/components/ExportPreviewDialog.tsx` — add field selector checklist
- **Modify:** `apps/backend/src/modules/users/users.service.ts` — dynamic field selection in XLSX export
- **Modify:** `apps/backend/src/modules/users/users.controller.ts` — accept `?fields=` query param
- **Modify:** `apps/frontend/src/features/admin/components/ImportUsersDialog.tsx` — row coloring, mode toggle, result summary
- **Modify:** `apps/backend/src/modules/users/users.service.ts` — upsert mode in `importUsers()`
- **Modify:** `apps/backend/src/modules/users/users.controller.ts` — accept `mode` in import body
- **Modify:** `apps/frontend/src/features/admin/components/PresetDrawer.tsx` — export/import JSON buttons
- **Create:** `apps/backend/src/modules/permissions/dto/import-presets.dto.ts`
- **Modify:** `apps/backend/src/modules/permissions/permissions.controller.ts` — `POST /permissions/presets/import`

---

## Phase 1: Site Isolation

### Task 1: Backend — getAgents() dengan site filter

**Files:**
- Modify: `apps/backend/src/modules/users/users.service.ts`

- [ ] **Step 1: Update `getAgents()` signature dan query**

Ganti blok `async getAgents()` yang ada (sekitar baris 506) dengan:

```typescript
async getAgents(siteId?: string): Promise<User[]> {
    const qb = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.site', 'site')
        .where('user.isActive = :isActive', { isActive: true })
        .andWhere('user.role IN (:...roles)', {
            roles: [UserRole.AGENT, UserRole.ADMIN],
        })
        .select([
            'user.id', 'user.fullName', 'user.email', 'user.role',
            'user.avatarUrl', 'user.siteId', 'user.appraisalPoints',
            'site.id', 'site.code', 'site.name',
        ])
        .orderBy('user.fullName', 'ASC');

    if (siteId) {
        qb.andWhere('user.siteId = :siteId', { siteId });
    }

    return qb.getMany();
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/backend/src/modules/users/users.service.ts
rtk git commit -m "feat(users): add optional siteId filter to getAgents with site relation"
```

---

### Task 2: Backend — Controller add SiteGuard

**Files:**
- Modify: `apps/backend/src/modules/users/users.controller.ts`

- [ ] **Step 1: Tambah SiteGuard import**

Di bagian atas file, tambah import:
```typescript
import { SiteGuard } from '../sites/guards/site.guard';
```

- [ ] **Step 2: Ganti dekorator dan signature `getAgents()`**

Ganti method `getAgents()` yang ada:
```typescript
@Get('agents')
@UseGuards(JwtAuthGuard, RolesGuard, SiteGuard)
@Roles(UserRole.ADMIN, UserRole.AGENT)
@ApiOperation({ summary: 'Get agents, auto-filtered by site for AGENT role' })
@ApiResponse({ status: 200, description: 'Return agents.' })
async getAgents(@Request() req) {
    return this.usersService.getAgents(req.query.siteId);
}
```

Catatan: `SiteGuard` sudah auto-inject `req.query.siteId` dari JWT token untuk role AGENT. ADMIN mendapat `siteId = undefined` → service return semua.

- [ ] **Step 3: Verifikasi import `@Request` sudah ada**

Cek baris import NestJS di atas file ada `Request`:
```typescript
import { ..., Request } from '@nestjs/common';
```
Jika belum ada, tambahkan `Request` ke import yang ada.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/backend/src/modules/users/users.controller.ts
rtk git commit -m "feat(users): enforce SiteGuard on getAgents endpoint"
```

---

### Task 3: Frontend — AgentSelectList shared component

**Files:**
- Create: `apps/frontend/src/features/ticket-board/components/AgentSelectList.tsx`

- [ ] **Step 1: Buat file komponen**

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: { code: string; name: string };
}

const SITE_BADGE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    SMG: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

interface AgentSelectListProps {
    agents: Agent[];
    selectedId?: string | null;
    isAdmin: boolean;
    onSelect: (agentId: string) => void;
    searchQuery?: string;
}

export const AgentSelectList: React.FC<AgentSelectListProps> = ({
    agents,
    selectedId,
    isAdmin,
    onSelect,
    searchQuery = '',
}) => {
    const filtered = searchQuery.trim()
        ? agents.filter(a =>
            a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.email.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : agents;

    if (!isAdmin) {
        // Non-admin: show site header + flat list
        const siteCode = agents[0]?.site?.code;
        return (
            <div>
                {siteCode && (
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-[hsl(var(--border))]">
                        Site {siteCode} • {filtered.length} agent{filtered.length !== 1 ? 's' : ''}
                    </div>
                )}
                {filtered.map(agent => (
                    <AgentRow
                        key={agent.id}
                        agent={agent}
                        selected={selectedId === agent.id}
                        onSelect={onSelect}
                        showBadge
                    />
                ))}
                {filtered.length === 0 && (
                    <div className="px-3 py-6 text-center text-sm text-slate-400">
                        Tidak ada agent ditemukan
                    </div>
                )}
            </div>
        );
    }

    // Admin: group by site
    const groups = filtered.reduce<Record<string, Agent[]>>((acc, agent) => {
        const code = agent.site?.code || 'Unassigned';
        if (!acc[code]) acc[code] = [];
        acc[code].push(agent);
        return acc;
    }, {});

    return (
        <div>
            {Object.entries(groups).map(([siteCode, siteAgents]) => (
                <div key={siteCode}>
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-[hsl(var(--border))]">
                        {siteCode === 'Unassigned' ? 'No Site' : `── ${siteCode} ──`} • {siteAgents.length}
                    </div>
                    {siteAgents.map(agent => (
                        <AgentRow
                            key={agent.id}
                            agent={agent}
                            selected={selectedId === agent.id}
                            onSelect={onSelect}
                            showBadge
                        />
                    ))}
                </div>
            ))}
            {filtered.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-slate-400">
                    Tidak ada agent ditemukan
                </div>
            )}
        </div>
    );
};

const AgentRow: React.FC<{
    agent: Agent;
    selected: boolean;
    onSelect: (id: string) => void;
    showBadge: boolean;
}> = ({ agent, selected, onSelect, showBadge }) => {
    const siteCode = agent.site?.code;
    const initials = agent.fullName
        .split(' ')
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase();

    return (
        <button
            type="button"
            onClick={() => onSelect(agent.id)}
            className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100',
                'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                selected && 'bg-blue-50 dark:bg-blue-900/20'
            )}
        >
            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                {agent.avatarUrl ? (
                    <img src={agent.avatarUrl} className="w-7 h-7 rounded-full object-cover" alt="" />
                ) : initials}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-white truncate">{agent.fullName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{agent.email}</div>
            </div>
            {showBadge && siteCode && (
                <span className={cn(
                    'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                    SITE_BADGE_COLORS[siteCode] || 'bg-slate-100 text-slate-600'
                )}>
                    {siteCode}
                </span>
            )}
            {selected && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            )}
        </button>
    );
};
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/frontend/src/features/ticket-board/components/AgentSelectList.tsx
rtk git commit -m "feat(ticket-board): add AgentSelectList with site labels and admin grouping"
```

---

### Task 4: Frontend — Wire AgentSelectList ke ticket pages

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoTicketDetailPage.tsx`
- Modify: `apps/frontend/src/features/ticket-board/components/BentoTicketKanban.tsx`
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx`

- [ ] **Step 1: BentoTicketDetailPage — import dan gunakan AgentSelectList**

Tambah import di `BentoTicketDetailPage.tsx`:
```tsx
import { AgentSelectList } from '../components/AgentSelectList';
import { useAuth } from '@/stores/useAuth';
```

Di dalam komponen, tambah:
```tsx
const { user } = useAuth();
const isAdmin = user?.role === 'ADMIN';
```

Cari tempat agents di-render dalam select/dropdown untuk assignment. Ganti konten dropdown agent dengan:
```tsx
<AgentSelectList
    agents={agents}
    selectedId={ticket.assignedToId}
    isAdmin={isAdmin}
    onSelect={(agentId) => handleFieldChange('assignedToId', agentId)}
/>
```

- [ ] **Step 2: BentoTicketKanban — import dan gunakan AgentSelectList**

Tambah import di `BentoTicketKanban.tsx`:
```tsx
import { AgentSelectList } from './AgentSelectList';
import { useAuth } from '@/stores/useAuth';
```

Di dalam komponen:
```tsx
const { user } = useAuth();
const isAdmin = user?.role === 'ADMIN';
```

Ganti render agent list dalam assignment popover/dropdown dengan `AgentSelectList`:
```tsx
<AgentSelectList
    agents={agents}
    selectedId={/* current assignee id */}
    isAdmin={isAdmin}
    onSelect={(agentId) => handleAssign(ticketId, agentId)}
/>
```

- [ ] **Step 3: BentoTicketListPage — import dan gunakan AgentSelectList**

Tambah import di `BentoTicketListPage.tsx`:
```tsx
import { AgentSelectList } from '../components/AgentSelectList';
import { useAuth } from '@/stores/useAuth';
```

Di dalam komponen:
```tsx
const { user } = useAuth();
const isAdmin = user?.role === 'ADMIN';
```

Ganti agent select content dengan `AgentSelectList`.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/frontend/src/features/ticket-board/pages/BentoTicketDetailPage.tsx
rtk git add apps/frontend/src/features/ticket-board/components/BentoTicketKanban.tsx
rtk git add apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx
rtk git commit -m "feat(ticket-board): use AgentSelectList with site isolation on all ticket pages"
```

---

### Task 5: Frontend — Lock site tabs untuk AGENT role di agents page

**Files:**
- Modify: `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx`

- [ ] **Step 1: Tambah import useAuth dan deteksi role**

Cari import `useAuth` di `BentoAdminAgentsPage.tsx`. Jika belum ada:
```tsx
import { useAuth } from '@/stores/useAuth';
```

Di dalam komponen (dekat deklarasi state yang ada):
```tsx
const { user: currentUser } = useAuth();
const isAgentRole = currentUser?.role === 'AGENT';
const currentSiteCode = currentUser?.site?.code || '';
```

- [ ] **Step 2: Disable tab site lain untuk AGENT**

Cari blok `SITES.map((site) => (` di render site tabs. Update `Tabs.Trigger` untuk AGENT:

```tsx
{SITES.map((site) => {
    const isDisabledForAgent = isAgentRole && site.code !== 'ALL' && site.code !== currentSiteCode;
    return (
        <Tabs.Trigger
            key={site.code}
            value={site.code}
            disabled={isDisabledForAgent}
            title={isDisabledForAgent ? `Anda hanya dapat melihat site ${currentSiteCode}` : undefined}
            className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150",
                "data-[state=active]:bg-[hsl(var(--card))] data-[state=active]:shadow-sm",
                "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white",
                isDisabledForAgent && "opacity-30 cursor-not-allowed pointer-events-none"
            )}
        >
            <MapPin className="w-3.5 h-3.5" />
            {site.code}
            <span className="px-1.5 py-0.5 text-[10px] rounded-sm bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold">
                {siteCounts[site.code] || 0}
            </span>
        </Tabs.Trigger>
    );
})}
```

- [ ] **Step 3: Auto-set site saat AGENT login**

Cari `useEffect` atau initial state untuk `selectedSite`. Tambah effect:
```tsx
useEffect(() => {
    if (isAgentRole && currentSiteCode) {
        setSelectedSite(currentSiteCode);
    }
}, [isAgentRole, currentSiteCode]);
```

- [ ] **Step 4: Commit**

```bash
rtk git add apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx
rtk git commit -m "feat(agents): lock site tabs and auto-filter for AGENT role"
```

---

## Phase 2: Preset Drawer

### Task 6: Create PresetDrawer component

**Files:**
- Create: `apps/frontend/src/features/admin/components/PresetDrawer.tsx`

- [ ] **Step 1: Buat file PresetDrawer**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Search, Copy, Trash2, Save, ChevronRight, Sparkles } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import {
    USER_PAGES, AGENT_PAGES, MANAGER_PAGES, getPagesForRole, getDefaultPageAccess,
    type TargetRole, type PageDefinition
} from '@/lib/pageDefinitions';
import { PermissionPreset } from './agent-management/agent-types';
import { PRESET_COLORS } from './agent-management/agent-utils';

interface PageAccess { [pageKey: string]: boolean; }

interface PresetDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PresetDrawer: React.FC<PresetDrawerProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

    // Editor state
    const [editorName, setEditorName] = useState('');
    const [editorDescription, setEditorDescription] = useState('');
    const [editorRole, setEditorRole] = useState<TargetRole>('AGENT');
    const [editorPageAccess, setEditorPageAccess] = useState<PageAccess>({});
    const [isDirty, setIsDirty] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Fetch presets
    const { data: presets = [], isLoading } = useQuery<PermissionPreset[]>({
        queryKey: ['permission-presets'],
        queryFn: async () => (await api.get('/permissions/presets')).data,
        enabled: isOpen,
    });

    const selectedPreset = presets.find(p => p.id === selectedPresetId) || null;

    // Load preset into editor
    const loadPreset = useCallback((preset: PermissionPreset) => {
        setSelectedPresetId(preset.id);
        setEditorName(preset.name);
        setEditorDescription(preset.description || '');
        setEditorRole(preset.targetRole || 'AGENT');
        const pages = getPagesForRole(preset.targetRole || 'AGENT');
        const access: PageAccess = {};
        pages.forEach(p => { access[p.key] = preset.pageAccess?.[p.key] ?? true; });
        setEditorPageAccess(access);
        setIsDirty(false);
    }, []);

    // New preset
    const handleNewPreset = () => {
        if (isDirty && !confirm('Ada perubahan yang belum disimpan. Lanjutkan?')) return;
        setSelectedPresetId(null);
        setEditorName('');
        setEditorDescription('');
        setEditorRole('AGENT');
        const pages = getPagesForRole('AGENT');
        const access: PageAccess = {};
        pages.forEach(p => { access[p.key] = true; });
        setEditorPageAccess(access);
        setIsDirty(false);
    };

    // Switch preset with dirty guard
    const handleSelectPreset = (preset: PermissionPreset) => {
        if (isDirty && !confirm('Ada perubahan yang belum disimpan. Lanjutkan?')) return;
        loadPreset(preset);
    };

    // Save mutation (create or update)
    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                name: editorName,
                description: editorDescription,
                targetRole: editorRole,
                pageAccess: editorPageAccess,
            };
            if (selectedPresetId) {
                return api.patch(`/permissions/presets/${selectedPresetId}`, payload);
            }
            return api.post('/permissions/presets', payload);
        },
        onSuccess: (res) => {
            toast.success(selectedPresetId ? 'Preset diperbarui' : 'Preset dibuat');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
            setSelectedPresetId(res.data.id);
            setIsDirty(false);
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menyimpan preset'),
    });

    // Clone mutation
    const cloneMutation = useMutation({
        mutationFn: async (preset: PermissionPreset) =>
            api.post(`/permissions/presets/${preset.id}/clone`, { name: `${preset.name} (Copy)` }),
        onSuccess: () => {
            toast.success('Preset digandakan');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menggandakan'),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/permissions/presets/${id}`),
        onSuccess: () => {
            toast.success('Preset dihapus');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
            if (selectedPresetId === deletingId) {
                setSelectedPresetId(null);
                setIsDirty(false);
            }
            setDeletingId(null);
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menghapus'),
    });

    // Keyboard: Escape closes, Ctrl+S saves
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { if (!isDirty || confirm('Ada perubahan belum disimpan. Tutup?')) onClose(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (isDirty) saveMutation.mutate(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, isDirty, onClose]);

    const filteredPresets = searchQuery.trim()
        ? presets.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : presets;

    const pages = getPagesForRole(editorRole);

    if (!isOpen) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={() => { if (!isDirty || confirm('Ada perubahan belum disimpan. Tutup?')) onClose(); }}
            />
            {/* Drawer panel */}
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[800px] shadow-2xl animate-in slide-in-from-right duration-300">
                {/* Left: Preset list */}
                <div className="w-[280px] flex flex-col bg-slate-50 dark:bg-slate-900 border-r border-[hsl(var(--border))]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(var(--border))]">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <h2 className="font-bold text-slate-800 dark:text-white text-sm">Presets</h2>
                            <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">
                                {presets.length}
                            </span>
                        </div>
                        <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Cari preset..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--border))] bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                    </div>

                    {/* New preset button */}
                    <button
                        onClick={handleNewPreset}
                        className="flex items-center gap-2 mx-3 my-2 px-3 py-2 rounded-lg border border-dashed border-[hsl(var(--border))] text-sm text-primary hover:bg-primary/5 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Preset Baru
                    </button>

                    {/* Preset list */}
                    <div className="flex-1 overflow-y-auto px-2 pb-2">
                        {isLoading ? (
                            <div className="space-y-2 p-2">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="h-14 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
                                ))}
                            </div>
                        ) : filteredPresets.map((preset, idx) => {
                            const color = PRESET_COLORS[idx % PRESET_COLORS.length];
                            const isSelected = preset.id === selectedPresetId;
                            return (
                                <div
                                    key={preset.id}
                                    className={cn(
                                        'group relative flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-all duration-150 mb-1',
                                        isSelected
                                            ? 'bg-white dark:bg-slate-800 shadow-sm border border-[hsl(var(--border))]'
                                            : 'hover:bg-white dark:hover:bg-slate-800/60'
                                    )}
                                    onClick={() => handleSelectPreset(preset)}
                                >
                                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', color)} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-slate-800 dark:text-white truncate">{preset.name}</div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                            {preset.targetRole || 'All'} • {preset.usageCount ?? 0} users
                                        </div>
                                    </div>
                                    {/* Row actions — visible on hover */}
                                    <div className="hidden group-hover:flex items-center gap-1">
                                        <button
                                            onClick={e => { e.stopPropagation(); cloneMutation.mutate(preset); }}
                                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                            title="Gandakan"
                                        >
                                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                                        </button>
                                        {!preset.isSystem && (
                                            <button
                                                onClick={e => { e.stopPropagation(); setDeletingId(preset.id); }}
                                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                title="Hapus"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                            </button>
                                        )}
                                    </div>
                                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />}
                                </div>
                            );
                        })}
                        {!isLoading && filteredPresets.length === 0 && (
                            <div className="text-center text-sm text-slate-400 py-8">Tidak ada preset</div>
                        )}
                    </div>
                </div>

                {/* Right: Editor */}
                <div className="flex-1 flex flex-col bg-[hsl(var(--card))]">
                    {selectedPresetId === null && !editorName ? (
                        // Empty state
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                            <Sparkles className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                ← Pilih preset untuk diedit<br />atau buat preset baru
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Editor header */}
                            <div className="px-6 py-4 border-b border-[hsl(var(--border))]">
                                <input
                                    value={editorName}
                                    onChange={e => { setEditorName(e.target.value); setIsDirty(true); }}
                                    placeholder="Nama preset..."
                                    className="w-full text-xl font-bold bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder-slate-300"
                                />
                                <input
                                    value={editorDescription}
                                    onChange={e => { setEditorDescription(e.target.value); setIsDirty(true); }}
                                    placeholder="Deskripsi (opsional)..."
                                    className="w-full mt-1 text-sm bg-transparent border-none outline-none text-slate-500 dark:text-slate-400 placeholder-slate-300"
                                />
                                {/* Target role selector */}
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Role:</span>
                                    {(['AGENT', 'ADMIN', 'USER'] as TargetRole[]).map(role => (
                                        <button
                                            key={role}
                                            onClick={() => {
                                                setEditorRole(role);
                                                const newPages = getPagesForRole(role);
                                                const access: PageAccess = {};
                                                newPages.forEach(p => { access[p.key] = true; });
                                                setEditorPageAccess(access);
                                                setIsDirty(true);
                                            }}
                                            className={cn(
                                                'px-2.5 py-1 rounded-full text-xs font-semibold transition-colors',
                                                editorRole === role
                                                    ? 'bg-primary text-white'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                            )}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Page access toggles */}
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Akses Halaman</h3>
                                <div className="space-y-1">
                                    {pages.map(page => (
                                        <label
                                            key={page.key}
                                            className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{page.label}</span>
                                                {page.adminOnly && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold">Admin Only</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={editorPageAccess[page.key] ?? false}
                                                onClick={() => {
                                                    setEditorPageAccess(prev => ({ ...prev, [page.key]: !prev[page.key] }));
                                                    setIsDirty(true);
                                                }}
                                                className={cn(
                                                    'relative w-10 h-5.5 rounded-full transition-colors duration-200 shrink-0',
                                                    editorPageAccess[page.key]
                                                        ? 'bg-primary'
                                                        : 'bg-slate-200 dark:bg-slate-700'
                                                )}
                                            >
                                                <span className={cn(
                                                    'absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200',
                                                    editorPageAccess[page.key] ? 'translate-x-5' : 'translate-x-0.5'
                                                )} />
                                            </button>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Footer actions */}
                            <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex items-center justify-between">
                                <span className="text-xs text-slate-400">{isDirty ? '● Perubahan belum disimpan' : 'Tersimpan'}</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { if (selectedPreset) loadPreset(selectedPreset); else handleNewPreset(); }}
                                        disabled={!isDirty}
                                        className="px-4 py-2 text-sm rounded-lg border border-[hsl(var(--border))] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={() => saveMutation.mutate()}
                                        disabled={!isDirty || !editorName.trim() || saveMutation.isPending}
                                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                    >
                                        <Save className="w-4 h-4" />
                                        {saveMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Delete confirmation — inline (no second modal) */}
            {deletingId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setDeletingId(null)} />
                    <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Hapus Preset?</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Preset <strong>"{presets.find(p => p.id === deletingId)?.name}"</strong> akan dihapus permanen.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setDeletingId(null)} className="flex-1 px-4 py-2 border border-[hsl(var(--border))] rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                Batal
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deletingId)}
                                disabled={deleteMutation.isPending}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>,
        document.body
    );
};
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/frontend/src/features/admin/components/PresetDrawer.tsx
rtk git commit -m "feat(admin): add PresetDrawer 2-column slide-over replacing double-modal preset management"
```

---

### Task 7: Update PresetDropdown — "Manage Presets" link

**Files:**
- Modify: `apps/frontend/src/features/admin/components/agent-management/PresetDropdown.tsx`

- [ ] **Step 1: Tambah prop dan "Manage Presets" link**

Ganti interface props:
```tsx
export const PresetDropdown: React.FC<{
    user: User;
    presets: PermissionPreset[];
    onApplyPreset: (userId: string, presetId: string, presetName: string) => void;
    isApplying?: boolean;
    onManagePresets?: () => void;   // NEW
}> = ({ user, presets, onApplyPreset, isApplying, onManagePresets }) => {
```

Di akhir dropdown content (sebelum `</div>` penutup portal), tambah:
```tsx
{onManagePresets && (
    <div className="border-t border-[hsl(var(--border))] mt-1 pt-1">
        <button
            onClick={() => { setOpen(false); onManagePresets(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-primary/5 rounded-lg transition-colors font-medium"
        >
            <Settings className="w-3.5 h-3.5" />
            Kelola Presets →
        </button>
    </div>
)}
```

Tambah `Settings` ke import lucide-react.

- [ ] **Step 2: Commit**

```bash
rtk git add apps/frontend/src/features/admin/components/agent-management/PresetDropdown.tsx
rtk git commit -m "feat(preset-dropdown): add Manage Presets link to open PresetDrawer"
```

---

### Task 8: Wire PresetDrawer ke BentoAdminAgentsPage

**Files:**
- Modify: `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx`

- [ ] **Step 1: Ganti import PresetManagementDialog dengan PresetDrawer**

Hapus:
```tsx
import { PresetManagementDialog } from '../components/PresetManagementDialog';
```

Tambah:
```tsx
import { PresetDrawer } from '../components/PresetDrawer';
```

- [ ] **Step 2: Ganti state management**

Cari `isPresetManagementOpen` atau state serupa. Ganti/tambah:
```tsx
const [isPresetDrawerOpen, setIsPresetDrawerOpen] = useState(false);
```

- [ ] **Step 3: Ganti render PresetManagementDialog dengan PresetDrawer**

Cari `<PresetManagementDialog` dan ganti dengan:
```tsx
<PresetDrawer
    isOpen={isPresetDrawerOpen}
    onClose={() => setIsPresetDrawerOpen(false)}
/>
```

- [ ] **Step 4: Update semua RoleSection dan UnifiedUserTable — pass onManagePresets**

Cari semua `<PresetDropdown` yang di-render (biasanya via RoleSection props). Pastikan `onManagePresets` di-pass:
```tsx
onApplyPreset={handleApplyPreset}
// tambahkan:
// onManagePresets prop diteruskan ke PresetDropdown via RoleSection/UnifiedUserTable
```

Di `RoleSection.tsx` dan `UnifiedUserTable.tsx`, teruskan prop `onManagePresets` ke `PresetDropdown`.

- [ ] **Step 5: Hapus PresetManagementDialog**

```bash
rm apps/frontend/src/features/admin/components/PresetManagementDialog.tsx
```

- [ ] **Step 6: Commit**

```bash
rtk git add apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx
rtk git add apps/frontend/src/features/admin/components/agent-management/RoleSection.tsx
rtk git add apps/frontend/src/features/admin/components/agent-management/UnifiedUserTable.tsx
rtk git commit -m "feat(agents): replace PresetManagementDialog with PresetDrawer, wire onManagePresets"
```

---

## Phase 3: Export/Import

### Task 9: ExportPreviewDialog — Field selector

**Files:**
- Modify: `apps/frontend/src/features/admin/components/ExportPreviewDialog.tsx`

- [ ] **Step 1: Tambah field selector state dan UI**

Tambah konstanta field yang bisa dipilih di atas komponen:
```tsx
const EXPORT_FIELDS = [
    { key: 'fullName', label: 'Nama Lengkap', default: true },
    { key: 'email', label: 'Email', default: true },
    { key: 'role', label: 'Role', default: true },
    { key: 'siteCode', label: 'Site', default: true },
    { key: 'employeeId', label: 'Employee ID', default: true },
    { key: 'jobTitle', label: 'Jabatan', default: true },
    { key: 'phoneNumber', label: 'No. Telepon', default: false },
    { key: 'isActive', label: 'Status Aktif', default: true },
    { key: 'appliedPresetName', label: 'Preset Aktif', default: false },
    { key: 'department', label: 'Departemen', default: false },
] as const;
```

Tambah state di dalam komponen:
```tsx
const [selectedFields, setSelectedFields] = useState<Set<string>>(
    () => new Set(EXPORT_FIELDS.filter(f => f.default).map(f => f.key))
);
```

Toggle field:
```tsx
const toggleField = (key: string) => {
    setSelectedFields(prev => {
        const next = new Set(prev);
        if (next.has(key)) { next.delete(key); } else { next.add(key); }
        return next;
    });
};
```

- [ ] **Step 2: Tambah UI checklist sebelum tombol download**

Di dalam render, sebelum tombol download, tambah section:
```tsx
<div className="border-t border-[hsl(var(--border))] pt-4 mt-4">
    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pilih Field yang Di-export</h4>
    <div className="grid grid-cols-2 gap-1.5">
        {EXPORT_FIELDS.map(field => (
            <label key={field.key} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <input
                    type="checkbox"
                    checked={selectedFields.has(field.key)}
                    onChange={() => toggleField(field.key)}
                    className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{field.label}</span>
            </label>
        ))}
    </div>
</div>
```

- [ ] **Step 3: Pass fields ke download request**

Update fungsi download (cari `handleExport` atau `handleDownload`):
```tsx
const fields = Array.from(selectedFields).join(',');
const res = await api.get(
    `/users/export?format=${format}&site=${siteFilter}&fields=${fields}`,
    { responseType: format === 'xlsx' ? 'blob' : 'json' }
);
```

- [ ] **Step 4: Commit**

```bash
rtk git add apps/frontend/src/features/admin/components/ExportPreviewDialog.tsx
rtk git commit -m "feat(export): add field selector checklist to ExportPreviewDialog"
```

---

### Task 10: Backend — Dynamic field selection in export

**Files:**
- Modify: `apps/backend/src/modules/users/users.service.ts`
- Modify: `apps/backend/src/modules/users/users.controller.ts`

- [ ] **Step 1: Update controller export endpoint**

Cari endpoint export di `users.controller.ts` (sekitar baris 196):
```typescript
@Get('export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async exportUsers(
    @Res() res: Response,
    @Query('format') format: string = 'xlsx',
    @Query('site') site: string = 'ALL',
    @Query('fields') fields?: string,   // NEW
) {
    const selectedFields = fields ? fields.split(',') : undefined;
    const buffer = await this.usersService.exportUsersXlsx(site, selectedFields);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=users_${site}_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
}
```

- [ ] **Step 2: Update service exportUsersXlsx**

Cari method `exportUsersXlsx` di `users.service.ts`. Ganti signature dan implementasi field selection:

```typescript
async exportUsersXlsx(site: string = 'ALL', selectedFields?: string[]): Promise<Buffer> {
    // All available columns
    const ALL_COLUMNS: Record<string, { header: string; getValue: (u: User) => any }> = {
        fullName:         { header: 'Nama Lengkap',  getValue: u => u.fullName },
        email:            { header: 'Email',          getValue: u => u.email },
        role:             { header: 'Role',           getValue: u => u.role },
        siteCode:         { header: 'Site',           getValue: u => u.site?.code || '' },
        employeeId:       { header: 'Employee ID',    getValue: u => u.employeeId || '' },
        jobTitle:         { header: 'Jabatan',        getValue: u => u.jobTitle || '' },
        phoneNumber:      { header: 'No. Telepon',    getValue: u => u.phoneNumber || '' },
        isActive:         { header: 'Status',         getValue: u => u.isActive ? 'Aktif' : 'Tidak Aktif' },
        appliedPresetName:{ header: 'Preset',         getValue: u => u.appliedPresetName || '' },
        department:       { header: 'Departemen',     getValue: u => u.department?.name || '' },
    };

    const DEFAULT_FIELDS = ['fullName', 'email', 'role', 'siteCode', 'employeeId', 'jobTitle', 'isActive'];
    const fields = selectedFields?.length ? selectedFields : DEFAULT_FIELDS;
    const columns = fields.filter(f => ALL_COLUMNS[f]).map(f => ({ key: f, ...ALL_COLUMNS[f] }));

    // Fetch users (existing query logic, keep as-is)
    const qb = this.userRepo.createQueryBuilder('user')
        .leftJoinAndSelect('user.site', 'site')
        .leftJoinAndSelect('user.department', 'department')
        .where('user.isActive = :isActive', { isActive: true });
    if (site !== 'ALL') {
        qb.andWhere('site.code = :site', { site });
    }
    const users = await qb.getMany();

    // Build worksheet rows
    const worksheetData = [
        columns.map(c => c.header),
        ...users.map(u => columns.map(c => c.getValue(u))),
    ];

    // Use existing xlsx library (import from wherever it's used in the file)
    const XLSX = require('xlsx');
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
```

- [ ] **Step 3: Commit**

```bash
rtk git add apps/backend/src/modules/users/users.service.ts apps/backend/src/modules/users/users.controller.ts
rtk git commit -m "feat(users): dynamic field selection in XLSX export via ?fields= query param"
```

---

### Task 11: ImportUsersDialog — Row color validation

**Files:**
- Modify: `apps/frontend/src/features/admin/components/ImportUsersDialog.tsx`

- [ ] **Step 1: Tambah row status ke preview data**

Cari interface atau type untuk row data di `ImportUsersDialog.tsx`. Tambah field `_status`:
```tsx
interface ValidatedRow {
    // existing fields...
    _status: 'ok' | 'warning' | 'error';
    _errors: string[];
    _warnings: string[];
}
```

Update fungsi `validateRow` untuk mengisi `_status`, `_errors`, `_warnings` per baris. Contoh:
```tsx
const validateRow = (row: ParsedRow, idx: number): ValidatedRow => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push('Email tidak valid');
    }
    if (!row.role || !['USER', 'AGENT', 'ADMIN'].includes(row.role.toUpperCase())) {
        errors.push(`Role tidak valid: "${row.role}"`);
    }
    if (!row.fullName?.trim()) {
        errors.push('Nama lengkap wajib diisi');
    }
    // Warning: email mungkin sudah ada (tidak bisa dicek client-side, tapi bisa ditandai jika ada duplikat dalam file)
    const isDuplicateInFile = /* cek apakah email sudah muncul sebelumnya di batch */ false;
    if (isDuplicateInFile) warnings.push('Email duplikat dalam file');

    return {
        ...row,
        _status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
        _errors: errors,
        _warnings: warnings,
    };
};
```

- [ ] **Step 2: Tambah counter bar di atas preview table**

Di atas tabel preview, tambah:
```tsx
{previewData.length > 0 && (() => {
    const okCount = previewData.filter(r => r._status === 'ok').length;
    const warnCount = previewData.filter(r => r._status === 'warning').length;
    const errCount = previewData.filter(r => r._status === 'error').length;
    return (
        <div className="flex items-center gap-3 mb-3 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {okCount} OK
            </span>
            {warnCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {warnCount} Warning
                </span>
            )}
            {errCount > 0 && (
                <span className="flex items-center gap-1.5 text-red-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {errCount} Error
                </span>
            )}
            {errCount > 0 && (
                <button
                    onClick={() => {
                        const firstErr = document.querySelector('[data-row-status="error"]');
                        firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="ml-auto text-xs text-primary underline"
                >
                    Scroll ke error
                </button>
            )}
        </div>
    );
})()}
```

- [ ] **Step 3: Tambah warna per baris di tabel**

Di render row tabel, tambah class berdasarkan `_status`:
```tsx
<tr
    key={idx}
    data-row-status={row._status}
    className={cn(
        'border-b border-[hsl(var(--border))] transition-colors',
        row._status === 'error' && 'bg-red-50 dark:bg-red-900/10',
        row._status === 'warning' && 'bg-amber-50 dark:bg-amber-900/10',
        row._status === 'ok' && 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
    )}
>
```

Tambah kolom status di awal baris:
```tsx
<td className="px-2 py-2 text-center">
    {row._status === 'error' && (
        <span title={row._errors.join(', ')} className="text-red-500 cursor-help">✗</span>
    )}
    {row._status === 'warning' && (
        <span title={row._warnings.join(', ')} className="text-amber-500 cursor-help">⚠</span>
    )}
    {row._status === 'ok' && <span className="text-emerald-500">✓</span>}
</td>
```

- [ ] **Step 4: Commit**

```bash
rtk git add apps/frontend/src/features/admin/components/ImportUsersDialog.tsx
rtk git commit -m "feat(import): add per-row color validation with error/warning/ok status"
```

---

### Task 12: ImportUsersDialog — Mode toggle + Backend upsert

**Files:**
- Modify: `apps/frontend/src/features/admin/components/ImportUsersDialog.tsx`
- Modify: `apps/backend/src/modules/users/users.service.ts`
- Modify: `apps/backend/src/modules/users/users.controller.ts`

- [ ] **Step 1: Tambah mode state di frontend**

```tsx
const [importMode, setImportMode] = useState<'create' | 'upsert'>('create');
```

Di step preview (sebelum tombol confirm), tambah toggle:
```tsx
<div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-[hsl(var(--border))]">
    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mode Import:</span>
    <label className="flex items-center gap-2 cursor-pointer">
        <input
            type="radio" name="importMode" value="create"
            checked={importMode === 'create'}
            onChange={() => setImportMode('create')}
        />
        <span className="text-sm">Tambah baru saja</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
        <input
            type="radio" name="importMode" value="upsert"
            checked={importMode === 'upsert'}
            onChange={() => setImportMode('upsert')}
        />
        <span className="text-sm">Tambah + Update yang ada</span>
    </label>
</div>
```

- [ ] **Step 2: Pass mode ke API call**

Cari fungsi submit/import di frontend. Update FormData atau request body:
```tsx
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('mode', importMode);  // NEW
await api.post('/users/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});
```

- [ ] **Step 3: Backend controller — terima mode parameter**

Di `users.controller.ts`, cari endpoint `POST /users/import`. Update untuk terima `mode`:
```typescript
@Post('import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@UseInterceptors(FileInterceptor('file'))
async importUsers(
    @UploadedFile() file: Express.Multer.File,
    @Body('mode') mode: 'create' | 'upsert' = 'create',
) {
    return this.usersService.importUsers(file, mode);
}
```

- [ ] **Step 4: Backend service — upsert logic**

Di `users.service.ts`, update `importUsers(file, mode)` signature dan tambah upsert logic. Cari bagian dimana user di-create (setelah validasi CSV rows). Tambah kondisi:

```typescript
async importUsers(file: Express.Multer.File, mode: 'create' | 'upsert' = 'create'): Promise<any> {
    // ... existing CSV parse logic stays the same ...

    // Ganti bagian create user dengan:
    const results = { created: 0, updated: 0, failed: 0, errors: [] as any[] };

    for (const row of validRows) {
        try {
            const existing = await this.userRepo.findOne({ where: { email: row.email } });

            if (existing) {
                if (mode === 'upsert') {
                    await this.userRepo.update(existing.id, {
                        fullName: row.fullName,
                        role: row.role,
                        siteId: row.siteId,
                        employeeId: row.employeeId,
                        jobTitle: row.jobTitle,
                    });
                    results.updated++;
                }
                // mode === 'create': skip existing
            } else {
                await this.userRepo.save(this.userRepo.create({
                    email: row.email,
                    fullName: row.fullName,
                    role: row.role,
                    siteId: row.siteId,
                    employeeId: row.employeeId,
                    jobTitle: row.jobTitle,
                    isActive: row.isActive ?? true,
                }));
                results.created++;
            }
        } catch (err) {
            results.failed++;
            results.errors.push({ email: row.email, message: err.message });
        }
    }

    return results; // { created, updated, failed, errors }
}
```

- [ ] **Step 5: Commit**

```bash
rtk git add apps/frontend/src/features/admin/components/ImportUsersDialog.tsx
rtk git add apps/backend/src/modules/users/users.service.ts
rtk git add apps/backend/src/modules/users/users.controller.ts
rtk git commit -m "feat(import): add create/upsert mode toggle with backend upsert support"
```

---

### Task 13: ImportUsersDialog — Result summary

**Files:**
- Modify: `apps/frontend/src/features/admin/components/ImportUsersDialog.tsx`

- [ ] **Step 1: Tambah state untuk hasil import**

```tsx
const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    failed: number;
    errors: { email: string; message: string }[];
} | null>(null);
```

- [ ] **Step 2: Update submit handler — simpan result, jangan tutup dialog**

Cari mutation atau fungsi submit. Ganti `onSuccess`:
```tsx
onSuccess: (data) => {
    setImportResult(data.data);          // simpan result, jangan onClose()
    queryClient.invalidateQueries({ queryKey: ['users'] });
},
```

- [ ] **Step 3: Render summary screen**

Tambah kondisi render: jika `importResult !== null`, tampilkan summary sebagai ganti preview:
```tsx
{importResult ? (
    <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-full max-w-sm space-y-3">
            {importResult.created > 0 && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <span className="text-xl">✓</span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                        {importResult.created} user berhasil dibuat
                    </span>
                </div>
            )}
            {importResult.updated > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <span className="text-xl">↺</span>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                        {importResult.updated} user diperbarui
                    </span>
                </div>
            )}
            {importResult.failed > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <span className="text-xl">✗</span>
                    <span className="text-red-700 dark:text-red-300 font-medium">
                        {importResult.failed} baris gagal
                    </span>
                </div>
            )}
        </div>
        <div className="flex gap-3 mt-2">
            {importResult.failed > 0 && (
                <button
                    onClick={() => {
                        // Download error report CSV
                        const headers = ['email', 'error'];
                        const rows = importResult.errors.map(e => [e.email, e.message]);
                        const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `import-errors-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 px-4 py-2 border border-[hsl(var(--border))] rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Download Error Report
                </button>
            )}
            <button
                onClick={() => {
                    setImportResult(null);
                    onClose();
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
                Selesai
            </button>
        </div>
    </div>
) : /* existing preview render */ null}
```

- [ ] **Step 4: Commit**

```bash
rtk git add apps/frontend/src/features/admin/components/ImportUsersDialog.tsx
rtk git commit -m "feat(import): show result summary with error report download after import completes"
```

---

### Task 14: Preset JSON Export/Import

**Files:**
- Modify: `apps/frontend/src/features/admin/components/PresetDrawer.tsx`
- Create: `apps/backend/src/modules/permissions/dto/import-presets.dto.ts`
- Modify: `apps/backend/src/modules/permissions/permissions.controller.ts`

- [ ] **Step 1: Buat DTO backend**

```typescript
// apps/backend/src/modules/permissions/dto/import-presets.dto.ts
import { IsArray, ValidateNested, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class PresetPageAccess {
    [pageKey: string]: boolean;
}

class ImportPresetItemDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    targetRole?: string;

    pageAccess?: Record<string, boolean>;
}

export class ImportPresetsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImportPresetItemDto)
    presets: ImportPresetItemDto[];

    @IsOptional()
    @IsString()
    conflictResolution?: 'skip' | 'replace' | 'rename';
}
```

- [ ] **Step 2: Backend controller endpoint**

Di `permissions.controller.ts`, tambah endpoint:
```typescript
@Post('presets/import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async importPresets(@Body() dto: ImportPresetsDto) {
    return this.permissionsService.importPresets(dto);
}
```

- [ ] **Step 3: Backend service importPresets**

Di `permissions.service.ts`, tambah method:
```typescript
async importPresets(dto: ImportPresetsDto): Promise<{ imported: number; skipped: number; renamed: number }> {
    const { presets, conflictResolution = 'skip' } = dto;
    let imported = 0, skipped = 0, renamed = 0;

    for (const preset of presets) {
        const existing = await this.presetRepo.findOne({ where: { name: preset.name } });
        if (existing) {
            if (conflictResolution === 'skip') { skipped++; continue; }
            if (conflictResolution === 'replace') {
                await this.presetRepo.update(existing.id, { description: preset.description, pageAccess: preset.pageAccess });
                imported++;
            } else if (conflictResolution === 'rename') {
                const newName = `${preset.name} (Imported ${new Date().toISOString().slice(0, 10)})`;
                await this.presetRepo.save(this.presetRepo.create({ ...preset, name: newName, isSystem: false }));
                renamed++; imported++;
            }
        } else {
            await this.presetRepo.save(this.presetRepo.create({ ...preset, isSystem: false }));
            imported++;
        }
    }

    return { imported, skipped, renamed };
}
```

- [ ] **Step 4: Frontend — tombol Export/Import di PresetDrawer header**

Di `PresetDrawer.tsx`, di header kiri (dekat tombol close), tambah:
```tsx
import { Download, Upload } from 'lucide-react';

// Di header left column, setelah title:
<div className="flex items-center gap-1">
    <button
        onClick={handleExportPresets}
        title="Export preset ke JSON"
        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
    >
        <Download className="w-3.5 h-3.5 text-slate-500" />
    </button>
    <label title="Import preset dari JSON" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
        <Upload className="w-3.5 h-3.5 text-slate-500" />
        <input type="file" accept=".json" className="hidden" onChange={handleImportPresets} />
    </label>
</div>
```

Tambah handlers:
```tsx
const handleExportPresets = () => {
    const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        presets: presets.map(({ id, usageCount, isSystem, createdAt, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presets-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

const handleImportPresets = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.presets || !Array.isArray(data.presets)) {
            toast.error('Format file JSON tidak valid');
            return;
        }
        await api.post('/permissions/presets/import', {
            presets: data.presets,
            conflictResolution: 'rename',
        });
        toast.success(`${data.presets.length} preset diimport`);
        queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
    } catch {
        toast.error('Gagal import preset');
    }
    e.target.value = '';
};
```

- [ ] **Step 5: Commit**

```bash
rtk git add apps/backend/src/modules/permissions/dto/import-presets.dto.ts
rtk git add apps/backend/src/modules/permissions/permissions.controller.ts
rtk git add apps/backend/src/modules/permissions/permissions.service.ts
rtk git add apps/frontend/src/features/admin/components/PresetDrawer.tsx
rtk git commit -m "feat(presets): add JSON export/import for preset backup and restore"
```

---

## Self-Review Checklist

- [x] **Site isolation** — backend SiteGuard + service filter + 4 frontend pages ✓
- [x] **Labeled dropdown** — AgentSelectList dengan site header + badge ✓
- [x] **Agents page tab lock** — AGENT role dapat disabled tabs + auto-set site ✓
- [x] **Preset drawer** — 2-column, list + inline editor, Escape/Ctrl+S, unsaved guard ✓
- [x] **PresetManagementDialog** — dihapus ✓
- [x] **"Manage Presets" link** — di PresetDropdown ✓
- [x] **Field selector export** — checklist + live preview + `?fields=` param ✓
- [x] **Dynamic export backend** — `exportUsersXlsx(site, fields?)` ✓
- [x] **Row color validation import** — error/warning/ok per baris + counter + scroll ✓
- [x] **Import mode toggle** — create / upsert, backend handles both ✓
- [x] **Result summary** — tidak langsung tutup, tampil stats + download error CSV ✓
- [x] **Preset JSON export/import** — frontend handlers + backend endpoint ✓
