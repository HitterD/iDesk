import { CheckSquare, ChevronDown, Shield, MapPin, BarChart3, Trash2, LayoutGrid, List, Download, Upload, Settings, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface AgentManagementHeaderProps {
    selectedCount: number;
    viewMode: 'grid' | 'table';
    onViewModeChange: (mode: 'grid' | 'table') => void;
    onBulkRoleChange: () => void;
    onBulkSiteChange: () => void;
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
    onCompare,
    onBulkDelete,
    onExport,
    onImport,
    onManagePresets,
    onAddUser,
}: AgentManagementHeaderProps) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Agent Management</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage your support team by site and role</p>
            </div>
            <div className="flex gap-3">
                {/* Bulk Actions - show when users selected */}
                {selectedCount > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors duration-150"
                            >
                                <CheckSquare className="w-4 h-4" />
                                {selectedCount} Selected
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onBulkRoleChange}>
                                <Shield className="w-4 h-4" />
                                Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onBulkSiteChange}>
                                <MapPin className="w-4 h-4" />
                                Change Site
                            </DropdownMenuItem>
                            {selectedCount === 2 && (
                                <DropdownMenuItem onClick={onCompare}>
                                    <BarChart3 className="w-4 h-4" />
                                    Compare Agents
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={onBulkDelete}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Selected
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* P1-4: View Mode Toggle */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                        onClick={() => onViewModeChange('grid')}
                        className={cn(
                            "p-2 rounded-lg transition-[opacity,transform,colors] duration-200 ease-out",
                            viewMode === 'grid'
                                ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        )}
                        title="Grid View"
                        aria-label="Grid View"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onViewModeChange('table')}
                        className={cn(
                            "p-2 rounded-lg transition-[opacity,transform,colors] duration-200 ease-out",
                            viewMode === 'table'
                                ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        )}
                        title="Table View"
                        aria-label="Table View"
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>

                {/* P3-3: Secondary Actions Group */}
                <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onExport}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 text-sm"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                    <button
                        onClick={onImport}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 text-sm"
                    >
                        <Upload className="w-4 h-4" />
                        <span className="hidden sm:inline">Import</span>
                    </button>
                </div>

                {/* Manage Presets Button — opens PresetDrawer */}
                <button
                    onClick={onManagePresets}
                    className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-slate-700 dark:text-slate-200 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out text-sm"
                    title="Manage Permission Presets"
                    aria-label="Manage Permission Presets"
                >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Manage Presets</span>
                </button>

                {/* P3-3: Primary Action */}
                <button
                    onClick={onAddUser}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add User
                </button>
            </div>
        </div>
    );
}
