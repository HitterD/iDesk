import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    FileText,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    Shield,
    User,
    Ticket,
    Settings,
    LogIn,
    LogOut,
    Edit,
    Trash2,
    Plus,
    RefreshCw,
    Calendar,
    AlertTriangle,
    Loader2,
    X,
    Table2,
    GitBranch,
    ExternalLink,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { AuditStatsCards } from '../components/AuditStatsCards';
import { AuditExportButton } from '../components/AuditExportButton';
import { AuditUserFilter } from '../components/AuditUserFilter';
import { AuditTimelineView } from '../components/AuditTimelineView';
import { AuditActionFilter } from '../components/AuditActionFilter';
import { AuditEntityFilter } from '../components/AuditEntityFilter';
import { AuditTableSkeleton } from '../components/AuditTableSkeleton';
import { AuditDateRangePicker } from '../components/AuditDateRangePicker';
import { AuditAction, AUDIT_ACTION_CONFIG, ENTITY_TYPE_LABELS } from '../../../types/audit.types';
import { useDebounce } from '@/hooks/useDebounce';

interface AuditLog {
    id: string;
    userId: string;
    user?: {
        fullName: string;
        email: string;
    };
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    oldValue: Record<string, any> | null;
    newValue: Record<string, any> | null;
    ipAddress: string | null;
    description: string | null;
    createdAt: string;
}

interface AuditResponse {
    data: AuditLog[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    CREATE_TICKET: { icon: Plus, color: 'text-[hsl(var(--success-500))]', label: 'Ticket Created' },
    UPDATE_TICKET: { icon: Edit, color: 'text-[hsl(var(--info-500))]', label: 'Ticket Updated' },
    DELETE_TICKET: { icon: Trash2, color: 'text-[hsl(var(--error-500))]', label: 'Ticket Deleted' },
    ASSIGN_TICKET: { icon: User, color: 'text-[hsl(var(--primary))]', label: 'Ticket Assigned' },
    STATUS_CHANGE: { icon: RefreshCw, color: 'text-[hsl(var(--warning-500))]', label: 'Status Changed' },
    PRIORITY_CHANGE: { icon: AlertTriangle, color: 'text-[hsl(var(--warning-500))]', label: 'Priority Changed' },
    TICKET_REPLY: { icon: FileText, color: 'text-[hsl(var(--info-500))]', label: 'Ticket Reply' },
    TICKET_MERGE: { icon: Ticket, color: 'text-[hsl(var(--primary))]', label: 'Tickets Merged' },
    BULK_UPDATE: { icon: Settings, color: 'text-slate-500 dark:text-slate-400', label: 'Bulk Update' },
    USER_LOGIN: { icon: LogIn, color: 'text-[hsl(var(--success-500))]', label: 'User Login' },
    USER_LOGOUT: { icon: LogOut, color: 'text-slate-500 dark:text-slate-400', label: 'User Logout' },
    USER_CREATE: { icon: Plus, color: 'text-[hsl(var(--success-500))]', label: 'User Created' },
    USER_UPDATE: { icon: Edit, color: 'text-[hsl(var(--info-500))]', label: 'User Updated' },
    SETTINGS_CHANGE: { icon: Settings, color: 'text-[hsl(var(--primary))]', label: 'Settings Changed' },
    ARTICLE_CREATE: { icon: Plus, color: 'text-[hsl(var(--success-500))]', label: 'Article Created' },
    ARTICLE_UPDATE: { icon: Edit, color: 'text-[hsl(var(--info-500))]', label: 'Article Updated' },
    ARTICLE_DELETE: { icon: Trash2, color: 'text-[hsl(var(--error-500))]', label: 'Article Deleted' },
};

export const AuditLogPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState<string>('');
    const [entityFilter, setEntityFilter] = useState<string>('');
    const [userIdFilter, setUserIdFilter] = useState<string | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const limit = 25;

    // Debounce search query for server-side search
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Fetch audit logs with server-side search
    const { data: auditData, isLoading, refetch } = useQuery<AuditResponse>({
        queryKey: ['audit-logs', page, actionFilter, entityFilter, userIdFilter, debouncedSearch, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('page', page.toString());
            params.set('limit', limit.toString());
            if (actionFilter) params.set('action', actionFilter);
            if (entityFilter) params.set('entityType', entityFilter);
            if (userIdFilter) params.set('userId', userIdFilter);
            if (debouncedSearch) params.set('searchQuery', debouncedSearch);
            if (startDate) params.set('startDate', new Date(startDate).toISOString());
            if (endDate) params.set('endDate', new Date(endDate + 'T23:59:59').toISOString());
            const res = await api.get(`/audit?${params.toString()}`);
            return res.data;
        },
    });

    const logs = auditData?.data || [];
    const meta = auditData?.meta;

    // Clear all filters
    const clearFilters = useCallback(() => {
        setSearchQuery('');
        setActionFilter('');
        setEntityFilter('');
        setUserIdFilter(undefined);
        setStartDate('');
        setEndDate('');
        setPage(1);
    }, []);

    const hasActiveFilters = searchQuery || actionFilter || entityFilter || userIdFilter || startDate || endDate;

    // Count active filters for badge
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (actionFilter) count++;
        if (entityFilter) count++;
        if (userIdFilter) count++;
        if (startDate || endDate) count++;
        return count;
    }, [actionFilter, entityFilter, userIdFilter, startDate, endDate]);

    const toggleExpand = (id: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const ActionIcon = ({ action }: { action: string }) => {
        const config = ACTION_CONFIG[action] || { icon: FileText, color: 'text-slate-500 dark:text-slate-400', label: action };
        const Icon = config.icon;
        return <Icon className={`w-4 h-4 ${config.color}`} />;
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header — Flat Industrial Utilitarian */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Audit Logs</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                        Track all system activities and changes
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm text-sm"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <AuditExportButton
                        filters={{
                            action: actionFilter,
                            entityType: entityFilter,
                            startDate: startDate,
                            endDate: endDate,
                        }}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <AuditStatsCards />

            {/* Filters — Clean Panel */}
            <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))]">
                {/* Row 1: Search + View Toggle */}
                <div className="flex items-center gap-4 p-4 border-b border-[hsl(var(--border))]">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by user, entity ID, description..."
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-[hsl(var(--border))] rounded-xl text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors duration-150"
                        />
                    </div>

                    {/* View Toggle — Tab Pattern */}
                    <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1.5 border border-[hsl(var(--border))]">
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors duration-150",
                                viewMode === 'table'
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            )}
                        >
                            <Table2 className="w-4 h-4" />
                            Table
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors duration-150",
                                viewMode === 'timeline'
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            )}
                        >
                            <GitBranch className="w-4 h-4" />
                            Timeline
                        </button>
                    </div>
                </div>

                {/* Row 2: Filters - Collapsible */}
                <div className="bg-slate-50/50 dark:bg-slate-800/20">
                    {/* Collapse Toggle Header */}
                    <button
                        onClick={() => setFiltersExpanded(!filtersExpanded)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
                    >
                        <Filter className="w-3.5 h-3.5" />
                        <span>Filters</span>
                        {activeFilterCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-md">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${filtersExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Collapsible Filter Content */}
                    {filtersExpanded && (
                        <div className="flex flex-wrap items-center gap-3 px-4 pb-4">

                            {/* Divider */}
                            <div className="h-5 w-px bg-[hsl(var(--border))]" />

                            {/* Action Filter - Custom Dropdown */}
                            <AuditActionFilter
                                value={actionFilter}
                                onChange={(action) => {
                                    setActionFilter(action);
                                    setPage(1);
                                }}
                            />

                            {/* Entity Filter - Custom Dropdown */}
                            <AuditEntityFilter
                                value={entityFilter}
                                onChange={(entity) => {
                                    setEntityFilter(entity);
                                    setPage(1);
                                }}
                            />

                            {/* User Filter */}
                            <AuditUserFilter
                                value={userIdFilter}
                                onChange={(userId) => {
                                    setUserIdFilter(userId);
                                    setPage(1);
                                }}
                            />

                            {/* Date Range */}
                            <AuditDateRangePicker
                                startDate={startDate}
                                endDate={endDate}
                                onStartDateChange={(date) => {
                                    setStartDate(date);
                                    setPage(1);
                                }}
                                onEndDateChange={(date) => {
                                    setEndDate(date);
                                    setPage(1);
                                }}
                            />

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Clear Filters */}
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[hsl(var(--error-500))] bg-[hsl(var(--error-50))] dark:bg-[hsl(var(--error-500))]/10 hover:bg-[hsl(var(--error-100))] dark:hover:bg-[hsl(var(--error-500))]/20 rounded-lg transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Clear All
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Timeline View */}
            {viewMode === 'timeline' && startDate && (
                <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
                    <AuditTimelineView date={startDate} />
                </div>
            )}

            {viewMode === 'timeline' && !startDate && (
                <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12 text-center">
                    <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Select a start date to view timeline</p>
                </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
                <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
                    {isLoading ? (
                        <AuditTableSkeleton rows={8} />
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center">
                            <Shield className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No audit logs found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[hsl(var(--border))]">
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-10"></th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Timestamp
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            User
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Action
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Entity
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Description
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            IP Address
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log, index) => (
                                        <React.Fragment key={log.id}>
                                            <tr
                                                className={cn(
                                                    "hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group",
                                                    index !== logs.length - 1 && "border-b border-[hsl(var(--border))]"
                                                )}
                                                onClick={() => toggleExpand(log.id)}
                                            >
                                                <td className="px-5 py-3.5">
                                                    {(log.oldValue || log.newValue) && (
                                                        expandedRows.has(log.id) ? (
                                                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                                        ) : (
                                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                                                        )
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono">
                                                    {formatDate(log.createdAt)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                            <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-slate-800 dark:text-white leading-tight">
                                                                {log.user?.fullName || 'System'}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">
                                                                {log.user?.email || '-'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <ActionIcon action={log.action} />
                                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                            {ACTION_CONFIG[log.action]?.label || log.action}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-[hsl(var(--primary))]/10 text-primary rounded-md capitalize">
                                                            {log.entityType}
                                                        </span>
                                                        {log.entityId && (
                                                            (() => {
                                                                const getEntityLink = () => {
                                                                    switch (log.entityType.toLowerCase()) {
                                                                        case 'ticket':
                                                                            return `/tickets/${log.entityId}`;
                                                                        case 'user':
                                                                            return `/admin/agents`;
                                                                        case 'article':
                                                                            return `/knowledge-base/articles/${log.entityId}`;
                                                                        default:
                                                                            return null;
                                                                    }
                                                                };
                                                                const link = getEntityLink();

                                                                return link ? (
                                                                    <Link
                                                                        to={link}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 bg-slate-100 dark:bg-slate-800 hover:bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-md font-mono transition-colors group/link"
                                                                    >
                                                                        #{log.entityId.slice(0, 8)}
                                                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                                                    </Link>
                                                                ) : (
                                                                    <code className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                                                                        #{log.entityId.slice(0, 8)}
                                                                    </code>
                                                                );
                                                            })()
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                                    {log.description || '-'}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-400 dark:text-slate-500 font-mono">
                                                    {log.ipAddress || '-'}
                                                </td>
                                            </tr>
                                            {/* Expanded Details Row */}
                                            {expandedRows.has(log.id) && (log.oldValue || log.newValue) && (
                                                <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                                                    <td colSpan={7} className="px-5 py-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {log.oldValue && (
                                                                <div>
                                                                    <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                                        Previous Value
                                                                    </h4>
                                                                    <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[hsl(var(--card))] p-3 rounded-lg overflow-auto max-h-40 border border-[hsl(var(--border))] font-mono">
                                                                        {JSON.stringify(log.oldValue, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                            {log.newValue && (
                                                                <div>
                                                                    <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                                        New Value
                                                                    </h4>
                                                                    <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[hsl(var(--card))] p-3 rounded-lg overflow-auto max-h-40 border border-[hsl(var(--border))] font-mono">
                                                                        {JSON.stringify(log.newValue, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                            <div className="col-span-2">
                                                                <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                                    Full Description
                                                                </h4>
                                                                <p className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-[hsl(var(--card))] p-3 rounded-lg border border-[hsl(var(--border))]">
                                                                    {log.description || 'No description provided.'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {meta && meta.totalPages > 1 && (
                        <div className="px-5 py-3.5 border-t border-[hsl(var(--border))] flex items-center justify-between">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Showing {(meta.page - 1) * meta.limit + 1} to{' '}
                                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out"
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-2 text-xs font-bold text-slate-800 dark:text-white tabular-nums">
                                    {page} / {meta.totalPages}
                                </span>
                                <button
                                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                                    disabled={page >= meta.totalPages}
                                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AuditLogPage;
