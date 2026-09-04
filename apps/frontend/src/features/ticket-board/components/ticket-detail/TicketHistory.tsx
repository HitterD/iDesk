import React, { useState, useMemo } from 'react';
import {
    History,
    Activity,
    UserCheck,
    AlertCircle,
    Clock,
    Tag,
    GitMerge,
    Ban,
    ArrowRight,
    Search,
    X,
    User,
    Shield,
    Calendar,
    Sparkles,
    CheckCircle2,
    SlidersHorizontal,
} from 'lucide-react';
import { TicketDetail } from './types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './constants';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import { cn } from '@/lib/utils';

interface TicketHistoryProps {
    ticket: TicketDetail;
}

type EventCategory = 'all' | 'status_sla' | 'assignment' | 'properties';

interface ParsedActivity {
    id: string;
    rawContent: string;
    type: 'STATUS' | 'ASSIGNMENT' | 'PRIORITY' | 'CATEGORY' | 'SLA' | 'MERGE' | 'CANCEL' | 'OTHER';
    categoryGroup: EventCategory;
    title: string;
    actor?: string;
    createdAt: string;
    statusChange?: {
        from: string;
        to: string;
    };
    assignmentChange?: {
        from?: string;
        to: string;
    };
    priorityChange?: {
        from: string;
        to: string;
    };
    categoryChange?: {
        from: string;
        to: string;
    };
    slaTarget?: string;
    slaNote?: string;
    cancelReason?: string;
    mergeInfo?: {
        ticketNumber: string;
        isIncoming: boolean;
        reason?: string;
    };
    descriptionText?: string;
}

/**
 * Format any raw ISO timestamp string inside text to localized Indonesian date
 */
const formatIsoStringsInText = (text: string): string => {
    return text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, (match) => {
        try {
            return formatDateTimeID(match);
        } catch {
            return match;
        }
    });
};

/**
 * Parse raw system messages into structured, beautiful event data
 */
const parseSystemMessage = (messageId: string, rawContent: string, createdAt: string): ParsedActivity => {
    // Strip "System: " prefix
    const cleanContent = rawContent.replace(/^System:\s*/i, '').trim();

    // Extract "by {Actor}" if present at the end
    let contentWithoutActor = cleanContent;
    let actor: string | undefined;

    const byMatch = cleanContent.match(/\s+by\s+([^,\.]+)(.*)$/i);
    if (byMatch) {
        actor = byMatch[1].trim();
        contentWithoutActor = cleanContent.slice(0, byMatch.index).trim();
    }

    // 1. Check for Status changes
    const statusMatch = contentWithoutActor.match(/Status(?: changed)? from ([A-Z_]+) to ([A-Z_]+)/i) ||
        contentWithoutActor.match(/Status:\s*([A-Z_]+)\s*→\s*([A-Z_]+)/i);

    if (statusMatch) {
        const from = statusMatch[1].toUpperCase();
        const to = statusMatch[2].toUpperCase();

        // Check if SLA Timer was started or adjusted in the same message
        let slaTarget: string | undefined;
        let slaNote: string | undefined;

        const targetMatch = cleanContent.match(/Target:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/i);
        if (targetMatch) {
            slaTarget = targetMatch[1];
        }

        if (cleanContent.includes('business hours')) {
            slaNote = 'Waktu Kerja (Business Hours)';
        } else if (cleanContent.includes('Waiting Vendor Duration')) {
            const minMatch = cleanContent.match(/adjusted by (\d+) minutes/i);
            slaNote = minMatch ? `Penyesuaian jeda vendor (+${minMatch[1]} menit)` : 'Penyesuaian jeda vendor';
        }

        return {
            id: messageId,
            rawContent,
            type: 'STATUS',
            categoryGroup: 'status_sla',
            title: to === 'RESOLVED' ? 'Tiket Diselesaikan' : to === 'IN_PROGRESS' ? 'Pengerjaan Tiket Dimulai' : 'Perubahan Status Tiket',
            actor,
            createdAt,
            statusChange: { from, to },
            slaTarget,
            slaNote,
        };
    }

    // 2. Check for Assignment changes
    const assignMatch = contentWithoutActor.match(/Ticket assigned to (.+?)(?:\s*\(was\s*(.+?)\))?$/i) ||
        contentWithoutActor.match(/Assigned to:\s*(.+)$/i);

    if (assignMatch) {
        const to = assignMatch[1].trim();
        const from = assignMatch[2] ? assignMatch[2].trim() : undefined;
        const isUnassigned = !from || from.toLowerCase() === 'none' || from.toLowerCase() === 'unassigned';

        return {
            id: messageId,
            rawContent,
            type: 'ASSIGNMENT',
            categoryGroup: 'assignment',
            title: isUnassigned ? 'Penugasan Teknisi Baru' : 'Pengalihan Teknisi',
            actor,
            createdAt,
            assignmentChange: {
                to,
                from: isUnassigned ? undefined : from,
            },
        };
    }

    // 3. Check for Priority changes
    const priorityMatch = contentWithoutActor.match(/Priority(?: changed)? from ([A-Z_]+) to ([A-Z_]+)/i) ||
        contentWithoutActor.match(/Priority:\s*([A-Z_]+)\s*→\s*([A-Z_]+)/i);

    if (priorityMatch) {
        return {
            id: messageId,
            rawContent,
            type: 'PRIORITY',
            categoryGroup: 'properties',
            title: 'Perubahan Prioritas Tiket',
            actor,
            createdAt,
            priorityChange: {
                from: priorityMatch[1].toUpperCase(),
                to: priorityMatch[2].toUpperCase(),
            },
        };
    }

    // 4. Check for Category changes
    const categoryMatch = contentWithoutActor.match(/Category(?: changed)? from ([A-Z_]+) to ([A-Z_]+)/i) ||
        contentWithoutActor.match(/Category:\s*([A-Z_]+)\s*→\s*([A-Z_]+)/i);

    if (categoryMatch) {
        return {
            id: messageId,
            rawContent,
            type: 'CATEGORY',
            categoryGroup: 'properties',
            title: 'Perubahan Kategori Tiket',
            actor,
            createdAt,
            categoryChange: {
                from: categoryMatch[1].toUpperCase(),
                to: categoryMatch[2].toUpperCase(),
            },
        };
    }

    // 5. Check for Ticket Cancellation
    if (contentWithoutActor.toLowerCase().includes('ticket cancelled')) {
        let cancelReason: string | undefined;
        const reasonMatch = cleanContent.match(/cancelled by [^\(]+\((.+?)\)/i) ||
            cleanContent.match(/Reason:\s*(.+)$/i);
        if (reasonMatch) {
            cancelReason = reasonMatch[1].trim();
        }

        return {
            id: messageId,
            rawContent,
            type: 'CANCEL',
            categoryGroup: 'status_sla',
            title: 'Pembatalan Tiket',
            actor,
            createdAt,
            cancelReason,
        };
    }

    // 6. Check for Merge events
    const mergeIncomingMatch = contentWithoutActor.match(/Ticket #([A-Z0-9-]+) was merged into this ticket/i);
    if (mergeIncomingMatch) {
        return {
            id: messageId,
            rawContent,
            type: 'MERGE',
            categoryGroup: 'status_sla',
            title: 'Tiket Digabungkan (Merge)',
            actor,
            createdAt,
            mergeInfo: {
                ticketNumber: mergeIncomingMatch[1],
                isIncoming: true,
            },
        };
    }

    const mergeOutgoingMatch = contentWithoutActor.match(/This ticket was merged into #([A-Z0-9-]+)/i);
    if (mergeOutgoingMatch) {
        return {
            id: messageId,
            rawContent,
            type: 'MERGE',
            categoryGroup: 'status_sla',
            title: 'Tiket Digabungkan ke Tiket Lain',
            actor,
            createdAt,
            mergeInfo: {
                ticketNumber: mergeOutgoingMatch[1],
                isIncoming: false,
            },
        };
    }

    // 7. General SLA events
    if (contentWithoutActor.toLowerCase().includes('sla timer') || contentWithoutActor.toLowerCase().includes('sla target')) {
        const targetMatch = cleanContent.match(/Target(?:\s*updated to)?:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/i);
        return {
            id: messageId,
            rawContent,
            type: 'SLA',
            categoryGroup: 'status_sla',
            title: 'Pembaruan SLA',
            actor,
            createdAt,
            slaTarget: targetMatch ? targetMatch[1] : undefined,
            descriptionText: formatIsoStringsInText(contentWithoutActor),
        };
    }

    // 8. Fallback for any other event
    return {
        id: messageId,
        rawContent,
        type: 'OTHER',
        categoryGroup: 'properties',
        title: 'Aktivitas Sistem',
        actor,
        createdAt,
        descriptionText: formatIsoStringsInText(cleanContent),
    };
};

export const TicketHistory: React.FC<TicketHistoryProps> = ({ ticket }) => {
    const [activeFilter, setActiveFilter] = useState<EventCategory>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Parse all system messages into structured events
    const allActivities: ParsedActivity[] = useMemo(() => {
        const systemMessages = ticket.messages?.filter(m => m.isSystemMessage) || [];
        return systemMessages
            .map(m => parseSystemMessage(m.id, m.content, m.createdAt))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [ticket.messages]);

    // Filter by group and search query
    const filteredActivities = useMemo(() => {
        return allActivities.filter(item => {
            // Group filter
            if (activeFilter !== 'all' && item.categoryGroup !== activeFilter) {
                return false;
            }

            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = item.title.toLowerCase().includes(q);
                const matchActor = item.actor?.toLowerCase().includes(q);
                const matchRaw = item.rawContent.toLowerCase().includes(q);
                const matchDesc = item.descriptionText?.toLowerCase().includes(q);
                if (!matchTitle && !matchActor && !matchRaw && !matchDesc) {
                    return false;
                }
            }

            return true;
        });
    }, [allActivities, activeFilter, searchQuery]);

    const getEventBadge = (type: ParsedActivity['type']) => {
        switch (type) {
            case 'STATUS':
                return {
                    icon: Activity,
                    bg: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20',
                    dot: 'bg-blue-500',
                    label: 'Status',
                };
            case 'ASSIGNMENT':
                return {
                    icon: UserCheck,
                    bg: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border-purple-500/20',
                    dot: 'bg-purple-500',
                    label: 'Penugasan',
                };
            case 'PRIORITY':
                return {
                    icon: AlertCircle,
                    bg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20',
                    dot: 'bg-amber-500',
                    label: 'Prioritas',
                };
            case 'CATEGORY':
                return {
                    icon: Tag,
                    bg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20',
                    dot: 'bg-emerald-500',
                    label: 'Kategori',
                };
            case 'SLA':
                return {
                    icon: Clock,
                    bg: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-500/20',
                    dot: 'bg-cyan-500',
                    label: 'SLA Tracking',
                };
            case 'CANCEL':
                return {
                    icon: Ban,
                    bg: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20',
                    dot: 'bg-rose-500',
                    label: 'Pembatalan',
                };
            case 'MERGE':
                return {
                    icon: GitMerge,
                    bg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-500/20',
                    dot: 'bg-indigo-500',
                    label: 'Merge',
                };
            default:
                return {
                    icon: Sparkles,
                    bg: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border-slate-500/20',
                    dot: 'bg-slate-500',
                    label: 'Sistem',
                };
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950/30">
            {/* ── Toolbar: Summary + Filter Pills + Search ── */}
            <div className="shrink-0 p-4 sm:p-5 border-b border-border/80 bg-card/60 backdrop-blur-md space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                            <History className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <span>Activity Logs</span>
                                <span className="px-2 py-0.2 rounded-full text-[11px] font-extrabold bg-primary/10 text-primary">
                                    {allActivities.length}
                                </span>
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Riwayat lengkap perubahan status, penugasan, dan SLA tiket
                            </p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="relative min-w-[200px] sm:w-64">
                        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari log / aksi / user..."
                            className="w-full pl-8.5 pr-8 py-1.5 text-xs rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
                    {[
                        { id: 'all' as EventCategory, label: 'Semua Aktivitas', count: allActivities.length },
                        { id: 'status_sla' as EventCategory, label: 'Status & SLA', count: allActivities.filter(a => a.categoryGroup === 'status_sla').length },
                        { id: 'assignment' as EventCategory, label: 'Penugasan', count: allActivities.filter(a => a.categoryGroup === 'assignment').length },
                        { id: 'properties' as EventCategory, label: 'Properti', count: allActivities.filter(a => a.categoryGroup === 'properties').length },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveFilter(tab.id)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs",
                                activeFilter === tab.id
                                    ? "bg-primary text-primary-foreground shadow-xs"
                                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            <span>{tab.label}</span>
                            <span className={cn(
                                "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
                                activeFilter === tab.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                            )}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main Activity Timeline Stream ── */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                <div className="max-w-2xl mx-auto w-full">
                    {filteredActivities.length > 0 ? (
                        <div className="relative space-y-5 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-border/80">
                            {filteredActivities.map((activity, index) => {
                                const badge = getEventBadge(activity.type);
                                const IconComponent = badge.icon;

                                return (
                                    <div
                                        key={activity.id}
                                        className="relative pl-12 group animate-in fade-in slide-in-from-bottom-2 duration-200"
                                        style={{ animationDelay: `${index * 30}ms` }}
                                    >
                                        {/* Timeline Icon Node */}
                                        <div className={cn(
                                            "absolute left-0 top-3.5 w-9.5 h-9.5 rounded-2xl flex items-center justify-center shadow-xs border transition-transform duration-200 group-hover:scale-105 bg-card ring-4 ring-background",
                                            badge.bg
                                        )}>
                                            <IconComponent className="w-4 h-4" />
                                        </div>

                                        {/* Activity Bento Card */}
                                        <div className="bg-card dark:bg-slate-900 border border-border/90 hover:border-border rounded-2xl p-4 sm:p-5 shadow-xs transition-all space-y-3 group-hover:shadow-md">
                                            {/* Card Top: Type Badge + Title + Time */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 border-b border-border/60">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                                                        badge.bg
                                                    )}>
                                                        {badge.label}
                                                    </span>
                                                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                                                        {activity.title}
                                                    </h4>
                                                </div>

                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span className="font-semibold">{formatRelativeTime(activity.createdAt)}</span>
                                                    <span>·</span>
                                                    <span className="text-[11px] opacity-80">{formatDateTimeID(activity.createdAt)}</span>
                                                </div>
                                            </div>

                                            {/* Card Body: Visual Transition or Details */}
                                            {activity.statusChange && (
                                                <div className="flex items-center gap-2.5 flex-wrap p-2.5 rounded-xl bg-muted/40 border border-border/50">
                                                    {/* From Status */}
                                                    {(() => {
                                                        const fromCfg = STATUS_CONFIG[activity.statusChange.from] || { label: activity.statusChange.from, color: 'bg-muted text-muted-foreground', icon: Activity };
                                                        const FromIcon = fromCfg.icon || Activity;
                                                        return (
                                                            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border", fromCfg.color)}>
                                                                <FromIcon className="w-3.5 h-3.5" />
                                                                <span>{fromCfg.label}</span>
                                                            </div>
                                                        );
                                                    })()}

                                                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

                                                    {/* To Status */}
                                                    {(() => {
                                                        const toCfg = STATUS_CONFIG[activity.statusChange.to] || { label: activity.statusChange.to, color: 'bg-primary/10 text-primary', icon: CheckCircle2 };
                                                        const ToIcon = toCfg.icon || CheckCircle2;
                                                        return (
                                                            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs", toCfg.color)}>
                                                                <ToIcon className="w-3.5 h-3.5" />
                                                                <span>{toCfg.label}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            {/* Assignment Change */}
                                            {activity.assignmentChange && (
                                                <div className="flex items-center gap-2.5 flex-wrap p-2.5 rounded-xl bg-muted/40 border border-border/50">
                                                    {activity.assignmentChange.from && (
                                                        <>
                                                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-card border border-border text-xs text-muted-foreground">
                                                                <User className="w-3.5 h-3.5" />
                                                                <span className="font-semibold line-through opacity-80">{activity.assignmentChange.from}</span>
                                                            </div>
                                                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                                        </>
                                                    )}

                                                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-bold shadow-2xs">
                                                        <UserCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                                        <span>{activity.assignmentChange.to}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Priority Change */}
                                            {activity.priorityChange && (
                                                <div className="flex items-center gap-2.5 flex-wrap p-2.5 rounded-xl bg-muted/40 border border-border/50">
                                                    {(() => {
                                                        const fromP = PRIORITY_CONFIG[activity.priorityChange.from] || { label: activity.priorityChange.from, dot: 'bg-muted', color: 'text-muted-foreground' };
                                                        const toP = PRIORITY_CONFIG[activity.priorityChange.to] || { label: activity.priorityChange.to, dot: 'bg-primary', color: 'text-primary' };
                                                        return (
                                                            <>
                                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-semibold text-muted-foreground">
                                                                    <span className={cn("w-2 h-2 rounded-full", fromP.dot)} />
                                                                    <span>{fromP.label}</span>
                                                                </div>
                                                                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-bold">
                                                                    <span className={cn("w-2 h-2 rounded-full", toP.dot)} />
                                                                    <span className={toP.color}>{toP.label}</span>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            {/* Category Change */}
                                            {activity.categoryChange && (
                                                <div className="flex items-center gap-2.5 flex-wrap p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs">
                                                    <span className="px-2.5 py-1 rounded-lg bg-card border border-border text-muted-foreground font-medium line-through">
                                                        {activity.categoryChange.from}
                                                    </span>
                                                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                                                        {activity.categoryChange.to}
                                                    </span>
                                                </div>
                                            )}

                                            {/* SLA Target Callout Box */}
                                            {activity.slaTarget && (
                                                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
                                                    <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>Target Resolusi SLA:</span>
                                                        <span className="font-mono">{formatDateTimeID(activity.slaTarget)}</span>
                                                    </div>
                                                    {activity.slaNote && (
                                                        <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 pl-5">
                                                            {activity.slaNote}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Cancellation Callout */}
                                            {activity.cancelReason && (
                                                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1 text-rose-700 dark:text-rose-300">
                                                    <span className="font-bold flex items-center gap-1.5">
                                                        <Ban className="w-3.5 h-3.5" /> Alasan Pembatalan:
                                                    </span>
                                                    <p className="italic pl-5">"{activity.cancelReason}"</p>
                                                </div>
                                            )}

                                            {/* Merge Callout */}
                                            {activity.mergeInfo && (
                                                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                                                    <GitMerge className="w-4 h-4 shrink-0" />
                                                    <span>
                                                        {activity.mergeInfo.isIncoming
                                                            ? `Tiket #${activity.mergeInfo.ticketNumber} digabungkan ke dalam tiket ini.`
                                                            : `Tiket ini telah digabungkan ke tiket #${activity.mergeInfo.ticketNumber}.`}
                                                    </span>
                                                </div>
                                            )}

                                            {/* General Description / Fallback */}
                                            {activity.descriptionText && (
                                                <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                                                    {activity.descriptionText}
                                                </p>
                                            )}

                                            {/* Card Footer: Actor Information */}
                                            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <Shield className="w-3 h-3 text-muted-foreground/70" />
                                                    <span>Dilakukan oleh:</span>
                                                    <strong className="text-foreground">{activity.actor || 'Sistem iDesk'}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-card border border-border/70 rounded-3xl p-8 space-y-3 shadow-2xs">
                            <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground mx-auto flex items-center justify-center">
                                <History className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-bold text-foreground">
                                {searchQuery ? 'Tidak Ada Log yang Cocok' : 'Belum Ada Riwayat Aktivitas'}
                            </h4>
                            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                {searchQuery
                                    ? `Tidak ditemukan log aktivitas dengan kata kunci "${searchQuery}". Coba gunakan kata kunci lain.`
                                    : 'Aktivitas sistem, pembaruan status, dan penugasan teknisi akan tercatat secara otomatis di sini.'}
                            </p>
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors"
                                >
                                    Reset Pencarian
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TicketHistory;
