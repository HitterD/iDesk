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
    ChevronLeft,
    ChevronRight,
    Video,
    XCircle,
    Edit,
    Plus,
    Settings
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
    BOOKING_CREATED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    BOOKING_CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    BOOKING_UPDATED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ACCOUNT_UPDATED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    SETTINGS_UPDATED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    MEETING_CREATED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    MEETING_DELETED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
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
        <div className={cn("space-y-4", className)}>
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    Audit Logs
                </h3>

                <div className="flex flex-wrap gap-2">
                    <Input
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-40"
                    />
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                        className="w-36"
                        title="Start date"
                    />
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                        className="w-36"
                        title="End date"
                    />
                    <Select value={actionFilter} onValueChange={(val) => { setActionFilter(val); setPage(1); }}>
                        <SelectTrigger className="w-40">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Filter action" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Actions</SelectItem>
                            <SelectItem value="BOOKING_CREATED">Booking Created</SelectItem>
                            <SelectItem value="BOOKING_CANCELLED">Booking Cancelled</SelectItem>
                            <SelectItem value="BOOKING_UPDATED">Booking Updated</SelectItem>
                            <SelectItem value="ACCOUNT_UPDATED">Account Updated</SelectItem>
                            <SelectItem value="SETTINGS_UPDATED">Settings Updated</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => refetch()}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mb-4 opacity-30" />
                        <p>No audit logs found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredLogs.map((log) => {
                            const ActionIcon = ACTION_ICONS[log.action] || FileText;
                            const colorClass = ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700';

                            return (
                                <div
                                    key={log.id}
                                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className={cn(
                                            "p-2 rounded-lg shrink-0",
                                            colorClass
                                        )}>
                                            <ActionIcon className="h-4 w-4" />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className={colorClass}>
                                                    {log.action.replace(/_/g, ' ')}
                                                </Badge>
                                                {log.entityType && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {log.entityType}
                                                    </span>
                                                )}
                                            </div>

                                            {log.details && (
                                                <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                                    {(() => {
                                                        try {
                                                            const parsed = JSON.parse(log.details);
                                                            if (typeof parsed === 'object' && parsed !== null) {
                                                                return (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(parsed).slice(0, 4).map(([key, value]) => (
                                                                            <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                                                                                <span className="text-muted-foreground">{key}:</span>
                                                                                <span className="font-medium truncate max-w-[150px]">{String(value)}</span>
                                                                            </span>
                                                                        ))}
                                                                        {Object.keys(parsed).length > 4 && (
                                                                            <span className="text-xs text-muted-foreground">+{Object.keys(parsed).length - 4} more</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }
                                                            return <span className="truncate">{log.details}</span>;
                                                        } catch {
                                                            return <span className="truncate">{log.details}</span>;
                                                        }
                                                    })()}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    <span>{log.performedBy?.fullName || 'System'}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    <span title={format(parseISO(log.createdAt), 'PPpp', { locale: idLocale })}>
                                                        {formatDistanceToNow(parseISO(log.createdAt), {
                                                            addSuffix: true,
                                                            locale: idLocale
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
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
                <div className="flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
