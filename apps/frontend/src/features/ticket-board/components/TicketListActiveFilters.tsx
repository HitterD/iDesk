import React, { useMemo } from 'react';
import { X, UserCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface TicketListActiveFiltersProps {
    statusFilter: string;
    setStatusFilter: (v: string) => void;
    priorityFilter: string;
    setPriorityFilter: (v: string) => void;
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    showAssignedToMe: boolean;
    setSearchParams: ReturnType<typeof useSearchParams>[1];
    selectedSites: string[];
    setSelectedSites: (v: string[]) => void;
    clearFilters: () => void;
}

export const TicketListActiveFilters: React.FC<TicketListActiveFiltersProps> = ({
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    searchQuery,
    setSearchQuery,
    showAssignedToMe,
    setSearchParams,
    selectedSites,
    setSelectedSites,
    clearFilters
}) => {
    const hasActiveFilters = Boolean(searchQuery || statusFilter || priorityFilter || showAssignedToMe || selectedSites.length > 0);

    if (!hasActiveFilters) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active filters:</span>
            {statusFilter && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium group">
                    Status: {statusFilter === 'TODO' ? 'Open' : statusFilter === 'IN_PROGRESS' ? 'In Progress' : statusFilter === 'WAITING_VENDOR' ? 'Waiting Vendor' : statusFilter}
                    <button
                        onClick={() => setStatusFilter('')}
                        className="w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-800 hover:bg-blue-300 dark:hover:bg-blue-700 flex items-center justify-center transition-colors"
                        aria-label="Remove status filter"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </span>
            )}
            {priorityFilter && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium group">
                    Priority: {priorityFilter}
                    <button
                        onClick={() => setPriorityFilter('')}
                        className="w-4 h-4 rounded-full bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 flex items-center justify-center transition-colors"
                        aria-label="Remove priority filter"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </span>
            )}
            {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium group">
                    Search: "{searchQuery.length > 20 ? searchQuery.slice(0, 20) + '...' : searchQuery}"
                    <button
                        onClick={() => setSearchQuery('')}
                        className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 flex items-center justify-center transition-colors"
                        aria-label="Clear search"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </span>
            )}
            {showAssignedToMe && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary rounded-full text-xs font-medium group">
                    <UserCheck className="w-3.5 h-3.5" />
                    My Tasks
                    <button
                        onClick={() => setSearchParams({})}
                        className="w-4 h-4 rounded-full bg-primary/30 hover:bg-primary/40 flex items-center justify-center transition-colors"
                        aria-label="Clear my tasks filter"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </span>
            )}
            {selectedSites.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium group">
                    Sites: {selectedSites.length}
                    <button
                        onClick={() => setSelectedSites([])}
                        className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-800 hover:bg-purple-300 dark:hover:bg-purple-700 flex items-center justify-center transition-colors"
                        aria-label="Clear site filter"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </span>
            )}
            <button
                onClick={clearFilters}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 underline transition-colors"
            >
                Clear all
            </button>
        </div>
    );
};
