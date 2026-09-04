import React, { useState, useMemo } from 'react';
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
    Edit3,
    Settings,
    Search,
    CalendarPlus,
    CalendarX2,
    Sliders,
    Users,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Code,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    X,
    Layers,
    Tag,
    Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

// ==========================================
// Action Type Definitions & Visual Styling
// ==========================================

interface ActionConfig {
    label: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    iconBg: string;
    iconColor: string;
    accentBorder: string;
}

const ACTION_CONFIGS: Record<string, ActionConfig> = {
    BOOKING_CREATED: {
        label: 'Booking Dibuat',
        description: 'Jadwal meeting Zoom baru berhasil didaftarkan',
        icon: CalendarPlus,
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
        badgeBorder: 'border-emerald-200/80 dark:border-emerald-800/60',
        iconBg: 'bg-emerald-100/70 dark:bg-emerald-900/50',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        accentBorder: 'hover:border-emerald-300/80 dark:hover:border-emerald-800/60',
    },
    BOOKING_CANCELLED: {
        label: 'Booking Dibatalkan',
        description: 'Jadwal meeting dibatalkan dan slot waktu dikembalikan',
        icon: CalendarX2,
        badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
        badgeText: 'text-rose-700 dark:text-rose-300',
        badgeBorder: 'border-rose-200/80 dark:border-rose-800/60',
        iconBg: 'bg-rose-100/70 dark:bg-rose-900/50',
        iconColor: 'text-rose-600 dark:text-rose-400',
        accentBorder: 'hover:border-rose-300/80 dark:hover:border-rose-800/60',
    },
    BOOKING_UPDATED: {
        label: 'Booking Diperbarui',
        description: 'Informasi atau jadwal meeting telah diubah',
        icon: Edit3,
        badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
        badgeText: 'text-blue-700 dark:text-blue-300',
        badgeBorder: 'border-blue-200/80 dark:border-blue-800/60',
        iconBg: 'bg-blue-100/70 dark:bg-blue-900/50',
        iconColor: 'text-blue-600 dark:text-blue-400',
        accentBorder: 'hover:border-blue-300/80 dark:hover:border-blue-800/60',
    },
    ACCOUNT_UPDATED: {
        label: 'Akun Diperbarui',
        description: 'Konfigurasi atau data akun Zoom diubah',
        icon: Users,
        badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
        badgeText: 'text-purple-700 dark:text-purple-300',
        badgeBorder: 'border-purple-200/80 dark:border-purple-800/60',
        iconBg: 'bg-purple-100/70 dark:bg-purple-900/50',
        iconColor: 'text-purple-600 dark:text-purple-400',
        accentBorder: 'hover:border-purple-300/80 dark:hover:border-purple-800/60',
    },
    SETTINGS_UPDATED: {
        label: 'Pengaturan Diubah',
        description: 'Konfigurasi sistem atau jadwal operasional Zoom diperbarui',
        icon: Sliders,
        badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
        badgeText: 'text-amber-700 dark:text-amber-300',
        badgeBorder: 'border-amber-200/80 dark:border-amber-800/60',
        iconBg: 'bg-amber-100/70 dark:bg-amber-900/50',
        iconColor: 'text-amber-600 dark:text-amber-400',
        accentBorder: 'hover:border-amber-300/80 dark:hover:border-amber-800/60',
    },
    MEETING_CREATED: {
        label: 'Meeting Terjadwal',
        description: 'Room Zoom Cloud Meeting berhasil digenerate',
        icon: Video,
        badgeBg: 'bg-cyan-50 dark:bg-cyan-950/40',
        badgeText: 'text-cyan-700 dark:text-cyan-300',
        badgeBorder: 'border-cyan-200/80 dark:border-cyan-800/60',
        iconBg: 'bg-cyan-100/70 dark:bg-cyan-900/50',
        iconColor: 'text-cyan-600 dark:text-cyan-400',
        accentBorder: 'hover:border-cyan-300/80 dark:hover:border-cyan-800/60',
    },
    MEETING_DELETED: {
        label: 'Meeting Dihapus',
        description: 'Room Zoom Cloud Meeting telah dihapus dari sistem',
        icon: XCircle,
        badgeBg: 'bg-orange-50 dark:bg-orange-950/40',
        badgeText: 'text-orange-700 dark:text-orange-300',
        badgeBorder: 'border-orange-200/80 dark:border-orange-800/60',
        iconBg: 'bg-orange-100/70 dark:bg-orange-900/50',
        iconColor: 'text-orange-600 dark:text-orange-400',
        accentBorder: 'hover:border-orange-300/80 dark:hover:border-orange-800/60',
    },
};

const DEFAULT_ACTION_CONFIG: ActionConfig = {
    label: 'Aktivitas Sistem',
    description: 'Pencatatan aktivitas audit log pada modul Zoom',
    icon: FileText,
    badgeBg: 'bg-slate-50 dark:bg-slate-800/50',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-200 dark:border-slate-700',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-600 dark:text-slate-400',
    accentBorder: 'hover:border-slate-300 dark:hover:border-slate-700',
};

// ==========================================
// Helper: Safe Details Parser
// ==========================================

interface ParsedDetails {
    title?: string;
    date?: string;
    time?: string;
    duration?: string | number;
    accountName?: string;
    reason?: string;
    otherProps: Record<string, any>;
    rawString?: string;
    isJson: boolean;
}

const parseLogDetails = (details?: string): ParsedDetails => {
    if (!details) {
        return { otherProps: {}, isJson: false };
    }

    try {
        const parsed = JSON.parse(details);
        if (typeof parsed === 'object' && parsed !== null) {
            const {
                Title, title,
                Date: DateVal, date: dateVal, bookingDate,
                Time, time, startTime,
                Duration, duration, durationMinutes,
                Account, accountName, zoomAccount,
                Reason, reason, cancellationReason,
                ...rest
            } = parsed;

            return {
                title: Title || title || rest.meetingTitle,
                date: DateVal || dateVal || bookingDate,
                time: Time || time || startTime,
                duration: Duration || duration || durationMinutes,
                accountName: Account || accountName || zoomAccount,
                reason: Reason || reason || cancellationReason,
                otherProps: rest,
                isJson: true,
            };
        }
        return { otherProps: {}, rawString: details, isJson: false };
    } catch {
        return { otherProps: {}, rawString: details, isJson: false };
    }
};

const getUserInitials = (name?: string): string => {
    if (!name) return 'SYS';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ==========================================
// Component: Single Audit Log Card
// ==========================================

interface AuditLogCardProps {
    log: any;
}

const AuditLogCard: React.FC<AuditLogCardProps> = ({ log }) => {
    const [showJson, setShowJson] = useState(false);
    const config = ACTION_CONFIGS[log.action] || DEFAULT_ACTION_CONFIG;
    const ActionIcon = config.icon;
    const details = useMemo(() => parseLogDetails(log.details), [log.details]);

    const createdDate = parseISO(log.createdAt);
    const timeAgo = formatDistanceToNow(createdDate, { addSuffix: true, locale: idLocale });
    const fullDate = format(createdDate, 'dd MMMM yyyy, HH:mm:ss', { locale: idLocale });

    const initials = getUserInitials(log.performedBy?.fullName);

    return (
        <div className={cn(
            "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 transition-all duration-200 shadow-2xs hover:shadow-sm space-y-3.5",
            config.accentBorder
        )}>
            {/* Header: Action Badge, Entity Tag, and Performed By */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {/* Action Icon Box */}
                    <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs",
                        config.iconBg,
                        config.iconColor
                    )}>
                        <ActionIcon className="w-4.5 h-4.5" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Action Pill */}
                        <span className={cn(
                            "px-2.5 py-1 rounded-lg border text-xs font-bold tracking-wide flex items-center gap-1.5",
                            config.badgeBg,
                            config.badgeText,
                            config.badgeBorder
                        )}>
                            <span>{config.label}</span>
                        </span>

                        {/* Entity Type Tag */}
                        {log.entityType && (
                            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                {log.entityType}
                            </span>
                        )}
                    </div>
                </div>

                {/* Performed By & Timestamp */}
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                            {initials}
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 max-w-[160px] truncate">
                            {log.performedBy?.fullName || 'System Automated'}
                        </span>
                    </div>

                    <div
                        className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium"
                        title={fullDate}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeAgo}</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="pl-0 sm:pl-12 space-y-2.5">
                {/* Title Highlight */}
                {details.title && (
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">
                            {details.title}
                        </h4>
                    </div>
                )}

                {/* Structured Metadata Chips */}
                {(details.date || details.time || details.duration || details.accountName) && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                        {details.date && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                <span>{details.date}</span>
                            </div>
                        )}

                        {details.time && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                <span>{details.time} WIB</span>
                            </div>
                        )}

                        {details.duration && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <Timer className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{details.duration} Menit</span>
                            </div>
                        )}

                        {details.accountName && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <Video className="w-3.5 h-3.5 text-indigo-500" />
                                <span>{details.accountName}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Cancellation Reason Callout */}
                {details.reason && (
                    <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                        <div>
                            <span className="font-bold block">Alasan Pembatalan:</span>
                            <span className="text-slate-600 dark:text-slate-300">{details.reason}</span>
                        </div>
                    </div>
                )}

                {/* Additional Properties Chips */}
                {Object.keys(details.otherProps).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {Object.entries(details.otherProps).map(([key, val]) => {
                            if (typeof val === 'object' && val !== null) return null;
                            return (
                                <div
                                    key={key}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                                >
                                    <span className="text-slate-400 capitalize font-medium">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                                    </span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 max-w-[220px] truncate">
                                        {String(val)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Raw String Fallback */}
                {details.rawString && !details.title && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        {details.rawString}
                    </p>
                )}

                {/* Expandable Technical JSON Toggle */}
                {log.details && (
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={() => setShowJson(!showJson)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                        >
                            <Code className="w-3.5 h-3.5" />
                            <span>{showJson ? 'Sembunyikan Raw JSON' : 'Lihat Payload Log'}</span>
                            {showJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {showJson && (
                            <pre className="mt-2 p-3 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto border border-slate-800 max-h-48 scrollbar-custom animate-in fade-in-50 duration-150">
                                {JSON.stringify(JSON.parse(log.details || '{}'), null, 2)}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// Main Component: ZoomAuditLogsViewer
// ==========================================

interface ZoomAuditLogsViewerProps {
    className?: string;
}

export function ZoomAuditLogsViewer({ className }: ZoomAuditLogsViewerProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [actionFilter, setActionFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Fetch data with active page & limit
    const { data, isLoading, isFetching, refetch } = useZoomAuditLogs({
        page,
        limit: pageSize,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
    });

    const rawLogs = data?.data || [];
    const totalCount = data?.total ?? rawLogs.length;
    const serverTotalPages = data?.totalPages ?? 1;

    // Filter by search locally
    const filteredLogs = useMemo(() => {
        if (!searchQuery.trim()) return rawLogs;
        const query = searchQuery.toLowerCase();
        return rawLogs.filter(log =>
            log.action.toLowerCase().includes(query) ||
            log.performedBy?.fullName?.toLowerCase().includes(query) ||
            log.details?.toLowerCase().includes(query)
        );
    }, [rawLogs, searchQuery]);

    // Handle search-based local pagination
    const totalDisplayCount = searchQuery.trim() ? filteredLogs.length : totalCount;
    const totalPages = searchQuery.trim()
        ? Math.ceil(filteredLogs.length / pageSize) || 1
        : Math.max(1, serverTotalPages);

    const displayedLogs = useMemo(() => {
        if (!searchQuery.trim()) return rawLogs;
        const start = (page - 1) * pageSize;
        return filteredLogs.slice(start, start + pageSize);
    }, [rawLogs, filteredLogs, searchQuery, page, pageSize]);

    // Quick filter chips
    const QUICK_FILTERS = [
        { label: 'Semua Aktivitas', value: 'ALL' },
        { label: 'Booking Baru', value: 'BOOKING_CREATED' },
        { label: 'Dibatalkan', value: 'BOOKING_CANCELLED' },
        { label: 'Perubahan', value: 'BOOKING_UPDATED' },
        { label: 'Pengaturan & Akun', value: 'SETTINGS_UPDATED' },
    ];

    // Generate smart page numbers (e.g. 1, 2, 3 ... N)
    const pageNumbers = useMemo(() => {
        const pages: (number | string)[] = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (page <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (page >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
            }
        }
        return pages;
    }, [totalPages, page]);

    const handleActionFilterChange = (val: string) => {
        setActionFilter(val);
        setPage(1);
    };

    const handlePageSizeChange = (val: string) => {
        setPageSize(Number(val));
        setPage(1);
    };

    const startItem = totalDisplayCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalDisplayCount);

    return (
        <div className={cn("space-y-5", className)}>
            {/* Header & Controls Surface */}
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 md:p-6 shadow-xs space-y-5">
                {/* Title & Quick Refresh */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                System Audit Trail
                                <span className="text-[11px] font-semibold bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                                    {totalDisplayCount} Aktivitas Tercatat
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Riwayat lengkap seluruh penambahan booking, perubahan jadwal, dan pembaruan konfigurasi Zoom.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="h-9 px-3.5 text-xs rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-2"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5 text-slate-500", isFetching && "animate-spin text-blue-600")} />
                            <span>{isFetching ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
                        </Button>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Cari judul meeting, nama user, atau detail..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            className="w-full pl-10 pr-8 bg-slate-50/70 dark:bg-slate-950/50 h-10 border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setPage(1); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Date Range & Dropdown */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Date Range Selector */}
                        <div className="flex items-center gap-2 bg-slate-50/70 dark:bg-slate-950/50 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 h-10">
                            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                className="w-[115px] h-8 border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs shadow-none text-slate-700 dark:text-slate-300 font-medium"
                                title="Tanggal awal"
                            />
                            <span className="text-slate-400">-</span>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                className="w-[115px] h-8 border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs shadow-none text-slate-700 dark:text-slate-300 font-medium"
                                title="Tanggal akhir"
                            />
                            {(startDate || endDate) && (
                                <button
                                    type="button"
                                    onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                    title="Reset tanggal"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Action Dropdown Filter */}
                        <Select value={actionFilter} onValueChange={handleActionFilterChange}>
                            <SelectTrigger className="w-full sm:w-[190px] bg-slate-50/70 dark:bg-slate-950/50 h-10 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                                    <SelectValue placeholder="Semua Aktivitas" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="ALL">Semua Aktivitas</SelectItem>
                                <SelectItem value="BOOKING_CREATED">Booking Dibuat</SelectItem>
                                <SelectItem value="BOOKING_CANCELLED">Booking Dibatalkan</SelectItem>
                                <SelectItem value="BOOKING_UPDATED">Booking Diperbarui</SelectItem>
                                <SelectItem value="ACCOUNT_UPDATED">Akun Diperbarui</SelectItem>
                                <SelectItem value="SETTINGS_UPDATED">Pengaturan Diubah</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Quick Filter Pill Buttons */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Kategori:
                    </span>
                    {QUICK_FILTERS.map((filter) => {
                        const isSelected = actionFilter === filter.value;
                        return (
                            <button
                                key={filter.value}
                                type="button"
                                onClick={() => handleActionFilterChange(filter.value)}
                                className={cn(
                                    "px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95",
                                    isSelected
                                        ? "bg-blue-600 text-white shadow-2xs"
                                        : "bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                                )}
                            >
                                {filter.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Audit Logs Stream */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                                        <div className="w-32 h-5 bg-slate-200 dark:bg-slate-800 rounded-md" />
                                    </div>
                                    <div className="w-28 h-4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                                </div>
                                <div className="w-3/4 h-4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                                <div className="flex gap-2">
                                    <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800 rounded-md" />
                                    <div className="w-20 h-6 bg-slate-200 dark:bg-slate-800 rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : displayedLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <FileText className="w-7 h-7" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Tidak Ada Riwayat Log Audit Ditemukan
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm">
                            Tidak ada data aktivitas yang sesuai dengan kata kunci atau filter tanggal yang dipilih.
                        </p>
                        {(searchQuery || startDate || endDate || actionFilter !== 'ALL') && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearchQuery('');
                                    setStartDate('');
                                    setEndDate('');
                                    setActionFilter('ALL');
                                    setPage(1);
                                }}
                                className="text-xs rounded-xl"
                            >
                                Reset Semua Filter
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {displayedLogs.map((log) => (
                            <AuditLogCard key={log.id} log={log} />
                        ))}
                    </div>
                )}
            </div>

            {/* Comprehensive Pagination Controls */}
            {totalDisplayCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-4 rounded-3xl shadow-2xs">
                    {/* Count & Page Size Selector */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 w-full sm:w-auto justify-between sm:justify-start">
                        <span>
                            Menampilkan <strong className="text-slate-800 dark:text-white font-bold">{startItem} - {endItem}</strong> dari <strong className="text-slate-800 dark:text-white font-bold">{totalDisplayCount}</strong> aktivitas
                        </span>

                        <div className="flex items-center gap-1.5 ml-2">
                            <span className="text-[11px] text-slate-400 hidden sm:inline">Per hal:</span>
                            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                                <SelectTrigger className="h-7 w-[70px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg px-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="5">5</SelectItem>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Numbered Page Buttons & Navigation */}
                    <div className="flex items-center gap-1 self-center sm:self-auto">
                        {/* First Page */}
                        <button
                            type="button"
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                            title="Halaman Pertama"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            <ChevronsLeft className="w-3.5 h-3.5" />
                        </button>

                        {/* Previous Page */}
                        <button
                            type="button"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            title="Halaman Sebelumnya"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        {/* Page Numbers */}
                        <div className="flex items-center gap-1 px-1">
                            {pageNumbers.map((num, idx) => {
                                if (num === '...') {
                                    return (
                                        <span key={`dots-${idx}`} className="px-1.5 text-xs text-slate-400 select-none">
                                            ...
                                        </span>
                                    );
                                }
                                const isCurrent = page === num;
                                return (
                                    <button
                                        key={`page-${num}`}
                                        type="button"
                                        onClick={() => setPage(Number(num))}
                                        className={cn(
                                            "min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all",
                                            isCurrent
                                                ? "bg-blue-600 text-white shadow-2xs"
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                        )}
                                    >
                                        {num}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Next Page */}
                        <button
                            type="button"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            title="Halaman Selanjutnya"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Last Page */}
                        <button
                            type="button"
                            onClick={() => setPage(totalPages)}
                            disabled={page === totalPages}
                            title="Halaman Terakhir"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            <ChevronsRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ZoomAuditLogsViewer;
