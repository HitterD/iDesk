import React, { useState, useEffect } from 'react';
import { X, Save, LayoutDashboard, Ticket, Video, BookOpen, Bell, BarChart3, RefreshCw, DollarSign, Search, KeyRound, Users, Zap, Shield, Activity, Settings, Lock, MonitorSmartphone, FileText } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    USER_PAGES,
    AGENT_PAGES,
    MANAGER_PAGES,
    getPagesForRole,
    getDefaultPageAccess,
    type TargetRole,
    type PageDefinition
} from '@/lib/pageDefinitions';

// Icon mapping for page definitions
const ICON_MAP: Record<string, React.ElementType> = {
    LayoutDashboard, Ticket, Video, BookOpen, Bell, BarChart3,
    RefreshCw, DollarSign, Search, KeyRound, Users, Zap, Shield, Activity, Settings,
    MonitorSmartphone, FileText
};

interface PageAccess {
    [pageKey: string]: boolean;
}

interface PagePresetEditorProps {
    isOpen: boolean;
    onClose: () => void;
    preset?: {
        id: string;
        name: string;
        description?: string;
        targetRole?: TargetRole;
        pageAccess?: PageAccess;
        isSystem?: boolean;
    } | null;
}

export const PagePresetEditor: React.FC<PagePresetEditorProps> = ({ isOpen, onClose, preset }) => {
    const queryClient = useQueryClient();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [targetRole, setTargetRole] = useState<TargetRole>('AGENT');
    const [pageAccess, setPageAccess] = useState<PageAccess>({});

    // Get icon component from string name
    const getIcon = (iconName: string): React.ElementType => {
        return ICON_MAP[iconName] || LayoutDashboard;
    };

    // Escape key to close dialog
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Initialize from preset or defaults
    useEffect(() => {
        if (preset) {
            setName(preset.name);
            setDescription(preset.description || '');
            setTargetRole(preset.targetRole || 'AGENT');
            // For existing presets, if pageAccess is empty, enable all pages
            const existingAccess = preset.pageAccess || {};
            if (Object.keys(existingAccess).length === 0) {
                // Enable all pages for the preset's role
                const pages = getPagesForRole(preset.targetRole || 'AGENT');
                const defaultAccess: PageAccess = {};
                pages.forEach(p => {
                    if (!p.adminOnly || (preset.targetRole === 'ADMIN')) {
                        defaultAccess[p.key] = true;
                    }
                });
                setPageAccess(defaultAccess);
            } else {
                setPageAccess(existingAccess);
            }
        } else {
            // New preset - set defaults with ALL pages enabled
            setName('');
            setDescription('');
            setTargetRole('AGENT');
            // Default all pages to true for new presets (AGENT role)
            const defaultAccess: PageAccess = {};
            AGENT_PAGES.forEach(p => {
                // For new AGENT preset, include non-admin pages
                if (!p.adminOnly) {
                    defaultAccess[p.key] = true;
                }
            });
            setPageAccess(defaultAccess);
        }
    }, [preset, isOpen]);
    // When role changes, reset page access to that role's defaults
    const handleRoleChange = (newRole: TargetRole) => {
        setTargetRole(newRole);
        const pages = getPagesForRole(newRole);
        const defaultAccess: PageAccess = {};
        pages.forEach(p => {
            // Include admin pages only if newRole is ADMIN
            if (!p.adminOnly || newRole === 'ADMIN') {
                defaultAccess[p.key] = true;
            }
        });
        setPageAccess(defaultAccess);
    };

    // Toggle page access
    const togglePage = (pageKey: string) => {
        setPageAccess(prev => ({
            ...prev,
            [pageKey]: !prev[pageKey],
        }));
    };

    // Enable all pages
    const enableAll = () => {
        const pages = getPagesForRole(targetRole);
        const all: PageAccess = {};
        pages.forEach(p => {
            // Include admin pages only if targetRole is ADMIN
            if (!p.adminOnly || targetRole === 'ADMIN') {
                all[p.key] = true;
            }
        });
        setPageAccess(all);
    };

    // Disable all pages
    const disableAll = () => {
        setPageAccess({});
    };

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                name,
                description,
                targetRole,
                pageAccess,
                permissions: {}, // Required by database - send empty object, not undefined
            };
            if (preset?.id) {
                return api.put(`/permissions/presets/${preset.id}`, payload);
            } else {
                return api.post('/permissions/presets', payload);
            }
        },
        onSuccess: () => {
            toast.success(preset?.id ? 'Preset updated' : 'Preset created');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
            onClose();
        },
        onError: (error: any) => {
            // NestJS validation returns array of error messages
            const message = error.response?.data?.message;
            console.error('Preset save error:', error.response?.data);
            if (Array.isArray(message)) {
                toast.error(message.join(', ') || 'Validation failed');
            } else {
                toast.error(message || 'Failed to save preset');
            }
        },
    });

    const handleSave = () => {
        if (!name.trim()) {
            toast.error('Name is required');
            return;
        }
        saveMutation.mutate();
    };

    if (!isOpen) return null;

    const currentPages = getPagesForRole(targetRole);
    const enabledCount = Object.values(pageAccess).filter(Boolean).length;
    // Count total toggleable pages (admin pages only count for ADMIN role)
    const totalCount = currentPages.filter(p => !p.adminOnly || targetRole === 'ADMIN').length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog */}
            <div className="relative w-full max-w-lg bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            {preset?.id ? 'Edit Preset' : 'Create Preset'}
                        </h2>
                        <p className="text-sm text-slate-400">
                            {enabledCount}/{totalCount} pages enabled
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close preset editor"
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Name & Description */}
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Preset name..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={preset?.isSystem}
                        />
                        <input
                            type="text"
                            placeholder="Description (optional)..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Target Role Selector */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Target Role</label>
                        <div className="flex gap-2">
                            {(['USER', 'AGENT', 'MANAGER', 'ADMIN'] as TargetRole[]).map((role) => (
                                <button
                                    key={role}
                                    onClick={() => handleRoleChange(role)}
                                    disabled={preset?.isSystem}
                                    className={cn(
                                        'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-150',
                                        targetRole === role
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                    )}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={enableAll}
                            className="flex-1 py-1.5 px-3 bg-emerald-600/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-600/30 transition-colors"
                        >
                            Enable All
                        </button>
                        <button
                            onClick={disableAll}
                            className="flex-1 py-1.5 px-3 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition-colors"
                        >
                            Disable All
                        </button>
                    </div>

                    {/* Page Toggles */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300">Page Access</label>
                        <div className="grid gap-2">
                            {currentPages.map((page) => {
                                const Icon = getIcon(page.icon);
                                const isEnabled = pageAccess[page.key] === true;
                                // Only lock admin pages if NOT creating ADMIN preset
                                const isLocked = page.adminOnly && targetRole !== 'ADMIN';

                                return (
                                    <button
                                        key={page.key}
                                        onClick={() => !isLocked && togglePage(page.key)}
                                        disabled={isLocked}
                                        className={cn(
                                            'flex items-center gap-3 p-3 rounded-lg transition-colors duration-150 text-left',
                                            isLocked
                                                ? 'bg-slate-800/30 text-slate-500 cursor-not-allowed'
                                                : isEnabled
                                                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                                        )}
                                    >
                                        {isLocked ? (
                                            <Lock className="w-5 h-5" />
                                        ) : (
                                            <Icon className="w-5 h-5" />
                                        )}
                                        <span className="flex-1 font-medium">{page.name}</span>
                                        {isLocked ? (
                                            <span className="text-xs">Admin Only</span>
                                        ) : (
                                            <div
                                                className={cn(
                                                    'w-10 h-5 rounded-full transition-colors flex items-center',
                                                    isEnabled ? 'bg-emerald-500' : 'bg-slate-600'
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        'w-4 h-4 rounded-full bg-white shadow transition-transform',
                                                        isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700/50 bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saveMutation.isPending || !name.trim()}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saveMutation.isPending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Preset
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
