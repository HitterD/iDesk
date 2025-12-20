import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Settings, ChevronDown, ChevronRight, Ticket, Calendar, BookOpen, BarChart3, DollarSign, Key, Bell, RefreshCw, Search, Eye, Plus, Edit3, Trash2, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useFeatureDefinitions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

// Category icons mapping
const CATEGORY_ICONS: Record<string, React.ElementType> = {
    'Ticketing': Ticket,
    'Scheduling': Calendar,
    'Resources': BookOpen,
    'Analytics': BarChart3,
    'Finance': DollarSign,
    'Operations': RefreshCw,
    'Security': Key,
    'System': Bell,
};

// Permission action icons and labels
const PERMISSION_ACTIONS = [
    { key: 'canView', icon: Eye, label: 'View', color: 'emerald' },
    { key: 'canCreate', icon: Plus, label: 'Create', color: 'blue' },
    { key: 'canEdit', icon: Edit3, label: 'Edit', color: 'amber' },
    { key: 'canDelete', icon: Trash2, label: 'Delete', color: 'red' },
] as const;

// Role-based default permission templates
type PermissionSet = Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;

const ROLE_TEMPLATES: { key: string; name: string; description: string; color: string; permissions: PermissionSet }[] = [
    {
        key: 'user',
        name: 'User',
        description: 'Basic user - create tickets, book Zoom',
        color: 'slate',
        permissions: {
            'ticketing.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'ticketing.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'ticketing.edit': { canView: false, canCreate: false, canEdit: true, canDelete: false },
            'zoom_calendar.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'zoom_calendar.book': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'knowledge_base.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'lost_item.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'access_request.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'access_request.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'settings.view': { canView: true, canCreate: false, canEdit: true, canDelete: false },
        },
    },
    {
        key: 'agent',
        name: 'Agent',
        description: 'Helpdesk agent - manage tickets, view reports',
        color: 'blue',
        permissions: {
            'ticketing.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.edit': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.manage': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.assign': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.escalate': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'zoom_calendar.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'zoom_calendar.book': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'knowledge_base.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'knowledge_base.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'knowledge_base.edit': { canView: true, canCreate: false, canEdit: true, canDelete: false },
            'reports.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'reports.dashboard': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'lost_item.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'lost_item.manage': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'access_request.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'access_request.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'renewal.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'settings.view': { canView: true, canCreate: false, canEdit: true, canDelete: false },
        },
    },
    {
        key: 'manager',
        name: 'Manager',
        description: 'Team lead - delete, approve, full reports',
        color: 'amber',
        permissions: {
            'ticketing.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.edit': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.delete': { canView: true, canCreate: false, canEdit: false, canDelete: true },
            'ticketing.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.assign': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.escalate': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'zoom_calendar.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'zoom_calendar.book': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'zoom_calendar.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'knowledge_base.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'knowledge_base.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'knowledge_base.edit': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'reports.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'reports.dashboard': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'reports.export': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'ict_budget.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'lost_item.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'lost_item.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'access_request.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'access_request.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'access_request.approve': { canView: true, canCreate: false, canEdit: true, canDelete: false },
            'renewal.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'renewal.manage': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'settings.view': { canView: true, canCreate: false, canEdit: true, canDelete: false },
        },
    },
    {
        key: 'admin',
        name: 'Admin',
        description: 'Full access - all permissions enabled',
        color: 'violet',
        permissions: {
            'ticketing.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.create': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.edit': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.delete': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.assign': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.escalate': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'zoom_calendar.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'zoom_calendar.book': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'zoom_calendar.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'knowledge_base.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'knowledge_base.create': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'knowledge_base.edit': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'reports.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'reports.dashboard': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'reports.export': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ict_budget.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ict_budget.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'lost_item.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'lost_item.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'access_request.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'access_request.create': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'access_request.approve': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'renewal.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'renewal.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'notifications.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'settings.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
        },
    },
];


interface PresetEditorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    preset?: {
        id: string;
        name: string;
        description?: string;
        permissions: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;
        isSystem?: boolean;
    } | null;
}

export const PresetEditorDialog: React.FC<PresetEditorDialogProps> = ({ isOpen, onClose, preset }) => {
    const queryClient = useQueryClient();
    const { data: features = [] } = useFeatureDefinitions();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [permissions, setPermissions] = useState<Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>>({});
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Group features by category
    const featuresByCategory = useMemo(() => {
        const grouped: Record<string, typeof features> = {};
        for (const feature of features) {
            const cat = feature.category || 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(feature);
        }
        return grouped;
    }, [features]);

    // Filter features by search
    const filteredFeaturesByCategory = useMemo(() => {
        if (!searchQuery.trim()) return featuresByCategory;

        const query = searchQuery.toLowerCase();
        const filtered: Record<string, typeof features> = {};

        for (const [category, categoryFeatures] of Object.entries(featuresByCategory)) {
            const matching = categoryFeatures.filter(f =>
                f.name.toLowerCase().includes(query) ||
                f.description?.toLowerCase().includes(query)
            );
            if (matching.length > 0) {
                filtered[category] = matching;
            }
        }
        return filtered;
    }, [featuresByCategory, searchQuery]);

    // Initialize from preset
    useEffect(() => {
        if (preset) {
            setName(preset.name);
            setDescription(preset.description || '');
            setPermissions(preset.permissions || {});
        } else {
            setName('');
            setDescription('');
            setPermissions({});
        }
        // Collapse all by default, expand first one
        const categories = Object.keys(featuresByCategory);
        setExpandedCategories(new Set(categories.slice(0, 1)));
        setSearchQuery('');
    }, [preset, isOpen, featuresByCategory]);

    // Expand all matching categories when searching
    useEffect(() => {
        if (searchQuery.trim()) {
            setExpandedCategories(new Set(Object.keys(filteredFeaturesByCategory)));
        }
    }, [searchQuery, filteredFeaturesByCategory]);

    // Toggle permission
    const togglePermission = (featureKey: string, action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') => {
        setPermissions(prev => {
            const current = prev[featureKey] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
            return {
                ...prev,
                [featureKey]: {
                    ...current,
                    [action]: !current[action],
                },
            };
        });
    };

    // Toggle all permissions for a category
    const toggleCategoryAll = (category: string, enabled: boolean) => {
        const categoryFeatures = featuresByCategory[category] || [];
        setPermissions(prev => {
            const next = { ...prev };
            for (const feature of categoryFeatures) {
                next[feature.key] = { canView: enabled, canCreate: enabled, canEdit: enabled, canDelete: enabled };
            }
            return next;
        });
    };

    // Get category stats
    const getCategoryStats = (category: string) => {
        const categoryFeatures = featuresByCategory[category] || [];
        let enabled = 0;
        for (const feature of categoryFeatures) {
            const perm = permissions[feature.key];
            if (perm && (perm.canView || perm.canCreate || perm.canEdit || perm.canDelete)) {
                enabled++;
            }
        }
        return { enabled, total: categoryFeatures.length };
    };

    // Check if all enabled in category
    const isCategoryAllEnabled = (category: string) => {
        const categoryFeatures = featuresByCategory[category] || [];
        return categoryFeatures.every(f => {
            const p = permissions[f.key];
            return p && p.canView && p.canCreate && p.canEdit && p.canDelete;
        });
    };

    // Toggle category expansion
    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) next.delete(category);
            else next.add(category);
            return next;
        });
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            const data = { name, description, permissions };
            if (preset?.id) {
                return api.put(`/permissions/presets/${preset.id}`, data);
            } else {
                return api.post('/permissions/presets', data);
            }
        },
        onSuccess: () => {
            toast.success(preset?.id ? 'Preset updated' : 'Preset created');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to save preset');
        },
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-violet-500 to-purple-600 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        {preset?.id ? 'Edit Preset' : 'Create Preset'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Name & Description */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                                Preset Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Marketing Team"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Description</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional description"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Role Templates - Quick Start */}
                    <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-violet-500" />
                            Start from Template:
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {ROLE_TEMPLATES.map(template => {
                                const colorClasses = {
                                    slate: 'border-slate-300 hover:border-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700',
                                    blue: 'border-blue-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                                    amber: 'border-amber-300 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
                                    violet: 'border-violet-300 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20',
                                };
                                const badgeClasses = {
                                    slate: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200',
                                    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                                    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                                    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
                                };

                                return (
                                    <button
                                        key={template.key}
                                        type="button"
                                        onClick={() => {
                                            setPermissions(template.permissions);
                                            if (!name.trim()) setName(template.name);
                                            if (!description.trim()) setDescription(template.description);
                                            toast.success(`Loaded ${template.name} template`);
                                        }}
                                        className={cn(
                                            "flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left",
                                            colorClasses[template.color as keyof typeof colorClasses] || colorClasses.slate,
                                            "dark:border-slate-600 dark:bg-slate-800"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-xs font-bold px-2 py-0.5 rounded-md mb-1.5",
                                            badgeClasses[template.color as keyof typeof badgeClasses] || badgeClasses.slate
                                        )}>
                                            {template.name}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                            {template.description}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search features..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                            >
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        )}
                    </div>

                    {/* Permission Legend */}
                    <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Legend:</span>
                        {PERMISSION_ACTIONS.map(action => (
                            <div key={action.key} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                <action.icon className="w-3.5 h-3.5" />
                                <span>{action.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Permissions by Category */}
                    <div className="space-y-3">
                        {Object.keys(filteredFeaturesByCategory).length === 0 ? (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p>No features match "{searchQuery}"</p>
                            </div>
                        ) : (
                            Object.entries(filteredFeaturesByCategory).map(([category, categoryFeatures]) => {
                                const CategoryIcon = CATEGORY_ICONS[category] || Settings;
                                const isExpanded = expandedCategories.has(category);
                                const stats = getCategoryStats(category);
                                const allEnabled = isCategoryAllEnabled(category);

                                return (
                                    <div key={category} className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                                        {/* Category Header */}
                                        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => toggleCategory(category)}
                                                className="flex items-center gap-3 flex-1 text-left"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-slate-500" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-slate-500" />
                                                )}
                                                <CategoryIcon className="w-5 h-5 text-violet-600" />
                                                <span className="font-semibold text-slate-800 dark:text-white">{category}</span>
                                                <span className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full",
                                                    stats.enabled > 0
                                                        ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                                                        : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                                                )}>
                                                    {stats.enabled}/{stats.total}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleCategoryAll(category, !allEnabled)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                                    allEnabled
                                                        ? "bg-violet-500 text-white hover:bg-violet-600"
                                                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                                )}
                                            >
                                                {allEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                                {allEnabled ? 'All On' : 'Enable All'}
                                            </button>
                                        </div>

                                        {/* Features in Category */}
                                        {isExpanded && (
                                            <div className="p-3 space-y-2 bg-white dark:bg-slate-900">
                                                {categoryFeatures.map((feature) => {
                                                    const perm = permissions[feature.key] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
                                                    const enabledCount = [perm.canView, perm.canCreate, perm.canEdit, perm.canDelete].filter(Boolean).length;

                                                    return (
                                                        <div
                                                            key={feature.key}
                                                            className={cn(
                                                                "flex items-center gap-4 p-3 rounded-xl border transition-all",
                                                                enabledCount > 0
                                                                    ? "bg-violet-50/50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800/50"
                                                                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                                                            )}
                                                        >
                                                            {/* Feature Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-slate-800 dark:text-white text-sm">
                                                                    {feature.name}
                                                                </p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                                    {feature.description}
                                                                </p>
                                                            </div>

                                                            {/* Permission Toggle Buttons */}
                                                            <div className="flex items-center gap-1">
                                                                {PERMISSION_ACTIONS.map(action => {
                                                                    const isEnabled = perm[action.key as keyof typeof perm];
                                                                    const colorClasses = {
                                                                        emerald: isEnabled ? 'bg-emerald-500 text-white shadow-emerald-500/30' : '',
                                                                        blue: isEnabled ? 'bg-blue-500 text-white shadow-blue-500/30' : '',
                                                                        amber: isEnabled ? 'bg-amber-500 text-white shadow-amber-500/30' : '',
                                                                        red: isEnabled ? 'bg-red-500 text-white shadow-red-500/30' : '',
                                                                    };

                                                                    return (
                                                                        <button
                                                                            key={action.key}
                                                                            type="button"
                                                                            onClick={() => togglePermission(feature.key, action.key as 'canView' | 'canCreate' | 'canEdit' | 'canDelete')}
                                                                            title={`${action.label} permission`}
                                                                            className={cn(
                                                                                "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                                                                                isEnabled
                                                                                    ? `${colorClasses[action.color]} shadow-lg`
                                                                                    : "bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                                                                            )}
                                                                        >
                                                                            <action.icon className="w-4 h-4" />
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => saveMutation.mutate()}
                        disabled={!name.trim() || saveMutation.isPending}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-500/25"
                    >
                        {saveMutation.isPending ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {preset?.id ? 'Update Preset' : 'Create Preset'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
