/**
 * PresetDrawer — 2-column slide-over drawer untuk manajemen permission preset.
 * Menggantikan PresetManagementDialog (yang akan dihapus setelah ini siap sepenuhnya).
 *
 * Kolom kiri  : daftar preset (search + list)
 * Kolom kanan : editor preset (nama, deskripsi, permissions, pageAccess)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Copy, Save, Shield, ChevronRight, Search, Lock, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PageAccess {
    [page: string]: boolean;
}

interface PermissionMap {
    [resource: string]: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
    };
}

interface PermissionPreset {
    id: string;
    name: string;
    description?: string;
    targetRole?: 'USER' | 'AGENT' | 'MANAGER' | 'ADMIN';
    pageAccess?: PageAccess;
    isSystem: boolean;
    permissions: PermissionMap;
    createdAt: string;
    usageCount?: number;
}

interface PresetDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    MANAGER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    AGENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    USER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const EMPTY_PRESET: Omit<PermissionPreset, 'id' | 'createdAt'> = {
    name: '',
    description: '',
    targetRole: 'AGENT',
    isSystem: false,
    pageAccess: {},
    permissions: {},
};

const DEFAULT_PERMISSION_RESOURCES = [
    'tickets',
    'users',
    'knowledge_base',
    'reports',
    'hardware_requests',
    'eform',
    'lost_items',
    'departments',
    'sites',
    'automation',
    'zoom_calendar',
    'renewal',
    'dashboard',
    'settings',
    'workloads',
    'system_health',
    'audit_logs',
    'ict_budget',
    'notifications',
    'oracle_k2_tickets',
] as const;

const DEFAULT_PERMISSION_VALUES = {
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const PermissionRow: React.FC<{
    resource: string;
    value: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
    onToggle: (resource: string, enabled: boolean) => void;
    disabled?: boolean;
    index?: number;
}> = ({ resource, value, onToggle, disabled, index = 0 }) => {
    const isEnabled = value.canView === true;

    return (
        <div className={cn(
            "flex items-center justify-between py-2.5 px-3 border-b border-[hsl(var(--border))] last:border-0 rounded-sm",
            index % 2 === 1 && "bg-slate-50/50 dark:bg-slate-800/20"
        )}>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                {resource.replace(/_/g, ' ')}
            </span>
            <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                disabled={disabled}
                onClick={() => onToggle(resource, !isEnabled)}
                className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    isEnabled ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-600"
                )}
            >
                <span
                    className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                        isEnabled ? "translate-x-4" : "translate-x-0"
                    )}
                />
            </button>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const PresetDrawer: React.FC<PresetDrawerProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Partial<PermissionPreset>>({});
    const [isDirty, setIsDirty] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // ── Data fetching ──
    const { data: presets = [], isLoading } = useQuery<PermissionPreset[]>({
        queryKey: ['permission-presets'],
        queryFn: async () => {
            const res = await api.get('/permissions/presets');
            return res.data;
        },
        enabled: isOpen,
    });

    // ── Select preset → fill draft ──
    const selectPreset = useCallback((preset: PermissionPreset) => {
        setSelectedId(preset.id);
        setDraft({ ...preset });
        setIsDirty(false);
    }, []);

    // ── Auto-select first preset on open ──
    useEffect(() => {
        if (isOpen && presets.length > 0 && !selectedId) {
            selectPreset(presets[0]);
        }
    }, [isOpen, presets, selectedId, selectPreset]);

    // ── Draft helpers ──
    const updateDraft = (updates: Partial<PermissionPreset>) => {
        setDraft(prev => ({ ...prev, ...updates }));
        setIsDirty(true);
    };

    const togglePermission = (resource: string, enabled: boolean) => {
        const allSet = { canView: enabled, canCreate: enabled, canEdit: enabled, canDelete: enabled };
        setDraft(prev => ({
            ...prev,
            pageAccess: {
                ...prev.pageAccess,
                [resource]: enabled,
            },
            permissions: {
                ...prev.permissions,
                [resource]: allSet,
            },
        }));
        setIsDirty(true);
    };

    // ── Mutations ──
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (selectedId === '__new__') {
                return api.post('/permissions/presets', draft);
            }
            return api.put(`/permissions/presets/${selectedId}`, draft);
        },
        onSuccess: (res) => {
            toast.success('Preset saved');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
            setIsDirty(false);
            if (selectedId === '__new__') {
                setSelectedId(res.data.id);
            }
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to save preset');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/permissions/presets/${id}`),
        onSuccess: () => {
            toast.success('Preset deleted');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
            setSelectedId(null);
            setDraft({});
            setDeletingId(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to delete preset');
        },
    });

    const cloneMutation = useMutation({
        mutationFn: async (preset: PermissionPreset) => {
            const clone = {
                ...preset,
                name: `${preset.name} (Copy)`,
                isSystem: false,
                id: undefined,
                createdAt: undefined,
            };
            return api.post('/permissions/presets', clone);
        },
        onSuccess: (res) => {
            toast.success('Preset cloned');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
            setSelectedId(res.data.id);
            setDraft({ ...res.data });
            setIsDirty(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to clone preset');
        },
    });

    // ── New preset ──
    const handleNew = () => {
        setSelectedId('__new__');
        setDraft({ ...EMPTY_PRESET });
        setIsDirty(true);
    };

    // ── Filtered presets ──
    const filteredPresets = search
        ? presets.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.description?.toLowerCase().includes(search.toLowerCase())
        )
        : presets;

    const selectedPreset = presets.find(p => p.id === selectedId);
    const isNew = selectedId === '__new__';
    const isSystem = selectedPreset?.isSystem && !isNew;
    const permissionResources = [...DEFAULT_PERMISSION_RESOURCES];

    return (
        <>
            {/* Overlay */}
            <div
                className={cn(
                    'fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 transition-[opacity,visibility] duration-300',
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none invisible'
                )}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={cn(
                    'fixed top-0 right-0 h-full w-full max-w-5xl bg-[hsl(var(--card))] shadow-2xl z-50',
                    'flex flex-col border-l border-[hsl(var(--border))] transition-[transform,visibility] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    isOpen ? 'translate-x-0 visible' : 'translate-x-full invisible'
                )}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Permission Presets</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{presets.length} presets</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* ── Body — 2 columns ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Left: Preset List ── */}
                    <div className="w-64 shrink-0 border-r border-[hsl(var(--border))] flex flex-col">
                        {/* Search + New */}
                        <div className="p-3 space-y-2 border-b border-[hsl(var(--border))]">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search presets..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-[hsl(var(--border))] rounded-lg outline-none focus:ring-1 focus:ring-blue-500/50 text-slate-800 dark:text-white placeholder:text-slate-400"
                                />
                            </div>
                            <button
                                onClick={handleNew}
                                className="w-full flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                New Preset
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="p-4 text-sm text-slate-400">Loading...</div>
                            ) : (
                                <>
                                    {isNew && (
                                        <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-[hsl(var(--border))]">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-sm font-medium text-blue-600">New preset</span>
                                        </div>
                                    )}
                                    {filteredPresets.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => selectPreset(preset)}
                                            className={cn(
                                                'w-full text-left flex items-center gap-2 px-3 py-2.5 border-b border-[hsl(var(--border))] transition-colors',
                                                'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                                                selectedId === preset.id && !isNew && 'bg-blue-50 dark:bg-blue-900/20'
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    {preset.isSystem && (
                                                        <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                                    )}
                                                    <span className="text-sm font-medium text-slate-800 dark:text-white truncate">
                                                        {preset.name}
                                                    </span>
                                                </div>
                                                {preset.targetRole && (
                                                    <span className={cn(
                                                        'text-[10px] px-1.5 py-0.5 rounded font-semibold',
                                                        ROLE_COLORS[preset.targetRole]
                                                    )}>
                                                        {preset.targetRole}
                                                    </span>
                                                )}
                                            </div>
                                            {preset.usageCount !== undefined && preset.usageCount > 0 && (
                                                <span className="text-[10px] text-slate-400">{preset.usageCount}x</span>
                                            )}
                                            <ChevronRight className={cn(
                                                'w-3.5 h-3.5 shrink-0 transition-colors',
                                                selectedId === preset.id && !isNew ? 'text-blue-500' : 'text-slate-300'
                                            )} />
                                        </button>
                                    ))}
                                    {filteredPresets.length === 0 && (
                                        <div className="p-6 text-center text-sm text-slate-400">
                                            No presets found
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Editor ── */}
                    {selectedId ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Editor Header */}
                            <div className="flex items-center justify-between px-6 py-3 border-b border-[hsl(var(--border))]">
                                <div className="flex items-center gap-2">
                                    {isSystem && (
                                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                                            <Lock className="w-3 h-3" />
                                            System preset (read-only)
                                        </span>
                                    )}
                                    {isDirty && !isSystem && (
                                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                            • Unsaved changes
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isNew && selectedPreset && (
                                        <button
                                            onClick={() => cloneMutation.mutate(selectedPreset)}
                                            disabled={cloneMutation.isPending}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            Clone
                                        </button>
                                    )}
                                    {!isNew && selectedPreset && !isSystem && (
                                        <button
                                            onClick={() => setDeletingId(selectedId)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                        </button>
                                    )}
                                    {!isSystem && (
                                        <button
                                            onClick={() => saveMutation.mutate()}
                                            disabled={saveMutation.isPending || !isDirty || !draft.name}
                                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Save className="w-3.5 h-3.5" />
                                            {saveMutation.isPending ? 'Saving...' : 'Save'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Editor Form */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                            Preset Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={draft.name || ''}
                                            disabled={isSystem}
                                            onChange={e => updateDraft({ name: e.target.value })}
                                            placeholder="e.g. Senior Agent"
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-[hsl(var(--border))] rounded-lg outline-none focus:ring-1 focus:ring-blue-500/50 text-slate-800 dark:text-white placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                            Target Role
                                        </label>
                                        <select
                                            value={draft.targetRole || ''}
                                            disabled={isSystem}
                                            onChange={e => updateDraft({ targetRole: e.target.value as PermissionPreset['targetRole'] })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-[hsl(var(--border))] rounded-lg outline-none focus:ring-1 focus:ring-blue-500/50 text-slate-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <option value="">Any Role</option>
                                            <option value="ADMIN">Admin</option>
                                            <option value="MANAGER">Manager</option>
                                            <option value="AGENT">Agent</option>
                                            <option value="USER">User</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                            Description
                                        </label>
                                        <textarea
                                            value={draft.description || ''}
                                            disabled={isSystem}
                                            onChange={e => updateDraft({ description: e.target.value })}
                                            rows={2}
                                            placeholder="Brief description of what this preset allows..."
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-[hsl(var(--border))] rounded-lg outline-none focus:ring-1 focus:ring-blue-500/50 text-slate-800 dark:text-white placeholder:text-slate-400 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* Permissions */}
                                {permissionResources.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                            Permissions
                                        </label>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-[hsl(var(--border))] px-4">
                                            {permissionResources.map((resource, idx) => (
                                                <PermissionRow
                                                    key={resource}
                                                    resource={resource}
                                                    value={{
                                                        canView: draft.pageAccess?.[resource] ?? draft.permissions?.[resource]?.canView ?? false,
                                                        canCreate: draft.permissions?.[resource]?.canCreate ?? false,
                                                        canEdit: draft.permissions?.[resource]?.canEdit ?? false,
                                                        canDelete: draft.permissions?.[resource]?.canDelete ?? false,
                                                    }}
                                                    onToggle={togglePermission}
                                                    disabled={isSystem}
                                                    index={idx}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {permissionResources.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <Shield className="w-10 h-10 mb-3 opacity-20" />
                                        <p className="text-sm">No permissions defined for this preset</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">
                            <div className="text-center">
                                <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Select a preset to edit</p>
                                <p className="text-xs mt-1">or create a new one</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Delete Confirmation ── */}
            {deletingId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className="bg-[hsl(var(--card))] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[hsl(var(--border))]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Delete Preset</h3>
                                <p className="text-sm text-slate-500">This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingId(null)}
                                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deletingId)}
                                disabled={deleteMutation.isPending}
                                className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
