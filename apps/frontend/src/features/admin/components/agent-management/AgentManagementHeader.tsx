import { CheckSquare, ChevronDown, Shield, MapPin, BarChart3, Trash2, LayoutGrid, List, Download, Upload, Settings, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface AgentManagementHeaderProps {
    selectedCount: number;
    viewMode: 'grid' | 'table';
    onViewModeChange: (mode: 'grid' | 'table') => void;
    onBulkRoleChange: () => void;
    onBulkSiteChange: () => void;
    onBulkPreset: () => void;
    onCompare: () => void;
    onBulkDelete: () => void;
    onExport: () => void;
    onImport: () => void;
    onManagePresets: () => void;
    onAddUser: () => void;
}

export function AgentManagementHeader({
    selectedCount,
    viewMode,
    onViewModeChange,
    onBulkRoleChange,
    onBulkSiteChange,
    onBulkPreset,
    onCompare,
    onBulkDelete,
    onExport,
    onImport,
    onManagePresets,
    onAddUser,
}: AgentManagementHeaderProps) {
    return (
        // Wraps instead of overflowing: eight controls plus the title never fitted a
        // tablet-width row, and the primary "Add User" was the first thing pushed off.
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Agent Management</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage your support team by site and role</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                {/* Bulk Actions - show when users selected */}
                {selectedCount > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label={`Bulk actions for ${selectedCount} selected ${selectedCount === 1 ? 'user' : 'users'}`}
                                className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors duration-150"
                            >
                                <CheckSquare className="w-4 h-4" aria-hidden="true" />
                                {selectedCount} Selected
                                <ChevronDown className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onBulkRoleChange}>
                                <Shield className="w-4 h-4" aria-hidden="true" />
                                Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onBulkSiteChange}>
                                <MapPin className="w-4 h-4" aria-hidden="true" />
                                Change Site
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onBulkPreset}>
                                <Sparkles className="w-4 h-4" aria-hidden="true" />
                                Apply Preset
                            </DropdownMenuItem>
                            {selectedCount === 2 && (
                                <DropdownMenuItem onClick={onCompare}>
                                    <BarChart3 className="w-4 h-4" aria-hidden="true" />
                                    Compare Agents
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={onBulkDelete}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                                Delete Selected
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* P1-4: View Mode Toggle */}
                <div role="group" aria-label="View mode" className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                        type="button"
                        onClick={() => onViewModeChange('grid')}
                        className={cn(
                            "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-[opacity,transform,colors] duration-200 ease-out",
                            viewMode === 'grid'
                                ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        )}
                        title="Grid View"
                        aria-label="Grid View"
                        aria-pressed={viewMode === 'grid'}
                    >
                        <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewModeChange('table')}
                        className={cn(
                            "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-[opacity,transform,colors] duration-200 ease-out",
                            viewMode === 'table'
                                ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        )}
                        title="Table View"
                        aria-label="Table View"
                        aria-pressed={viewMode === 'table'}
                    >
                        <List className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* P3-3: Secondary Actions Group */}
                <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-700">
                    {/* The label collapses below `sm`, so each button carries its own
                        aria-label — otherwise it reads as a nameless icon on mobile. */}
                    <button
                        type="button"
                        onClick={onExport}
                        aria-label="Export users"
                        className="flex items-center gap-2 px-3 py-2 min-h-[44px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 text-sm"
                    >
                        <Download className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                    <button
                        type="button"
                        onClick={onImport}
                        aria-label="Import users"
                        className="flex items-center gap-2 px-3 py-2 min-h-[44px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 text-sm"
                    >
                        <Upload className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Import</span>
                    </button>
                </div>

                {/* Manage Presets Button — opens PresetDrawer */}
                <button
                    type="button"
                    onClick={onManagePresets}
                    className="flex items-center gap-2 px-3 py-2 min-h-[44px] bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-slate-700 dark:text-slate-200 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out text-sm"
                    title="Manage Permission Presets"
                    aria-label="Manage Permission Presets"
                >
                    <Settings className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Manage Presets</span>
                </button>

                {/* P3-3: Primary Action */}
                <button
                    type="button"
                    onClick={onAddUser}
                    className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add User
                </button>
            </div>
        </div>
    );
}
