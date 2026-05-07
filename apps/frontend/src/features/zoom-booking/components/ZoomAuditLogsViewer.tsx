import { useState, useMemo } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    FileText,
    User,
    Calendar,
    Clock,
    Filter,
    RefreshCw,
    Video,
    XCircle,
    Edit,
    Plus,
    Settings,
    Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useZoomAuditLogs } from '../hooks';

// Action type colors
const ACTION_COLORS: Record<string, string> = {
    BOOKING_CREATED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50',
    BOOKING_CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50',
    BOOKING_UPDATED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
    ACCOUNT_UPDATED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50',
    SETTINGS_UPDATED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
    MEETING_CREATED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/50',
    MEETING_DELETED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
    BOOKING_CREATED: Plus,
    BOOKING_CANCELLED: XCircle,
    BOOKING_UPDATED: Edit,
    ACCOUNT_UPDATED: User,
    SETTINGS_UPDATED: Settings,
    MEETING_CREATED: Video,
    MEETING_DELETED: XCircle,
};

interface ZoomAuditLogsViewerProps {
    className?: string;
}

export function ZoomAuditLogsViewer({ className }: ZoomAuditLogsViewerProps) {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const { data, isLoading, refetch } = useZoomAuditLogs({
        page,
        limit: 20,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
    });

    const logs = data?.data || [];
    const totalPages = data?.totalPages || 1;

    // Filter by search locally
    const filteredLogs = useMemo(() => {
        if (!searchQuery.trim()) return logs;
        const query = searchQuery.toLowerCase();
        return logs.filter(log =>
            log.action.toLowerCase().includes(query) ||
            log.performedBy?.fullName?.toLowerCase().includes(query) ||
            log.details?.toLowerCase().includes(query)
        );
    }, [logs, searchQuery]);

    return (
        <div className={cn("space-y-6", className)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Header & Filters */}
                <div className="px-6 py-5 md:px-8 md:py-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="flex flex-col xl:flex-row justify-between gap-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                System Audit Trail
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Complete timeline of all modifications and activities.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search logs..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full sm:w-[180px] pl-9 bg-white dark:bg-slate-950 h-10 border-slate-200 dark:border-slate-800"
                                />
                            </div>
                            
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-950 px-2 rounded-lg border border-slate-200 dark:border-slate-800 h-10">
                                <Calendar className="h-4 w-4 text-slate-400 ml-1 shrink-0" />
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                    className="w-[125px] h-8 border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm shadow-none"
                                    title="Start date"
                                />
                                <span className="text-slate-300 dark:text-slate-700">-</span>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                    className="w-[125px] h-8 border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm shadow-none"
                                    title="End date"
                                />
                            </div>

                            <Select value={actionFilter} onValueChange={(val) => { setActionFilter(val); setPage(1); }}>
                                <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-slate-950 h-10 border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center">
                                        <Filter className="h-4 w-4 mr-2 text-slate-400" />
                                        <SelectValue placeholder="Filter action" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Activities</SelectItem>
                                    <SelectItem value="BOOKING_CREATED">Booking Created</SelectItem>
                                    <SelectItem value="BOOKING_CANCELLED">Booking Cancelled</SelectItem>
                                    <SelectItem value="BOOKING_UPDATED">Booking Updated</SelectItem>
                                    <SelectItem value="ACCOUNT_UPDATED">Account Updated</SelectItem>
                                    <SelectItem value="SETTINGS_UPDATED">Settings Updated</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="outline" size="icon" onClick={() => refetch()} className="h-10 w-10 shrink-0 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                <RefreshCw className="h-4 w-4 text-slate-500" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Logs List */}
                <div className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-full mb-4">
                                <FileText className="h-8 w-8 opacity-50" />
                            </div>
                            <p className="font-medium text-slate-600 dark:text-slate-400">No audit logs found</p>
                            <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {filteredLogs.map((log) => {
                                const ActionIcon = ACTION_ICONS[log.action] || FileText;
                                const colorClass = ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';

                                return (
                                    <div
                                        key={log.id}
                                        className="p-5 md:px-8 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-start gap-4 md:gap-6">
                                            {/* Icon */}
                                            <div className={cn(
                                                "p-3 rounded-xl shrink-0 border shadow-sm self-start mt-1",
                                                colorClass
                                            )}>
                                                <ActionIcon className="h-4 w-4" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <Badge variant="outline" className={cn("font-medium shadow-none px-2.5 py-0.5", colorClass)}>
                                                            {log.action.replace(/_/g, ' ')}
                                                        </Badge>
                                                        {log.entityType && (
                                                            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                                {log.entityType}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Time & User (Desktop layout) */}
                                                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="h-3.5 w-3.5" />
                                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                                {log.performedBy?.fullName || 'System Automated'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            <span title={format(parseISO(log.createdAt), 'PPpp', { locale: idLocale })}>
                                                                {formatDistanceToNow(parseISO(log.createdAt), {
                                                                    addSuffix: true,
                                                                    locale: idLocale
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Details payload */}
                                                {log.details && (
                                                    <div className="text-sm text-slate-600 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80">
                                                        {(() => {
                                                            try {
                                                                const parsed = JSON.parse(log.details);
                                                                if (typeof parsed === 'object' && parsed !== null) {
                                                                    return (
                                                                        <div className="flex flex-wrap gap-2.5">
                                                                            {Object.entries(parsed).slice(0, 4).map(([key, value]) => (
                                                                                <span key={key} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-md text-xs">
                                                                                    <span className="text-slate-500 font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                                                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{String(value)}</span>
                                                                                </span>
                                                                            ))}
                                                                            {Object.keys(parsed).length > 4 && (
                                                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-500 bg-slate-200/50 dark:bg-slate-800 rounded-md">
                                                                                    +{Object.keys(parsed).length - 4} more
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                }
                                                                return <span className="block leading-relaxed">{log.details}</span>;
                                                            } catch {
                                                                return <span className="block leading-relaxed">{log.details}</span>;
                                                            }
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/30 dark:bg-slate-900/30">
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Page {page} of {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white dark:bg-slate-950 h-9"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white dark:bg-slate-950 h-9"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

