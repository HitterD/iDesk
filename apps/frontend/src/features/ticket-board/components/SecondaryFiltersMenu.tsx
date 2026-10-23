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
        <div className="flex items-center gap-2">
            {/* Refresh (mockup .pop.icon-pop "Muat ulang") */}
            <button type="button" onClick={onRefresh} className="queue-pop queue-pop-icon" title="Muat ulang" aria-label="Muat ulang">
                <RefreshCw aria-hidden="true" />
            </button>

            {/* Saved filters, export and reset ("Lainnya") */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="queue-pop queue-pop-icon relative" title="Lainnya" aria-label="Lainnya">
                        <MoreHorizontal aria-hidden="true" />
                        {hasActiveFilters && <span className="queue-pop-dot" aria-hidden="true" />}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Lainnya
                    </DropdownMenuLabel>

                    {/* Saved Filters Section */}
                    <div className="px-2 py-1.5">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-2">
                            <Bookmark className="w-4 h-4" />
                            <span>Filter tersimpan</span>
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
                            <span>Ekspor data</span>
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
                                <span>Reset filter</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
