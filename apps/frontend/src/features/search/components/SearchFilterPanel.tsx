import React from 'react';
import { Calendar, Filter, X } from 'lucide-react';
import { SearchFilters } from '../hooks/useSearch';

interface SearchFilterPanelProps {
    filters: SearchFilters;
    onFiltersChange: (filters: SearchFilters) => void;
    onClose?: () => void;
}

const STATUSES = ['TODO', 'IN_PROGRESS', 'WAITING_VENDOR', 'RESOLVED', 'CANCELLED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({
    filters,
    onFiltersChange,
    onClose,
}) => {
    const toggleStatus = (status: string) => {
        const current = filters.status || [];
        const updated = current.includes(status)
            ? current.filter(s => s !== status)
            : [...current, status];
        onFiltersChange({ ...filters, status: updated.length > 0 ? updated : undefined });
    };

    const togglePriority = (priority: string) => {
        const current = filters.priority || [];
        const updated = current.includes(priority)
            ? current.filter(p => p !== priority)
            : [...current, priority];
        onFiltersChange({ ...filters, priority: updated.length > 0 ? updated : undefined });
    };

    const setDateRange = (start: string, end: string) => {
        if (start && end) {
            onFiltersChange({ ...filters, dateRange: { start, end } });
        } else {
            const { dateRange, ...rest } = filters;
            onFiltersChange(rest);
        }
    };

    const clearFilters = () => {
        onFiltersChange({});
    };

    const hasActiveFilters = Boolean(
        filters.status?.length ||
        filters.priority?.length ||
        filters.dateRange ||
        filters.assignedTo ||
        filters.department
    );

    return (
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Filter className="w-4 h-4" />
                    <span>Filters</span>
                </div>
                <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-xs text-slate-400 hover:text-white"
                        >
                            Clear all
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    )}
                </div>
            </div>

            {/* Status Filter */}
            <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-2">Status</label>
                <div className="flex flex-wrap gap-1">
                    {STATUSES.map(status => (
                        <button
                            key={status}
                            onClick={() => toggleStatus(status)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                                filters.status?.includes(status)
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            {status.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Priority Filter */}
            <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-2">Priority</label>
                <div className="flex flex-wrap gap-1">
                    {PRIORITIES.map(priority => (
                        <button
                            key={priority}
                            onClick={() => togglePriority(priority)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                                filters.priority?.includes(priority)
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            {priority}
                        </button>
                    ))}
                </div>
            </div>

            {/* Date Range Filter */}
            <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-2">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Date Range
                </label>
                <div className="flex gap-2">
                    <input
                        type="date"
                        value={filters.dateRange?.start || ''}
                        onChange={(e) => setDateRange(e.target.value, filters.dateRange?.end || '')}
                        className="flex-1 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white"
                    />
                    <span className="text-slate-500 self-center">to</span>
                    <input
                        type="date"
                        value={filters.dateRange?.end || ''}
                        onChange={(e) => setDateRange(filters.dateRange?.start || '', e.target.value)}
                        className="flex-1 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white"
                    />
                </div>
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
                <div className="pt-3 border-t border-slate-700">
                    <div className="text-xs text-slate-400">
                        Active filters: {' '}
                        {[
                            filters.status?.length && `${filters.status.length} status`,
                            filters.priority?.length && `${filters.priority.length} priority`,
                            filters.dateRange && 'date range',
                        ].filter(Boolean).join(', ')}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchFilterPanel;
