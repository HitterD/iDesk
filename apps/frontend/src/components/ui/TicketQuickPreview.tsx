import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
    Clock, 
    User, 
    Tag, 
    MessageSquare, 
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    Hourglass,
    XCircle,
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from './UserAvatar';

interface TicketPreviewData {
    id: string;
    ticketNumber?: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    category?: string;
    createdAt: string;
    slaTarget?: string;
    isOverdue?: boolean;
    user?: {
        fullName: string;
        avatarUrl?: string;
        department?: { name: string };
    };
    assignedTo?: {
        fullName: string;
        avatarUrl?: string;
    };
    messages?: any[];
}

interface TicketQuickPreviewProps {
    ticket: TicketPreviewData;
    children: React.ReactNode;
    side?: 'left' | 'right' | 'top' | 'bottom';
    disabled?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    TODO: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: CircleDot },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Clock },
    WAITING_VENDOR: { label: 'Waiting', color: 'bg-purple-100 text-purple-700', icon: Hourglass },
    RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600', icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Low', color: 'text-slate-500 bg-slate-100' },
    MEDIUM: { label: 'Medium', color: 'text-blue-600 bg-blue-100' },
    HIGH: { label: 'High', color: 'text-orange-600 bg-orange-100' },
    CRITICAL: { label: 'Critical', color: 'text-red-600 bg-red-100' },
};

export const TicketQuickPreview: React.FC<TicketQuickPreviewProps> = ({
    ticket,
    children,
    side = 'right',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const StatusIcon = status.icon;

    const handleMouseEnter = () => {
        if (disabled) return;
        const id = setTimeout(() => setIsOpen(true), 400);
        setTimeoutId(id);
    };

    const handleMouseLeave = () => {
        if (timeoutId) clearTimeout(timeoutId);
        setIsOpen(false);
    };

    const getPositionClasses = () => {
        switch (side) {
            case 'left': return 'right-full mr-2 top-0';
            case 'top': return 'bottom-full mb-2 left-0';
            case 'bottom': return 'top-full mt-2 left-0';
            default: return 'left-full ml-2 top-0';
        }
    };

    const getArrowClasses = () => {
        switch (side) {
            case 'left': return 'right-0 translate-x-1/2 top-4 rotate-45';
            case 'top': return 'bottom-0 translate-y-1/2 left-4 rotate-45';
            case 'bottom': return 'top-0 -translate-y-1/2 left-4 rotate-45';
            default: return 'left-0 -translate-x-1/2 top-4 rotate-45';
        }
    };

    return (
        <div 
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? -4 : side === 'top' ? 4 : 0, x: side === 'left' ? 4 : side === 'right' ? -4 : 0 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={cn(
                            "absolute z-50 w-80",
                            getPositionClasses()
                        )}
                    >
                        {/* Arrow */}
                        <div className={cn(
                            "absolute w-3 h-3 bg-white dark:bg-slate-800 border-l border-t border-slate-200 dark:border-slate-700",
                            getArrowClasses()
                        )} />
                        
                        {/* Content */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            {/* Header */}
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                        #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                    </span>
                                    <span className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                        status.color
                                    )}>
                                        <StatusIcon className="w-3 h-3" />
                                        {status.label}
                                    </span>
                                </div>
                                <h4 className="font-semibold text-slate-800 dark:text-white text-sm line-clamp-2">
                                    {ticket.title}
                                </h4>
                            </div>
                            
                            {/* Body */}
                            <div className="p-4 space-y-3">
                                {/* Description */}
                                {ticket.description && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                                        {ticket.description}
                                    </p>
                                )}
                                
                                {/* Meta Info */}
                                <div className="flex flex-wrap gap-2">
                                    <span className={cn(
                                        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                                        priority.color
                                    )}>
                                        {priority.label}
                                    </span>
                                    {ticket.category && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                            <Tag className="w-3 h-3" />
                                            {ticket.category}
                                        </span>
                                    )}
                                    {ticket.messages && ticket.messages.length > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                            <MessageSquare className="w-3 h-3" />
                                            {ticket.messages.length}
                                        </span>
                                    )}
                                </div>
                                
                                {/* SLA Warning */}
                                {ticket.isOverdue && (
                                    <div className="flex items-center gap-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span className="font-medium">SLA Overdue</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Footer */}
                            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    {/* Requester */}
                                    <div className="flex items-center gap-2">
                                        <UserAvatar user={ticket.user} size="xs" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                                                {ticket.user?.fullName || 'Unknown'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 truncate">
                                                {ticket.user?.department?.name || 'No department'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Created Date */}
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400">Created</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">
                                            {format(new Date(ticket.createdAt), 'dd MMM yyyy')}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Assigned To */}
                                {ticket.assignedTo && (
                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <span className="text-[10px] text-slate-400">Assigned to:</span>
                                        <UserAvatar user={ticket.assignedTo} size="xs" />
                                        <span className="text-xs text-slate-600 dark:text-slate-400">
                                            {ticket.assignedTo.fullName}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TicketQuickPreview;
