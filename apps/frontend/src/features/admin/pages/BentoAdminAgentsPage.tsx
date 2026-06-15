import React, { useState, useMemo, useDeferredValue, useEffect, useRef } from 'react';
import { shouldShowOnboarding } from '../components/OnboardingTutorial';
// C1+C2: Import extracted components to eliminate duplicates
import {
    AgentPaginationBar,
    KeyboardShortcutsHelpDialog,
    AgentStatsDashboard,
    AgentManagementHeader,
    AgentFiltersToolbar,
    UsersByRoleSection,
    AgentPerformancePanel,
    AgentManagementDialogs,
} from '../components/agent-management';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Ticket } from '@/types/ticket.types';
import { Site, User, AgentStats, PaginatedResponse } from '@/types/admin.types';
import { usePermissionPresets } from '@/hooks/usePermissions';
import { useAuth } from '@/stores/useAuth';

import { SITE_COLORS, ROLE_CONFIG, getAvatarColor } from '../components/agent-management/agent-utils';
import { PresetDropdown } from '../components/agent-management/PresetDropdown';
import { PermissionPreset } from '../components/agent-management/agent-types';


export const BentoAdminAgentsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedAgentDetail, setSelectedAgentDetail] = useState<User | null>(null);

    // New state for enhanced features
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    // Site isolation: AGENT is locked to their own site
    const { user: authUser } = useAuth();
    const isAgentRole = authUser?.role === 'AGENT';

    const [selectedSite, setSelectedSite] = useState('ALL');
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isBulkRoleChangeOpen, setIsBulkRoleChangeOpen] = useState(false);
    const [isPresetManageOpen, setIsPresetManageOpen] = useState(false);
    const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);
    const [isBulkSiteChangeOpen, setIsBulkSiteChangeOpen] = useState(false);
    const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50); // P1-2: Configurable page size
    const PAGE_SIZE_OPTIONS = [20, 50, 100]; // P1-2: Page size options

    // P1-4: View mode toggle (grid vs table)
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // P2-2: Role filter
    const [selectedRole, setSelectedRole] = useState<'ALL' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT'>('ALL');

    // P2-3: Stats card filter (click to filter by status)
    const [statsFilter, setStatsFilter] = useState<'all' | 'active' | 'resolved' | 'top'>('all');

    // E3: Sort config for performance table
    type SortKey = 'fullName' | 'openTickets' | 'inProgressTickets' | 'resolvedThisWeek' | 'resolvedThisMonth' | 'slaCompliance' | 'appraisalPoints' | 'activeWorkloadPoints';
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'resolvedThisMonth', dir: 'desc' });

    // E3: Handle column sort
    const handleSort = (key: SortKey) => {
        setSortConfig(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
        }));
    };

    // M1: Unified view toggle - 'unified' shows all users in single table, 'collapsed' shows by role
    const [displayMode, setDisplayMode] = useState<'unified' | 'collapsed'>('unified');

    const handleResetPassword = (user: User) => {
        setSelectedUser(user);
        setIsResetPasswordOpen(true);
    };

    // Debounced search using useDeferredValue (must be defined before query that uses it)
    const deferredSearchQuery = useDeferredValue(searchQuery);

    // Paginated users query with server-side filtering
    // PaginatedResponse interface is defined at module scope (above PresetDropdown)
    const { data: usersResponse, isLoading, isError, error, refetch } = useQuery<PaginatedResponse<User>>({
        queryKey: ['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('page', currentPage.toString());
            params.set('limit', pageSize.toString());
            if (selectedSite !== 'ALL') params.set('siteCode', selectedSite);
            if (deferredSearchQuery) params.set('search', deferredSearchQuery);
            if (selectedRole !== 'ALL') params.set('role', selectedRole);
            const res = await api.get(`/users?${params.toString()}`);
            return res.data;
        },
        staleTime: 30_000,      // 30s — prevents unnecessary refetch on every mount
        refetchOnMount: 'always',
    });

    const users = usersResponse?.data || [];
    const paginationMeta = usersResponse?.meta;

    // Fetch sites from backend API
    const { data: sitesData = [] } = useQuery<Site[]>({
        queryKey: ['sites-active'],
        queryFn: async () => {
            const res = await api.get('/sites/active');
            return res.data;
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Build sites array with "All Sites" prepended (AGENT only sees their own site)
    const SITES = useMemo(() => [
        { code: 'ALL', name: 'All Sites', id: '' },
        ...sitesData.map(s => ({ ...s, code: s.code, name: s.name, id: s.id }))
    ], [sitesData]);

    // Lock AGENT to their site tab on mount / when sites load
    useEffect(() => {
        if (isAgentRole && authUser?.siteId && sitesData.length > 0) {
            const agentSite = sitesData.find(s => s.id === authUser.siteId);
            if (agentSite) {
                setSelectedSite(agentSite.code);
            }
        }
    }, [isAgentRole, authUser?.siteId, sitesData]);

    // Fetch agent stats from backend API (pre-computed on server)
    // Backend returns { summary, agents } - we extract the agents array
    const { data: agentStats = [] } = useQuery<AgentStats[]>({
        queryKey: ['agent-stats'],
        queryFn: async () => {
            const res = await api.get('/users/agents/stats');
            // Backend returns { summary: {...}, agents: [...] }
            return res.data.agents || [];
        },
        staleTime: 30000, // Cache for 30 seconds
    });

    // Users are already filtered by server, just use them directly
    const filteredUsers = users;

    // Fetch permission presets for inline preset column
    const { data: presets = [] } = usePermissionPresets();

    // Track which user is currently having preset applied (for loading state)
    const [applyingPresetUserId, setApplyingPresetUserId] = useState<string | null>(null);

    // Mutation: apply preset directly from table row
    const tableApplyPresetMutation = useMutation({
        mutationFn: async ({ userId, presetId }: { userId: string; presetId: string; presetName: string }) => {
            const res = await api.post(`/permissions/users/${userId}/preset/${presetId}`);
            return res.data;
        },
        onMutate: ({ userId, presetId, presetName }) => {
            setApplyingPresetUserId(userId);
            // Optimistic update: update user in query cache immediately
            queryClient.setQueryData(
                ['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole],
                (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.map((u: User) =>
                            u.id === userId
                                ? { ...u, appliedPresetId: presetId, appliedPresetName: presetName }
                                : u
                        ),
                    };
                }
            );
        },
        onSuccess: (_, { presetName }) => {
            toast.success(`Preset "${presetName}" applied`);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['my-permissions'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to apply preset');
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onSettled: () => {
            setApplyingPresetUserId(null);
        },
    });

    const handleApplyPreset = (userId: string, presetId: string, presetName: string) => {
        tableApplyPresetMutation.mutate({ userId, presetId, presetName });
    };

    // HIGH: Keyboard shortcuts (must be after filteredUsers is defined)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // ? - Show keyboard help
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                setShowKeyboardHelp(true);
            }

            // Ctrl+Shift+A - Select all users (avoids browser Ctrl+A conflict)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                const allIds = filteredUsers.map(u => u.id);
                setSelectedUserIds(new Set(allIds));
            }

            // Delete - Delete selected users
            if (e.key === 'Delete' && selectedUserIds.size > 0) {
                e.preventDefault();
                setIsBulkDeleteOpen(true);
            }

            // Escape - Close any open dialogs
            if (e.key === 'Escape') {
                setShowKeyboardHelp(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredUsers, selectedUserIds]);

    // Reset to page 1 when filters change
    const handleSiteChange = (newSite: string) => {
        setSelectedSite(newSite);
        setCurrentPage(1);
    };

    // Group users by role
    const usersByRole = useMemo(() => ({
        ADMIN: filteredUsers.filter(u => u.role === 'ADMIN'),
        MANAGER: filteredUsers.filter(u => u.role === 'MANAGER'),
        AGENT: filteredUsers.filter(u => u.role === 'AGENT'),
        USER: filteredUsers.filter(u => u.role === 'USER'),
    }), [filteredUsers]);

    // Filtered agent stats for performance table (P2-2: includes role filter)
    const filteredAgentStats = useMemo(() => {
        let result = agentStats;
        if (selectedSite !== 'ALL') {
            result = result.filter(a => a.site?.code === selectedSite);
        }
        if (selectedRole !== 'ALL') {
            result = result.filter(a => a.role === selectedRole);
        }
        return result;
    }, [agentStats, selectedSite, selectedRole]);

    // Dashboard stats - use filteredAgentStats for consistency (H2 fix)
    const dashboardStats = useMemo(() => {
        const totalResolved = filteredAgentStats.reduce((sum, a) => sum + a.resolvedThisMonth, 0);
        const totalActive = filteredAgentStats.filter(a => a.inProgressTickets > 0).length;
        const topPerformer = [...filteredAgentStats].sort((a, b) => b.resolvedThisMonth - a.resolvedThisMonth)[0];

        return {
            totalAgents: filteredAgentStats.length,
            totalResolved,
            totalActive,
            topPerformer: topPerformer?.fullName || '-',
            topPerformerTickets: topPerformer?.resolvedThisMonth || 0,
        };
    }, [filteredAgentStats]);

    // P2-3: Displayed agent stats with stats card filter + E3: sorting
    const displayedAgentStats = useMemo(() => {
        let result = filteredAgentStats;

        // Apply stats filter
        if (statsFilter === 'active') result = result.filter(a => a.inProgressTickets > 0);
        if (statsFilter === 'resolved') result = result.filter(a => a.resolvedThisMonth > 0);
        if (statsFilter === 'top') {
            // Show only the top performer
            const sorted = [...result].sort((a, b) => b.resolvedThisMonth - a.resolvedThisMonth);
            return sorted.slice(0, 1);
        }

        // E3: Apply column sorting
        return [...result].sort((a, b) => {
            const aVal = sortConfig.key === 'fullName'
                ? a.fullName.toLowerCase()
                : (a as any)[sortConfig.key] ?? 0;
            const bVal = sortConfig.key === 'fullName'
                ? b.fullName.toLowerCase()
                : (b as any)[sortConfig.key] ?? 0;

            if (sortConfig.key === 'fullName') {
                return sortConfig.dir === 'asc'
                    ? (aVal as string).localeCompare(bVal as string)
                    : (bVal as string).localeCompare(aVal as string);
            }
            return sortConfig.dir === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [filteredAgentStats, statsFilter, sortConfig]);

    // Site counts for tabs
    // For ALL: use paginationMeta.total (real server total) when available, else fall back to agentStats.length
    // For per-site: use agentStats which contains all agents across pages
    const siteCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: paginationMeta?.total ?? agentStats.length };
        sitesData.forEach(site => {
            counts[site.code] = agentStats.filter(a => a.site?.code === site.code).length;
        });
        return counts;
    }, [agentStats, sitesData, paginationMeta]);

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await api.delete(`/users/${userId}`);
            return res.data;
        },
        onMutate: async (userId: string) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['users'] });

            // Snapshot previous data
            const previousData = queryClient.getQueryData(['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole]);

            // Optimistically update the cache
            queryClient.setQueryData(
                ['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole],
                (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.filter((u: User) => u.id !== userId),
                        meta: { ...old.meta, total: old.meta.total - 1 },
                    };
                }
            );

            return { previousData };
        },
        onSuccess: (data) => {
            toast.success(data.message || 'User deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsConfirmDeleteOpen(false);
            setUserToDelete(null);
        },
        onError: (error: any, _userId, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(
                    ['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole],
                    context.previousData
                );
            }
            toast.error(error.response?.data?.message || 'Failed to delete user');
        },
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: async (userIds: string[]) => {
            const res = await api.post('/users/bulk-delete', { userIds });
            return res.data;
        },
        onMutate: async (userIds: string[]) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['users'] });

            // Snapshot previous data
            const previousData = queryClient.getQueryData(['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole]);

            // Optimistically update the cache
            queryClient.setQueryData(
                ['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole],
                (old: any) => {
                    if (!old) return old;
                    const idSet = new Set(userIds);
                    return {
                        ...old,
                        data: old.data.filter((u: User) => !idSet.has(u.id)),
                        meta: { ...old.meta, total: old.meta.total - userIds.length },
                    };
                }
            );

            return { previousData };
        },
        onSuccess: (data) => {
            toast.success(`${data.deleted} users deleted successfully`);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setSelectedUserIds(new Set());
            setIsBulkDeleteOpen(false);
        },
        onError: (error: any, _userIds, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(
                    ['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole],
                    context.previousData
                );
            }
            toast.error(error.response?.data?.message || 'Failed to delete users');
        },
    });

    const handleDeleteUser = (user: User) => {
        setUserToDelete(user);
        setIsConfirmDeleteOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setIsEditUserOpen(true);
    };

    const handleExportUsers = async (format: 'csv' | 'xlsx' = 'xlsx') => {
        try {
            const res = await api.get(`/users/export?format=${format}&site=${selectedSite}`, {
                responseType: format === 'xlsx' ? 'blob' : 'json'
            });

            if (format === 'xlsx') {
                const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `users_${selectedSite}_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const { data, filename } = res.data;
                const blob = new Blob([data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                window.URL.revokeObjectURL(url);
            }
            toast.success('Users exported successfully');
        } catch (error) {
            toast.error('Failed to export users');
        }
    };

    const toggleUserSelection = (userId: string) => {
        const newSet = new Set(selectedUserIds);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        setSelectedUserIds(newSet);
    };

    // U2: Toggle active/inactive mutation with optimistic update
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
            await api.patch(`/users/${userId}`, { isActive });
            return { userId, isActive };
        },
        onMutate: async ({ userId, isActive }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['users'] });
            await queryClient.cancelQueries({ queryKey: ['agent-stats'] });

            // Snapshot the current paginated cache entry (must match the exact query key used in useQuery)
            const cacheKey = ['users', currentPage, pageSize, selectedSite, deferredSearchQuery, selectedRole];
            const previousUsers = queryClient.getQueryData(cacheKey);

            // Optimistic update on the correct paginated cache entry
            queryClient.setQueryData(cacheKey, (old: any) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: old.data.map((u: User) =>
                        u.id === userId ? { ...u, isActive } : u
                    )
                };
            });

            return { previousUsers, cacheKey };
        },
        onError: (err, _variables, context) => {
            // Rollback on error using the same cache key
            if (context?.previousUsers) {
                queryClient.setQueryData(context.cacheKey, context.previousUsers);
            }
            toast.error('Failed to update user status');
        },
        onSuccess: (data) => {
            toast.success(`User ${data.isActive ? 'activated' : 'deactivated'}`);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
        },
    });

    // Bulk role change mutation — uses Promise.allSettled so partial failures are reported individually
    const bulkRoleChangeMutation = useMutation({
        mutationFn: async ({ userIds, role }: { userIds: string[]; role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT' }) => {
            const results = await Promise.allSettled(
                userIds.map(id => api.patch(`/users/${id}/role`, { role }))
            );
            const succeeded = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            return { succeeded, failed, total: userIds.length, role };
        },
        onSuccess: (data) => {
            if (data.failed === 0) {
                toast.success(`${data.succeeded} user(s) updated to ${data.role}`);
            } else {
                toast.warning(`${data.succeeded} updated, ${data.failed} failed — check permissions`);
            }
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setSelectedUserIds(new Set());
            setIsBulkRoleChangeOpen(false);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update roles');
        },
    });

    return (
        <div className="space-y-6 animate-fade-in-up overflow-x-hidden">
            {/* Header */}
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

            {/* Unified Filters Toolbar */}
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

            {/* Stats Dashboard */}
            <AgentStatsDashboard
                total={paginationMeta?.total}
                dashboardStats={dashboardStats}
                statsFilter={statsFilter}
                onStatsFilterChange={setStatsFilter}
            />

            {/* P1-1 + P3-1: Agent Performance - Conditional Grid/Table View */}
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
                onViewDetail={setSelectedAgentDetail}
                onEditUser={handleEditUser}
                onToggleActive={(vars) => toggleActiveMutation.mutate(vars)}
                onResetPassword={(u) => { setSelectedUser(u); setIsResetPasswordOpen(true); }}
            />

            {/* Users by Role - Collapsible Sections (shows all users from paginated API) */}
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

            {/* P1-2 + P1-3: Sticky Pagination with Page Size Selector */}
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

            <AgentManagementDialogs
                importOpen={isImportModalOpen}
                onImportClose={() => setIsImportModalOpen(false)}
                addUserOpen={isAddUserModalOpen}
                onAddUserClose={() => setIsAddUserModalOpen(false)}
                resetPasswordOpen={isResetPasswordOpen}
                onResetPasswordClose={() => {
                    setIsResetPasswordOpen(false);
                    setSelectedUser(null);
                }}
                selectedUser={selectedUser}
                editUserOpen={isEditUserOpen}
                onEditUserClose={() => {
                    setIsEditUserOpen(false);
                    setEditingUser(null);
                }}
                editingUser={editingUser}
                selectedAgentDetail={selectedAgentDetail}
                onAgentDetailClose={() => setSelectedAgentDetail(null)}
                agentStats={agentStats}
                confirmDeleteOpen={isConfirmDeleteOpen}
                onConfirmDeleteClose={() => {
                    setIsConfirmDeleteOpen(false);
                    setUserToDelete(null);
                }}
                onConfirmDelete={() => {
                    if (userToDelete && !deleteMutation.isPending) {
                        deleteMutation.mutate(userToDelete.id);
                    }
                }}
                userToDelete={userToDelete}
                isDeleting={deleteMutation.isPending}
                bulkDeleteOpen={isBulkDeleteOpen}
                onBulkDeleteClose={() => setIsBulkDeleteOpen(false)}
                onConfirmBulkDelete={() => bulkDeleteMutation.mutate(Array.from(selectedUserIds))}
                selectedCount={selectedUserIds.size}
                isBulkDeleting={bulkDeleteMutation.isPending}
                bulkRoleOpen={isBulkRoleChangeOpen}
                onBulkRoleClose={() => setIsBulkRoleChangeOpen(false)}
                onConfirmBulkRole={(role) => bulkRoleChangeMutation.mutate({
                    userIds: Array.from(selectedUserIds),
                    role
                })}
                isBulkRolePending={bulkRoleChangeMutation.isPending}
                presetManageOpen={isPresetManageOpen}
                onPresetManageClose={() => setIsPresetManageOpen(false)}
                exportPreviewOpen={isExportPreviewOpen}
                onExportPreviewClose={() => setIsExportPreviewOpen(false)}
                selectedSite={selectedSite}
                selectedRole={selectedRole}
                comparisonOpen={isComparisonOpen}
                onComparisonClose={() => setIsComparisonOpen(false)}
                comparisonAgents={Array.from(selectedUserIds).slice(0, 2).map(id => {
                    const user = users.find(u => u.id === id);
                    const stats = agentStats?.find((s: any) => s.id === id);
                    return {
                        id: id,
                        fullName: user?.fullName || '',
                        email: user?.email || '',
                        role: user?.role || 'USER',
                        site: user?.site,
                        openTickets: stats?.openTickets || 0,
                        inProgressTickets: stats?.inProgressTickets || 0,
                        resolvedThisWeek: stats?.resolvedThisWeek || 0,
                        resolvedThisMonth: stats?.resolvedThisMonth || 0,
                        resolvedTotal: stats?.resolvedTotal || 0,
                        slaCompliance: stats?.slaCompliance || 100
                    };
                })}
                bulkSiteOpen={isBulkSiteChangeOpen}
                onBulkSiteClose={() => setIsBulkSiteChangeOpen(false)}
                selectedUserIds={selectedUserIds}
                pdfExportOpen={isPdfExportOpen}
                onPdfExportClose={() => setIsPdfExportOpen(false)}
                totalUsers={users.length}
                showOnboarding={showOnboarding}
                onOnboardingComplete={() => setShowOnboarding(false)}
            />

            {/* Keyboard Shortcuts Help */}
            <KeyboardShortcutsHelpDialog open={showKeyboardHelp} onClose={() => setShowKeyboardHelp(false)} />
        </div>
    );
};

export default BentoAdminAgentsPage;
