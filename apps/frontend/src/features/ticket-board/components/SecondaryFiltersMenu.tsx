import React from 'react';
import { MoreHorizontal, MapPin, Bookmark, Download, RefreshCw, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { SavedFiltersDropdown } from '@/components/ui/SavedFiltersDropdown';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { SavedFilter } from '@/hooks/useSavedFilters';
import { format } from 'date-fns';

interface SecondaryFiltersMenuProps {
    // Saved filters
    currentFilters: {
        status?: string[];
        priority?: string[];
        search?: string;
    };
    onApplySavedFilter: (filters: SavedFilter['filters'] | null) => void;

    // Export
    exportData: Array<{
        id: string;
        ticketNumber: string;
        title: string;
        site: string;
        status: string;
        priority: string;
        category: string;
        requester: string;
        assignedTo: string;
        createdAt: string;
    }>;

    // Refresh
    onRefresh: () => void;

    // Clear filters
    hasActiveFilters: boolean;
    onClearFilters: () => void;
}

export const SecondaryFiltersMenu: React.FC<SecondaryFiltersMenuProps> = ({
    currentFilters,
    onApplySavedFilter,
    exportData,
    onRefresh,
    hasActiveFilters,
    onClearFilters,
}) => {
    return (
        <div className="flex items-center gap-1">
            {/* Refresh Button - Always visible */}
            <button
                onClick={onRefresh}
                className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors rounded-lg text-slate-500 dark:text-slate-400"
                title="Refresh"
            >
                <RefreshCw className="w-4 h-4" />
            </button>

            {/* More Menu - Contains Saved Filters & Export */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="relative flex items-center gap-1.5 px-3 py-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium rounded-lg transition-colors duration-150 text-sm"
                    >
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">More</span>
                        {hasActiveFilters && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-primary text-slate-900 rounded-full text-[10px] font-bold flex items-center justify-center px-1 shadow-sm">
                                {[
                                    currentFilters.status?.length ? 1 : 0,
                                    currentFilters.priority?.length ? 1 : 0,
                                    currentFilters.search ? 1 : 0,
                                ].reduce((a, b) => a + b, 0)}
                            </span>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs text-slate-500 uppercase tracking-wide">
                        Actions
                    </DropdownMenuLabel>

                    {/* Saved Filters Section */}
                    <div className="px-2 py-1.5">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-2">
                            <Bookmark className="w-4 h-4" />
                            <span>Saved Filters</span>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                            <SavedFiltersDropdown
                                currentFilters={currentFilters}
                                onApplyFilter={onApplySavedFilter}
                            />
                        </div>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Export Section */}
                    <div className="px-2 py-1.5">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-2">
                            <Download className="w-4 h-4" />
                            <span>Export Data</span>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                            <ExportMenu
                                data={exportData}
                                filename={`tickets-${format(new Date(), 'yyyy-MM-dd')}`}
                                columns={[
                                    { key: 'ticketNumber', label: 'Ticket #' },
                                    { key: 'title', label: 'Title' },
                                    { key: 'site', label: 'Site' },
                                    { key: 'status', label: 'Status' },
                                    { key: 'priority', label: 'Priority' },
                                    { key: 'category', label: 'Category' },
                                    { key: 'requester', label: 'Requester' },
                                    { key: 'assignedTo', label: 'Assigned To' },
                                    { key: 'createdAt', label: 'Created At' },
                                ]}
                            />
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onClearFilters} variant="destructive">
                                <X className="w-4 h-4" />
                                <span>Clear All Filters</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
