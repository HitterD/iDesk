import React, { useState, useMemo } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { 
    Clock, 
    Tag, 
    MessageSquare, 
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    Hourglass,
    XCircle,
    Globe,
    Send,
    Mail,
    Laptop,
    Code2,
    Calendar,
    FileText,
    ArrowUpRight,
    Flame,
    Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTimeID } from '@/lib/utils/dateFormat';

export interface TicketPreviewData {
    id: string;
    ticketNumber?: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    criticalReason?: string;
    category?: string;
    source?: 'WEB' | 'TELEGRAM' | 'EMAIL' | string;
    device?: string;
    software?: string;
    createdAt: string;
    updatedAt?: string;
    slaTarget?: string;
    isOverdue?: boolean;
    scheduledDate?: string;
    scheduledTime?: string;
    isHardwareInstallation?: boolean;
    slaAdjustments?: any[];
    hasUnreadChat?: boolean;
    unreadMessageCount?: number;
    site?: {
        code: string;
        name: string;
    };
    messages?: any[];
}

interface TicketQuickPreviewProps {
    ticket: TicketPreviewData;
    children: React.ReactNode;
    side?: 'left' | 'right' | 'top' | 'bottom';
    align?: 'start' | 'center' | 'end';
    disabled?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    TODO: { label: 'Open', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60', icon: CircleDot },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60', icon: Clock },
    WAITING_VENDOR: { label: 'Waiting Vendor', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60', icon: Hourglass },
    RESOLVED: { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon?: React.ElementType }> = {
    LOW: { label: 'Low Priority', color: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700' },
    MEDIUM: { label: 'Medium Priority', color: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-800/60' },
    HIGH: { label: 'High Priority', color: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-800/60', icon: AlertTriangle },
    CRITICAL: { label: 'Critical Priority', color: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/50 dark:border-red-800/60', icon: Flame },
    HARDWARE_INSTALLATION: { label: 'Hardware Install', color: 'text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/50 dark:border-teal-800/60', icon: Laptop },
};

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
    WEB: { label: 'Web Portal', icon: Globe },
    TELEGRAM: { label: 'Telegram Bot', icon: Send },
    EMAIL: { label: 'Email Support', icon: Mail },
};

export const TicketQuickPreview: React.FC<TicketQuickPreviewProps> = ({
    ticket,
    children,
    side = 'right',
    align = 'start',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const StatusIcon = status.icon;
    const PriorityIcon = priority.icon;

    const source = ticket.source ? (SOURCE_CONFIG[ticket.source.toUpperCase()] || { label: ticket.source, icon: Globe }) : null;
    const SourceIcon = source?.icon;

    const handleMouseEnter = () => {
        if (disabled) return;
        const id = setTimeout(() => setIsOpen(true), 320);
        setTimeoutId(id);
    };

    const handleMouseLeave = () => {
        if (timeoutId) clearTimeout(timeoutId);
        setIsOpen(false);
    };

    const cleanDescription = useMemo(() => {
        if (!ticket.description) return '';
        return ticket.description
            .replace(/<[^>]*>?/gm, '')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }, [ticket.description]);

    const formattedCategory = useMemo(() => {
        if (!ticket.category) return null;
        return ticket.category.replace(/_/g, ' ');
    }, [ticket.category]);

    // SLA Relative Countdown Context
    const slaInfo = useMemo(() => {
        if (ticket.status === 'RESOLVED') {
            return {
                type: 'resolved',
                label: 'Tiket Selesai',
                detail: 'Target SLA terpenuhi',
                colorClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60',
            };
        }

        if (ticket.scheduledDate) {
            return {
                type: 'scheduled',
                label: 'Jadwal Instalasi',
                detail: `${ticket.scheduledDate} ${ticket.scheduledTime ? `• ${ticket.scheduledTime}` : ''}`,
                colorClass: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/60',
            };
        }

        if (ticket.slaTarget) {
            const targetDate = new Date(ticket.slaTarget);
            const overdue = ticket.isOverdue || isPast(targetDate);
            const distance = formatDistanceToNow(targetDate, { addSuffix: true, locale: idLocale });

            if (overdue) {
                return {
                    type: 'overdue',
                    label: 'SLA Overdue (Terlambat)',
                    detail: `Target lewat ${distance.replace('yang lalu', '')}`,
                    colorClass: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/60',
                };
            }

            return {
                type: 'active',
                label: 'Target SLA',
                detail: `Batas waktu ${distance}`,
                colorClass: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80',
            };
        }

        return null;
    }, [ticket.status, ticket.scheduledDate, ticket.scheduledTime, ticket.slaTarget, ticket.isOverdue]);

    return (
        <PopoverPrimitive.Root open={isOpen}>
            <PopoverPrimitive.Trigger 
                asChild
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="inline-block">
                    {children}
                </div>
            </PopoverPrimitive.Trigger>

            <AnimatePresence>
                {isOpen && (
                    <PopoverPrimitive.Portal>
                        <PopoverPrimitive.Content
                            asChild
                            side={side}
                            align={align}
                            sideOffset={8}
                            avoidCollisions={true}
                            collisionPadding={16}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            className="z-50 outline-none pointer-events-auto"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: side === 'bottom' ? -4 : side === 'top' ? 4 : 0, x: side === 'left' ? 4 : side === 'right' ? -4 : 0 }}
                                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                className="w-88 sm:w-96 relative shadow-2xl rounded-2xl select-none"
                            >
                                <PopoverPrimitive.Arrow className="fill-card stroke-border/80" width={12} height={6} />
                                
                                {/* Card Body */}
                                <div className="bg-card text-card-foreground rounded-2xl shadow-xl border border-border/80 overflow-hidden backdrop-blur-md">
                                    {/* Header: Ticket Number, Source, & Status */}
                                    <div className="px-4 py-3 bg-muted/40 border-b border-border/60">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md shrink-0">
                                                    #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                                </span>

                                                {formattedCategory && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-secondary/80 text-foreground border border-border/60 truncate max-w-[140px]">
                                                        <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                                                        <span className="truncate">{formattedCategory}</span>
                                                    </span>
                                                )}

                                                {source && SourceIcon && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground bg-muted border border-border/40 shrink-0" title={`Sumber tiket: ${source.label}`}>
                                                        <SourceIcon className="w-2.5 h-2.5" />
                                                        <span>{source.label}</span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* Status Badge */}
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 shadow-2xs",
                                                status.color
                                            )}>
                                                <StatusIcon className="w-3 h-3 shrink-0" />
                                                <span>{status.label}</span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Middle Section: Title & Full Description */}
                                    <div className="p-4 space-y-3">
                                        {/* Ticket Title */}
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-sm text-foreground leading-snug text-balance">
                                                {ticket.title}
                                            </h4>
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                                                    priority.color
                                                )}>
                                                    {PriorityIcon && <PriorityIcon className="w-2.5 h-2.5" />}
                                                    <span>{priority.label}</span>
                                                </span>

                                                {ticket.site?.code && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted border border-border/40 text-muted-foreground">
                                                        <Building2 className="w-2.5 h-2.5" />
                                                        <span>Site {ticket.site.code}</span>
                                                    </span>
                                                )}

                                                {ticket.hasUnreadChat && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 shadow-2xs animate-pulse">
                                                        <MessageSquare className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                                        <span>Pesan Baru{ticket.unreadMessageCount ? ` (${ticket.unreadMessageCount})` : ''}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Critical Reason Warning Box */}
                                        {ticket.priority === 'CRITICAL' && ticket.criticalReason && (
                                            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs space-y-0.5">
                                                <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400 text-[10px] uppercase tracking-wider">
                                                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                                                    <span>Alasan Prioritas Critical</span>
                                                </div>
                                                <p className="text-foreground/90 font-medium text-[11px] leading-relaxed">
                                                    {ticket.criticalReason}
                                                </p>
                                            </div>
                                        )}

                                        {/* Issue Description Box */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                                <FileText className="w-3 h-3 text-primary shrink-0" />
                                                <span>Rincian Masalah</span>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto custom-scrollbar p-3 rounded-xl bg-muted/30 border border-border/50 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap select-text">
                                                {cleanDescription || (
                                                    <span className="text-muted-foreground italic">
                                                        Tidak ada rincian deskripsi tambahan pada tiket ini.
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Technical Context (Device / Software / System if present) */}
                                        {(ticket.device || ticket.software) && (
                                            <div className="flex items-center gap-2 flex-wrap pt-0.5 text-xs text-muted-foreground">
                                                {ticket.device && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/40 font-medium">
                                                        <Laptop className="w-3 h-3 text-muted-foreground" />
                                                        <span>{ticket.device}</span>
                                                    </span>
                                                )}
                                                {ticket.software && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/40 font-medium">
                                                        <Code2 className="w-3 h-3 text-muted-foreground" />
                                                        <span>{ticket.software}</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* SLA / Target Date Pill */}
                                        {slaInfo && (
                                            <div className={cn(
                                                "flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border font-medium",
                                                slaInfo.colorClass
                                            )}>
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {slaInfo.type === 'resolved' ? (
                                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                    ) : slaInfo.type === 'overdue' ? (
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                                                    ) : slaInfo.type === 'scheduled' ? (
                                                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                                                    ) : (
                                                        <Clock className="w-3.5 h-3.5 shrink-0" />
                                                    )}
                                                    <span className="font-bold shrink-0">{slaInfo.label}:</span>
                                                    <span className="truncate">{slaInfo.detail}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Footer: Helpful Click Hint */}
                                    <div className="px-4 py-2.5 bg-muted/30 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <span>Dibuat:</span>
                                            <span className="font-semibold text-foreground/80">{formatDateTimeID(ticket.createdAt)}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-primary font-semibold group-hover:underline">
                                            <span>Buka tiket</span>
                                            <ArrowUpRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        </PopoverPrimitive.Content>
                    </PopoverPrimitive.Portal>
                )}
            </AnimatePresence>
        </PopoverPrimitive.Root>
    );
};

export default TicketQuickPreview;
