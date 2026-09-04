/**
 * PresetDrawer — Slide-over drawer untuk manajemen permission presets dengan UI/UX premium.
 *
 * Kolom kiri  : Preset browser (Search + Role Filter + Preset List cards)
 * Kolom kanan : Preset editor (Metadata form + Categorized permission modules with quick batch toggles)
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    X,
    Plus,
    Trash2,
    Copy,
    Save,
    Shield,
    ShieldCheck,
    ChevronRight,
    Search,
    Lock,
    LayoutDashboard,
    Ticket,
    Layers,
    Laptop,
    FileText,
    Video,
    BookOpen,
    Bell,
    BarChart3,
    RefreshCw,
    DollarSign,
    Activity,
    Users,
    Zap,
    Settings,
    CheckCheck,
    XCircle,
    Info,
    Sparkles,
    UserCheck,
    Code2,
    Smartphone,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import { ConfirmDialog } from './ConfirmDialog';

/** Sentinel id for the not-yet-persisted preset being composed in the editor. */
const NEW_PRESET_ID = '__new__';

/**
 * Action deferred behind the unsaved-changes confirmation.
 */
type PendingAction = { type: 'close' } | { type: 'new' } | { type: 'select'; preset: PermissionPreset };

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

interface PermissionResourceMeta {
    key: string;
    label: string;
    description: string;
    icon: React.ElementType;
}

interface PermissionCategory {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    resources: PermissionResourceMeta[];
}

// ─── Constants & Metadata ───────────────────────────────────────────────────

const ROLE_BADGES: Record<string, { bg: string; text: string; border: string }> = {
    ADMIN: {
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-200 dark:border-rose-900/50',
    },
    MANAGER: {
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        text: 'text-purple-700 dark:text-purple-400',
        border: 'border-purple-200 dark:border-purple-900/50',
    },
    AGENT: {
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-900/50',
    },
    USER: {
        bg: 'bg-slate-100 dark:bg-slate-800/80',
        text: 'text-slate-600 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
    },
};

const EMPTY_PRESET: Omit<PermissionPreset, 'id' | 'createdAt'> = {
    name: '',
    description: '',
    targetRole: 'AGENT',
    isSystem: false,
    pageAccess: {},
    permissions: {},
};

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
    {
        id: 'ticketing',
        title: 'Core & Ticketing',
        description: 'Ticket desk, operations overview, and specialized ticket queues',
        icon: Ticket,
        resources: [
            {
                key: 'dashboard',
                label: 'Dashboard Overview',
                description: 'Main metrics, SLA statistics, ticket volume, and live feeds',
                icon: LayoutDashboard,
            },
            {
                key: 'tickets',
                label: 'Tickets Management',
                description: 'Create, view, manage, assign, and respond to support tickets',
                icon: Ticket,
            },
            {
                key: 'oracle_k2_tickets',
                label: 'Oracle / K2 Tickets',
                description: 'Dedicated Oracle ERP and K2 automated request queues',
                icon: Layers,
            },
            {
                key: 'web_dev_tickets',
                label: 'Web Developer Tickets',
                description: 'Dedicated Web development and web portal request queues',
                icon: Code2,
            },
            {
                key: 'mobile_dev_tickets',
                label: 'Mobile Developer Tickets',
                description: 'Dedicated Mobile iOS/Android app request queues',
                icon: Smartphone,
            },
        ],
    },
    {
        id: 'request_center',
        title: 'Request Center & Services',
        description: 'Employee self-service portals, device requisitions, and room bookings',
        icon: Laptop,
        resources: [
            {
                key: 'hardware_requests',
                label: 'Hardware Requests',
                description: 'IT hardware requisitions, equipment catalogs, and installations',
                icon: Laptop,
            },
            {
                key: 'eform_access',
                label: 'E-Form Access',
                description: 'Digital access request forms, credential issue, and approvals',
                icon: FileText,
            },
            {
                key: 'lost_items',
                label: 'Lost & Found Items',
                description: 'Lost item reporting, QR tagging, and inventory claim matching',
                icon: Search,
            },
            {
                key: 'zoom_calendar',
                label: 'Zoom Booking Calendar',
                description: 'Zoom conference reservations, schedules, and account licenses',
                icon: Video,
            },
        ],
    },
    {
        id: 'knowledge_comm',
        title: 'Knowledge & Communications',
        description: 'Organizational knowledge base and broadcast communications',
        icon: BookOpen,
        resources: [
            {
                key: 'knowledge_base',
                label: 'Knowledge Base',
                description: 'Self-help articles, troubleshooting guides, and internal FAQs',
                icon: BookOpen,
            },
            {
                key: 'notifications',
                label: 'Notification Center',
                description: 'Broadcast alerts, system messages, and in-app notifications',
                icon: Bell,
            },
        ],
    },
    {
        id: 'management_finance',
        title: 'Management & Analytics',
        description: 'Performance metrics, software renewal hub, budgets, and team capacity',
        icon: BarChart3,
        resources: [
            {
                key: 'reports',
                label: 'Reports & Analytics',
                description: 'SLA reports, department analytics, and exportable summaries',
                icon: BarChart3,
            },
            {
                key: 'renewal',
                label: 'Renewal Hub',
                description: 'Contract timelines, software licenses, and vendor renewals',
                icon: RefreshCw,
            },
            {
                key: 'ict_budget',
                label: 'ICT Budget Tracking',
                description: 'Departmental budget allocations, IT spendings, and audits',
                icon: DollarSign,
            },
            {
                key: 'workloads',
                label: 'Team Workloads',
                description: 'Agent ticket distribution, active queues, and team capacity',
                icon: Activity,
            },
        ],
    },
    {
        id: 'admin_system',
        title: 'Administration & System',
        description: 'Agent directory, security audit logs, automations, and system health',
        icon: Shield,
        resources: [
            {
                key: 'agents',
                label: 'Agents & User Management',
                description: 'User access control, agent roles, and permission preset assignments',
                icon: Users,
            },
            {
                key: 'automation',
                label: 'Automation Rules',
                description: 'Auto-assignment rules, ticket triggers, and escalation policies',
                icon: Zap,
            },
            {
                key: 'audit_logs',
                label: 'Security Audit Logs',
                description: 'Comprehensive system activity logs, logins, and audit trails',
                icon: ShieldCheck,
            },
            {
                key: 'system_health',
                label: 'System Health & Metrics',
                description: 'Server status, database performance, and Redis cache health',
                icon: Activity,
            },
            {
                key: 'settings',
                label: 'System Settings',
                description: 'Global system configurations, SLA targets, and site parameters',
                icon: Settings,
            },
        ],
    },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap(cat => cat.resources.map(r => r.key));

/** Sanitize pageAccess object to ensure only valid keys and aliases are sent to server */
const sanitizePageAccess = (raw?: Record<string, any>): Record<string, boolean> => {
    if (!raw) return {};
    const sanitized: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(raw)) {
        if (key === 'eform') {
            sanitized['eform_access'] = Boolean(val);
        } else if (key === 'users') {
            sanitized['agents'] = Boolean(val);
        } else if (ALL_PERMISSION_KEYS.includes(key)) {
            sanitized[key] = Boolean(val);
        }
    }
    return sanitized;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface PermissionCardProps {
    meta: PermissionResourceMeta;
    isEnabled: boolean;
    onToggle: (key: string, enabled: boolean) => void;
    disabled?: boolean;
}

const PermissionCard: React.FC<PermissionCardProps> = ({ meta, isEnabled, onToggle, disabled }) => {
    const Icon = meta.icon;

    return (
        <div
            onClick={() => !disabled && onToggle(meta.key, !isEnabled)}
            className={cn(
                "group relative flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all duration-200 cursor-pointer select-none",
                isEnabled
                    ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60 shadow-xs"
                    : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
                disabled && "cursor-not-allowed opacity-60"
            )}
        >
            <div className="flex items-start gap-3 min-w-0">
                <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors mt-0.5",
                    isEnabled
                        ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                )}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                    <p className={cn(
                        "text-sm font-semibold leading-tight mb-1 transition-colors",
                        isEnabled
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-700 dark:text-slate-300"
                    )}>
                        {meta.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {meta.description}
                    </p>
                </div>
            </div>

            <div className="shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
                <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={`Access to ${meta.key}`}
                    disabled={disabled}
                    onClick={() => onToggle(meta.key, !isEnabled)}
                    className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        isEnabled ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
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
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const PresetDrawer: React.FC<PresetDrawerProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Partial<PermissionPreset>>({});
    const [isDirty, setIsDirty] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const drawerRef = useRef<HTMLDivElement>(null);

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
        setDraft({
            ...preset,
            pageAccess: sanitizePageAccess(preset.pageAccess),
        });
        setIsDirty(false);
    }, []);

    const startNew = useCallback(() => {
        setSelectedId(NEW_PRESET_ID);
        setDraft({ ...EMPTY_PRESET });
        setIsDirty(true);
    }, []);

    const closeDrawer = useCallback(() => {
        setSelectedId(null);
        setDraft({});
        setIsDirty(false);
        onClose();
    }, [onClose]);

    /** Any navigation away from a dirty draft must be confirmed first. */
    const requestClose = useCallback(() => {
        if (isDirty) {
            setPendingAction({ type: 'close' });
            return;
        }
        closeDrawer();
    }, [isDirty, closeDrawer]);

    const requestSelect = useCallback((preset: PermissionPreset) => {
        if (isDirty && preset.id !== selectedId) {
            setPendingAction({ type: 'select', preset });
            return;
        }
        selectPreset(preset);
    }, [isDirty, selectedId, selectPreset]);

    const requestNew = useCallback(() => {
        if (isDirty) {
            setPendingAction({ type: 'new' });
            return;
        }
        startNew();
    }, [isDirty, startNew]);

    const discardAndContinue = useCallback(() => {
        if (!pendingAction) return;
        setPendingAction(null);
        if (pendingAction.type === 'close') closeDrawer();
        else if (pendingAction.type === 'new') startNew();
        else selectPreset(pendingAction.preset);
    }, [pendingAction, closeDrawer, startNew, selectPreset]);

    useFocusTrap(drawerRef, { enabled: isOpen, onEscape: requestClose });

    useEffect(() => {
        if (!isOpen) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [isOpen]);

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

    const toggleCategoryAll = (resources: PermissionResourceMeta[], targetState: boolean) => {
        setDraft(prev => {
            const newPageAccess = { ...prev.pageAccess };
            const newPermissions = { ...prev.permissions };
            resources.forEach(r => {
                newPageAccess[r.key] = targetState;
                newPermissions[r.key] = {
                    canView: targetState,
                    canCreate: targetState,
                    canEdit: targetState,
                    canDelete: targetState,
                };
            });
            return {
                ...prev,
                pageAccess: newPageAccess,
                permissions: newPermissions,
            };
        });
        setIsDirty(true);
    };

    const toggleAllGlobal = (targetState: boolean) => {
        setDraft(prev => {
            const newPageAccess: Record<string, boolean> = {};
            const newPermissions: PermissionMap = {};
            ALL_PERMISSION_KEYS.forEach(key => {
                newPageAccess[key] = targetState;
                newPermissions[key] = {
                    canView: targetState,
                    canCreate: targetState,
                    canEdit: targetState,
                    canDelete: targetState,
                };
            });
            return {
                ...prev,
                pageAccess: newPageAccess,
                permissions: newPermissions,
            };
        });
        setIsDirty(true);
    };

    // ── Mutations ──
    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                name: draft.name,
                description: draft.description,
                targetRole: draft.targetRole,
                pageAccess: sanitizePageAccess(draft.pageAccess),
                permissions: draft.permissions,
            };
            if (selectedId === NEW_PRESET_ID) {
                return api.post('/permissions/presets', payload);
            }
            return api.put(`/permissions/presets/${selectedId}`, payload);
        },
        onSuccess: (res) => {
            toast.success('Preset saved successfully');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
            setIsDirty(false);
            if (selectedId === NEW_PRESET_ID) {
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
                name: `${preset.name} (Copy)`,
                description: preset.description,
                targetRole: preset.targetRole,
                pageAccess: sanitizePageAccess(preset.pageAccess),
                permissions: preset.permissions,
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

    // ── Filtered presets ──
    const filteredPresets = useMemo(() => {
        return presets.filter(p => {
            const matchesSearch = search
                ? p.name.toLowerCase().includes(search.toLowerCase()) ||
                  p.description?.toLowerCase().includes(search.toLowerCase())
                : true;
            const matchesRole = roleFilter === 'ALL' || p.targetRole === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [presets, search, roleFilter]);

    const selectedPreset = presets.find(p => p.id === selectedId);
    const deletedPreset = presets.find(p => p.id === deletingId);
    const deletedPresetName = deletedPreset?.name ?? 'This preset';
    const deletedPresetUsage = deletedPreset?.usageCount ?? 0;
    const isNew = selectedId === NEW_PRESET_ID;
    const isSystem = Boolean(selectedPreset?.isSystem && !isNew);

    // Count enabled permissions
    const activePermissionsCount = useMemo(() => {
        if (!draft.pageAccess) return 0;
        return ALL_PERMISSION_KEYS.filter(k => draft.pageAccess?.[k] === true).length;
    }, [draft.pageAccess]);

    const roleCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: presets.length };
        presets.forEach(p => {
            if (p.targetRole) {
                counts[p.targetRole] = (counts[p.targetRole] || 0) + 1;
            }
        });
        return counts;
    }, [presets]);

    return (
        <>
            {/* Backdrop Overlay */}
            <div
                className={cn(
                    'fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity duration-300',
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none invisible'
                )}
                onClick={requestClose}
            />

            {/* Slide-over Drawer */}
            <div
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="preset-drawer-title"
                className={cn(
                    'fixed top-0 right-0 h-full w-full max-w-6xl bg-white dark:bg-slate-900 shadow-2xl z-50',
                    'flex flex-col border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    isOpen ? 'translate-x-0 visible' : 'translate-x-full invisible'
                )}
            >
                {/* ── Top Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 backdrop-blur-md">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 id="preset-drawer-title" className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                    Permission Presets
                                </h2>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {presets.length} Presets
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Configure role-based access rights and feature access across the iDesk platform
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={requestClose}
                        aria-label="Close permission presets"
                        className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Body — 2 Columns ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Left: Preset Browser ── */}
                    <div className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/30 dark:bg-slate-900/30">
                        {/* Search & Actions */}
                        <div className="p-3.5 space-y-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search preset name..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Role Filter Pills */}
                            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                                {['ALL', 'ADMIN', 'MANAGER', 'AGENT', 'USER'].map(role => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => setRoleFilter(role)}
                                        className={cn(
                                            "px-2.5 py-1 text-[11px] font-semibold rounded-lg shrink-0 transition-all cursor-pointer",
                                            roleFilter === role
                                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                        )}
                                    >
                                        {role === 'ALL' ? 'All' : role.charAt(0) + role.slice(1).toLowerCase()}
                                        <span className="ml-1 opacity-70 text-[10px]">
                                            ({roleCounts[role] || 0})
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={requestNew}
                                className="w-full flex items-center justify-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                Create New Preset
                            </button>
                        </div>

                        {/* Presets List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                            {isLoading ? (
                                <div className="p-6 text-center text-xs text-slate-400">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    Loading presets...
                                </div>
                            ) : (
                                <>
                                    {isNew && (
                                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Drafting New Preset</p>
                                                <p className="text-[11px] text-blue-600/80 dark:text-blue-400">Set permissions on the right</p>
                                            </div>
                                        </div>
                                    )}

                                    {filteredPresets.map(preset => {
                                        const isSelected = selectedId === preset.id && !isNew;
                                        const roleStyle = ROLE_BADGES[preset.targetRole || 'USER'] || ROLE_BADGES.USER;

                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => requestSelect(preset)}
                                                aria-current={isSelected}
                                                className={cn(
                                                    'w-full text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer group relative',
                                                    isSelected
                                                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 shadow-xs ring-1 ring-blue-500/20'
                                                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-2xs'
                                                )}
                                            >
                                                {isSelected && (
                                                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 rounded-r-full" />
                                                )}

                                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {preset.isSystem && (
                                                            <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                                        )}
                                                        <span className={cn(
                                                            "text-xs font-bold truncate",
                                                            isSelected
                                                                ? "text-blue-950 dark:text-blue-100"
                                                                : "text-slate-800 dark:text-slate-200"
                                                        )}>
                                                            {preset.name}
                                                        </span>
                                                    </div>

                                                    {preset.targetRole && (
                                                        <span className={cn(
                                                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider shrink-0",
                                                            roleStyle.bg,
                                                            roleStyle.text,
                                                            roleStyle.border
                                                        )}>
                                                            {preset.targetRole}
                                                        </span>
                                                    )}
                                                </div>

                                                {preset.description && (
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2 leading-relaxed">
                                                        {preset.description}
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                                                    <span className="flex items-center gap-1">
                                                        <UserCheck className="w-3 h-3 text-slate-400" />
                                                        {preset.usageCount ? `${preset.usageCount.toLocaleString()} users` : '0 users'}
                                                    </span>
                                                    <ChevronRight className={cn(
                                                        "w-3.5 h-3.5 transition-transform",
                                                        isSelected ? "text-blue-600 dark:text-blue-400 translate-x-0.5" : "text-slate-300 opacity-60"
                                                    )} />
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {filteredPresets.length === 0 && (
                                        <div className="p-8 text-center text-xs text-slate-400">
                                            <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            No presets found matching filter
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Preset Editor ── */}
                    {selectedId ? (
                        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                            {/* Editor Header Bar */}
                            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                                <div className="flex items-center gap-3">
                                    {isSystem ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                                            <Lock className="w-3.5 h-3.5" />
                                            System Default Preset
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Custom Preset
                                        </span>
                                    )}

                                    {isDirty && (
                                        <span role="status" className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                            Unsaved changes
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {!isNew && selectedPreset && (
                                        <button
                                            type="button"
                                            onClick={() => cloneMutation.mutate(selectedPreset)}
                                            disabled={cloneMutation.isPending}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            Clone
                                        </button>
                                    )}

                                    {!isNew && selectedPreset && !isSystem && (
                                        <button
                                            type="button"
                                            onClick={() => setDeletingId(selectedId)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => saveMutation.mutate()}
                                        disabled={saveMutation.isPending || !isDirty || !draft.name}
                                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-xl shadow-xs hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        {saveMutation.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>

                            {/* Editor Form Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                                {/* Metadata Card */}
                                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                            Preset Details
                                        </h3>
                                        {isSystem && (
                                            <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                <Info className="w-3 h-3" />
                                                Name and target role are locked for system presets
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="preset-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Preset Name <span className="text-rose-500" aria-hidden="true">*</span>
                                            </label>
                                            <input
                                                id="preset-name"
                                                type="text"
                                                required
                                                disabled={isSystem}
                                                value={draft.name || ''}
                                                onChange={e => updateDraft({ name: e.target.value })}
                                                placeholder="e.g. Senior Helpdesk Agent"
                                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="preset-target-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Target Role
                                            </label>
                                            <select
                                                id="preset-target-role"
                                                disabled={isSystem}
                                                value={draft.targetRole || ''}
                                                onChange={e => updateDraft({ targetRole: e.target.value as PermissionPreset['targetRole'] })}
                                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                            >
                                                <option value="">Any Role</option>
                                                <option value="ADMIN">Admin</option>
                                                <option value="MANAGER">Manager</option>
                                                <option value="AGENT">Agent</option>
                                                <option value="USER">User</option>
                                            </select>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label htmlFor="preset-description" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Description
                                            </label>
                                            <textarea
                                                id="preset-description"
                                                value={draft.description || ''}
                                                onChange={e => updateDraft({ description: e.target.value })}
                                                rows={2}
                                                placeholder="Explain what access rights and responsibilities this preset provides..."
                                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 resize-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Permissions Matrix by Category */}
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                                    Permissions & Page Access
                                                </h3>
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                                                    {activePermissionsCount} of {ALL_PERMISSION_KEYS.length} Active
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                Toggle which modules and screens users assigned to this preset can access
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => toggleAllGlobal(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                            >
                                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                Enable All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleAllGlobal(false)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                            >
                                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                                Disable All
                                            </button>
                                        </div>
                                    </div>

                                    {/* Categories */}
                                    <div className="space-y-4">
                                        {PERMISSION_CATEGORIES.map(category => {
                                            const CategoryIcon = category.icon;
                                            const categoryEnabledCount = category.resources.filter(
                                                r => draft.pageAccess?.[r.key] === true
                                            ).length;
                                            const allCategoryEnabled = categoryEnabledCount === category.resources.length;

                                            return (
                                                <div
                                                    key={category.id}
                                                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5"
                                                >
                                                    {/* Category Header */}
                                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                                                                <CategoryIcon className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                                                        {category.title}
                                                                    </h4>
                                                                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                                                        ({categoryEnabledCount}/{category.resources.length})
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                    {category.description}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCategoryAll(category.resources, !allCategoryEnabled)}
                                                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                        >
                                                            {allCategoryEnabled ? 'Disable Group' : 'Enable Group'}
                                                        </button>
                                                    </div>

                                                    {/* Grid of Permission Cards */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {category.resources.map(res => (
                                                            <PermissionCard
                                                                key={res.key}
                                                                meta={res}
                                                                isEnabled={draft.pageAccess?.[res.key] === true}
                                                                onToggle={togglePermission}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50/30 dark:bg-slate-900/30 p-8">
                            <div className="text-center max-w-sm">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-4 shadow-inner">
                                    <ShieldCheck className="w-8 h-8 opacity-40" />
                                </div>
                                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Select a Preset to View & Edit
                                </h3>
                                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                                    Select any existing permission preset from the left panel, or create a brand new custom preset.
                                </p>
                                <button
                                    type="button"
                                    onClick={requestNew}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create New Preset
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Delete Confirmation Dialog ── */}
            <ConfirmDialog
                isOpen={Boolean(deletingId)}
                onClose={() => setDeletingId(null)}
                onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
                title="Delete Preset"
                message={
                    deletedPresetUsage > 0
                        ? `"${deletedPresetName}" is currently applied to ${deletedPresetUsage} user(s). Deleting it will cause them to fall back to their role defaults. This cannot be undone.`
                        : `Are you sure you want to delete "${deletedPresetName}"? This action cannot be undone.`
                }
                confirmText="Delete Preset"
                variant="danger"
                isLoading={deleteMutation.isPending}
            />

            {/* ── Unsaved Changes Guard Dialog ── */}
            <ConfirmDialog
                isOpen={Boolean(pendingAction)}
                onClose={() => setPendingAction(null)}
                onConfirm={discardAndContinue}
                title="Discard unsaved changes?"
                message={`You have unsaved changes to "${draft.name || 'this preset'}". If you leave now, your changes will be discarded.`}
                confirmText="Discard"
                cancelText="Keep Editing"
                variant="warning"
            />
        </>
    );
};
