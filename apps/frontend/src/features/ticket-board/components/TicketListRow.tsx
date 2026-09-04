import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    AlertTriangle,
    MessageSquare,
    ChevronRight,
    Flame,
    CheckCircle2,
    Wrench,
    Calendar,
    Users,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AgentSelectList } from './AgentSelectList';
import { ReassignConfirmDialog, type TargetAgentInfo } from './ReassignConfirmDialog';
import { useAuth } from '@/stores/useAuth';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { formatSmartDate } from '@/lib/utils/dateFormat';

import { PriorityDropdown, StatusDropdown } from './TicketDropdowns';
import { TargetDateCell } from './TargetDateCell';
import { SelectCheckbox } from './BulkActionsBar';
import { TicketQuickPreview } from '@/components/ui/TicketQuickPreview';
import { ResolveTicketModal } from './ticket-detail/ResolveTicketModal';
import { getStaggeredDelay, StopPropagationWrapper } from '../utils/listUtils';

export interface TicketRowData {
    id: string;
    ticketNumber?: string;
    title: string;
    description: string;
    category: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'HARDWARE_INSTALLATION';
    source: 'WEB' | 'TELEGRAM' | 'EMAIL';
    isOverdue: boolean;
    slaTarget?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    isHardwareInstallation?: boolean;
    device?: string;
    software?: string;
    ictBudgetRequestId?: string | null;
    isParticipant?: boolean;
    participants?: { id: string; userId: string; user?: { fullName: string } }[];
    slaAdjustments?: any[];
    assignedTo?: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    };
    createdAt: string;
    updatedAt: string;
    user: {
        id?: string;
        fullName: string;
        role?: string;
        email?: string;
        avatarUrl?: string;
        department?: {
            name: string;
        };
    };
    messages?: any[];
    hasUnreadChat?: boolean;
    unreadMessageCount?: number;
    site?: {
        id: string;
        code: string;
        name: string;
    };
}

export interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: { code: string; name: string };
}

interface TicketListRowProps {
    ticket: TicketRowData;
    index: number;
    showSiteColumn: boolean;
    canEdit: boolean;
    isSelected: boolean;
    agents: Agent[];
    onSelect: (ticketId: string, selected: boolean) => void;
    onUpdatePriority: (ticketId: string, priority: string) => void;
    onUpdateStatus: (ticketId: string, status: string, resolutionNote?: string, files?: File[]) => void;
    onAssign: (ticketId: string, assigneeId: string, reason?: string) => void;
    /** Optional: custom style for virtualized lists */
    style?: React.CSSProperties;
}

export const TicketListRow: React.FC<TicketListRowProps> = React.memo(({
    ticket,
    index,
    showSiteColumn,
    canEdit,
    isSelected,
    agents,
    onSelect,
    onUpdatePriority,
    onUpdateStatus,
    onAssign,
    style,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const [desktopAssignOpen, setDesktopAssignOpen] = useState(false);
    const [mobileAssignOpen, setMobileAssignOpen] = useState(false);
    const [reassignModalOpen, setReassignModalOpen] = useState(false);
    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [targetAgentToAssign, setTargetAgentToAssign] = useState<TargetAgentInfo | null>(null);
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;

    const handleStatusChange = (newStatus: string) => {
        if (newStatus === 'RESOLVED') {
            setResolveModalOpen(true);
            return;
        }
        onUpdateStatus(ticket.id, newStatus);
    };

    const handleAgentSelect = (agentId: string) => {
        setDesktopAssignOpen(false);
        setMobileAssignOpen(false);

        if (ticket.assignedTo?.id === agentId) return;

        const target = agentId
            ? (agents.find((a) => a.id === agentId) || { id: agentId, fullName: 'Selected Agent' })
            : null;

        // If ticket already has an assigned PIC, prompt for confirmation and reason
        if (ticket.assignedTo?.id) {
            setTargetAgentToAssign(target);
            setReassignModalOpen(true);
        } else {
            // Unassigned ticket being assigned for the first time
            onAssign(ticket.id, agentId);
        }
    };

    const handleConfirmReassign = (reason: string) => {
        onAssign(ticket.id, targetAgentToAssign ? targetAgentToAssign.id : '', reason);
        setReassignModalOpen(false);
    };

    const handleRowClick = () => {
        navigate(`/tickets/${ticket.id}`, {
            state: { from: location.pathname + location.search }
        });
    };

    const handleRowKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleRowClick();
        }
    };

    // Combine custom style with staggered animation delay
    const rowStyle: React.CSSProperties = {
        ...style,
        ...getStaggeredDelay(index),
    };

    return (
        <div
            className={cn(
                "transition-colors duration-150 cursor-pointer group animate-fade-in-up border-b border-border/80 last:border-0",
                // Zebra striping for light mode
                index % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-[hsl(var(--background))] dark:bg-slate-800/40",
                // Subtle hover effect
                "hover:bg-slate-50 dark:hover:bg-[hsl(var(--muted))]/10 transition-colors relative z-0 hover:z-10",
                ticket.isOverdue && "!bg-[hsl(var(--error-500))]/5 dark:!bg-[hsl(var(--error-500))]/10",
                isSelected && "!bg-[hsl(var(--primary))]/10 dark:!bg-[hsl(var(--primary))]/10"
            )}
            style={rowStyle}
            onClick={handleRowClick}
            onKeyDown={handleRowKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`Open ticket ${ticket.ticketNumber || ticket.id.slice(0, 8)}: ${ticket.title}`}
        >
            {/* ========================================================================= */}
            {/* MOBILE CARD VIEW (< lg) - Compact, high-density, touch-first card layout */}
            {/* ========================================================================= */}
            <div className="block lg:hidden p-3.5 sm:p-4 space-y-2.5">
                {/* Mobile Top Row: Ticket ID, Badges, SLA & Date */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {/* Priority Dot */}
                        <span className={cn("w-2 h-2 rounded-full shrink-0", priorityConfig.dot || priorityConfig.barColor)} aria-hidden="true" />
                        
                        {/* Ticket Number */}
                        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/80 shrink-0 whitespace-nowrap">
                            #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                        </span>

                        {/* Site Badge */}
                        {ticket.site && (
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                                {ticket.site.code}
                            </span>
                        )}

                        {/* Hardware Installation Badge */}
                        {ticket.isHardwareInstallation && (
                            ticket.ictBudgetRequestId ? (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/hardware-requests/${ticket.ictBudgetRequestId}?highlight=installation`);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800/60 shadow-2xs transition-colors cursor-pointer"
                                    title="Terkait Hardware Request (Klik untuk buka)"
                                >
                                    <Wrench className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                    <span>Hardware Installation</span>
                                    <ChevronRight className="w-3 h-3 text-sky-500/70" />
                                </button>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800/60 shadow-2xs">
                                    <Wrench className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                    <span>Hardware Installation</span>
                                </span>
                            )
                        )}

                        {/* Participant Badge */}
                        {ticket.isParticipant && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/60 shadow-2xs">
                                <Users className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                Partisipan
                            </span>
                        )}

                        {/* Overdue / Critical Badge */}
                        {ticket.isOverdue && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800/50 animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                Overdue
                            </span>
                        )}
                        {ticket.priority === 'CRITICAL' && !ticket.isOverdue && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800/50">
                                <Flame className="w-3 h-3" />
                                Critical
                            </span>
                        )}
                    </div>

                    {/* Right: Created Date & Target SLA / Schedule */}
                    <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {ticket.isHardwareInstallation && ticket.scheduledDate ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                <span>{ticket.scheduledTime ? `${formatSmartDate(ticket.scheduledDate)}, ${ticket.scheduledTime}` : formatSmartDate(ticket.scheduledDate)}</span>
                            </span>
                        ) : ticket.slaTarget && ticket.status !== 'RESOLVED' && !ticket.isOverdue ? (
                            <div className="text-xs">
                                <TargetDateCell
                                    slaTarget={ticket.slaTarget}
                                    scheduledDate={ticket.scheduledDate}
                                    isHardwareInstallation={ticket.isHardwareInstallation}
                                    status={ticket.status}
                                />
                            </div>
                        ) : null}
                        <span>{formatSmartDate(ticket.createdAt)}</span>
                    </div>
                </div>

                {/* Mobile Middle Row: Title & Badges */}
                <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                        {ticket.title}
                    </h3>
                    {ticket.hasUnreadChat && (
                        <div className="mt-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 shadow-xs animate-pulse">
                                <MessageSquare className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>Pesan Baru{ticket.unreadMessageCount ? ` (${ticket.unreadMessageCount})` : ''}</span>
                            </span>
                        </div>
                    )}
                </div>

                {/* Mobile Bottom Row: Quick Status/Priority & People (Requester / Assignee) */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                    {/* Left: Quick Status & Priority Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <StopPropagationWrapper>
                            <StatusDropdown
                                value={ticket.status}
                                onChange={handleStatusChange}
                                disabled={!canEdit}
                            />
                        </StopPropagationWrapper>
                        <StopPropagationWrapper>
                            <PriorityDropdown
                                value={ticket.priority}
                                onChange={(value) => onUpdatePriority(ticket.id, value)}
                                disabled={!canEdit}
                            />
                        </StopPropagationWrapper>
                    </div>

                    {/* Right: Requester & Assignee with Chevron */}
                    <div className="flex items-center gap-2 min-w-0 justify-end">
                        {/* Requester */}
                        <div className="flex items-center gap-1 min-w-0 max-w-[110px]" title={`Requester: ${ticket.user?.fullName || 'Unknown'}`}>
                            <UserAvatar user={ticket.user} size="xs" />
                            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                                {ticket.user?.fullName?.split(' ')[0] || 'User'}
                            </span>
                        </div>

                        {/* Assignee Popover / Avatar */}
                        <div className="flex items-center gap-1 shrink-0">
                            <StopPropagationWrapper>
                                {canEdit ? (
                                    <Popover open={mobileAssignOpen} onOpenChange={setMobileAssignOpen}>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className={cn(
                                                    "flex items-center gap-1 p-1 rounded-lg border text-xs transition-all cursor-pointer",
                                                    ticket.assignedTo
                                                        ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                        : "border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                )}
                                                title={ticket.assignedTo ? `Assigned to ${ticket.assignedTo.fullName}` : "Assign agent"}
                                            >
                                                {ticket.assignedTo ? (
                                                    <UserAvatar user={ticket.assignedTo} size="xs" />
                                                ) : (
                                                    <span className="text-[10px] px-1 italic">Assign</span>
                                                )}
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0 w-72 shadow-2xl border-border bg-card overflow-hidden rounded-xl" align="end">
                                            <AgentSelectList
                                                agents={agents}
                                                selectedId={ticket.assignedTo?.id}
                                                isAdmin={isAdmin}
                                                onSelect={handleAgentSelect}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                ) : ticket.assignedTo ? (
                                    <UserAvatar user={ticket.assignedTo} size="xs" />
                                ) : null}
                            </StopPropagationWrapper>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* DESKTOP TABLE ROW (>= lg) - Full 9-column grid layout with all actions */}
            {/* ========================================================================= */}
            <div
                className={cn(
                    "hidden lg:grid items-center gap-4 px-4 py-3",
                    showSiteColumn
                        ? "lg:grid-cols-[32px_minmax(280px,2fr)_112px_80px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px]"
                        : "lg:grid-cols-[32px_minmax(280px,2fr)_112px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px]"
                )}
            >
                {/* Row Checkbox - Using StopPropagationWrapper */}
                {canEdit && (
                    <StopPropagationWrapper className={cn(
                        "flex w-8 shrink-0 items-center justify-center transition-opacity duration-200",
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                    )}>
                        <SelectCheckbox
                            checked={isSelected}
                            onChange={(checked) => onSelect(ticket.id, checked)}
                        />
                    </StopPropagationWrapper>
                )}

                {/* Ticket Info with Quick Preview */}
                <TicketQuickPreview ticket={ticket} side="right" align="start" disabled={false}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-2 h-2 rounded-full shrink-0 mt-1 self-start", priorityConfig.barColor)} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/80 shrink-0 whitespace-nowrap">
                                    #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                </span>
                                {ticket.isHardwareInstallation && (
                                    ticket.ictBudgetRequestId ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/hardware-requests/${ticket.ictBudgetRequestId}?highlight=installation`);
                                            }}
                                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800/60 shadow-2xs transition-colors cursor-pointer group/hw shrink-0"
                                            title="Terkait Hardware Request (Klik untuk buka)"
                                        >
                                            <Wrench className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                            <span>Hardware Installation</span>
                                            <ChevronRight className="w-3 h-3 text-sky-500/70 group-hover/hw:translate-x-0.5 transition-transform" />
                                        </button>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800/60 shadow-2xs shrink-0">
                                            <Wrench className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                            <span>Hardware Installation</span>
                                        </span>
                                    )
                                )}
                                {ticket.isParticipant && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/60 shadow-2xs shrink-0">
                                        <Users className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        Partisipan
                                    </span>
                                )}
                                {ticket.isOverdue && (
                                    <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--error-500))] animate-pulse-red shrink-0" />
                                )}
                                {ticket.priority === 'CRITICAL' && (
                                    <Flame className="w-3.5 h-3.5 text-[hsl(var(--error-500))] animate-pulse-red shrink-0" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                                <h3 className="font-semibold text-base text-slate-800 dark:text-white group-hover:text-[hsl(var(--primary))] transition-colors truncate">
                                    {ticket.title}
                                </h3>
                                {ticket.hasUnreadChat && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 shadow-sm animate-pulse shrink-0">
                                        <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                        <span>Pesan Baru{ticket.unreadMessageCount ? ` (${ticket.unreadMessageCount})` : ''}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </TicketQuickPreview>




                {/* Priority Dropdown - Using StopPropagationWrapper */}
                <StopPropagationWrapper>
                    <PriorityDropdown
                        value={ticket.priority}
                        onChange={(value) => onUpdatePriority(ticket.id, value)}
                        disabled={!canEdit}
                    />
                </StopPropagationWrapper>

                {/* Site Badge (Admin only) */}
                {showSiteColumn && (
                    <div>
                        {ticket.site ? (
                            <Badge variant="outline" className="text-xs font-medium">
                                {ticket.site.code}
                            </Badge>
                        ) : (
                            <span className="text-sm text-slate-500 dark:text-slate-400">-</span>
                        )}
                    </div>
                )}

                {/* Status Dropdown - Using StopPropagationWrapper */}
                <StopPropagationWrapper>
                    <StatusDropdown
                        value={ticket.status}
                        onChange={handleStatusChange}
                        disabled={!canEdit}
                    />
                </StopPropagationWrapper>

                {/* Requester */}
                <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar
                        user={ticket.user}
                        size="sm"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">{ticket.user?.fullName || 'Unknown'}</p>
                        <p className="text-[11px] font-medium text-muted-foreground truncate hidden md:block">{ticket.user?.department?.name || '-'}</p>
                    </div>
                </div>

                {/* Assigned To Dropdown - Using StopPropagationWrapper */}
                <StopPropagationWrapper className="min-w-0">
                    {canEdit ? (
                        <Popover open={desktopAssignOpen} onOpenChange={setDesktopAssignOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="h-8 w-full min-w-[140px] flex items-center justify-between gap-1.5 px-2.5 text-xs border border-border/80 bg-background shadow-xs hover:border-primary/40 hover:bg-muted/40 focus:ring-1 focus:ring-primary/50 transition-all rounded-lg font-medium cursor-pointer"
                                >
                                    {ticket.assignedTo ? (
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            <UserAvatar user={ticket.assignedTo} size="xs" />
                                            <span className="truncate text-xs font-semibold text-foreground">{ticket.assignedTo.fullName}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground/70 text-xs flex-1 text-left italic">Unassigned</span>
                                    )}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="p-0 w-80 shadow-2xl border-border bg-card overflow-hidden rounded-xl"
                                align="end"
                                side="bottom"
                                sideOffset={6}
                                collisionPadding={16}
                            >
                                <AgentSelectList
                                    agents={agents}
                                    selectedId={ticket.assignedTo?.id}
                                    isAdmin={isAdmin}
                                    onSelect={handleAgentSelect}
                                />
                            </PopoverContent>
                        </Popover>
                    ) : (
                        <div className="flex items-center gap-2 min-w-0">
                            {ticket.assignedTo ? (
                                <>
                                    <UserAvatar
                                        user={ticket.assignedTo}
                                        size="xs"
                                    />
                                    <span className="text-xs font-semibold text-foreground truncate">
                                        {ticket.assignedTo.fullName}
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs text-muted-foreground/70 italic font-medium">Unassigned</span>
                            )}
                        </div>
                    )}
                </StopPropagationWrapper>

                {/* Target Date */}
                <div className="min-w-0">
                    <TargetDateCell ticket={ticket} />
                </div>

                {/* Created Date */}
                <div className="flex items-center justify-between text-xs text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                        <span>{formatSmartDate(ticket.createdAt)}</span>
                        {ticket.messages && ticket.messages.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium ml-1">
                                <MessageSquare className="w-2.5 h-2.5" />
                                {ticket.messages.length}
                            </span>
                        )}
                    </div>
                    {/* Quick actions - visible on hover */}
                    <div className="flex items-center gap-1">
                        {canEdit && ticket.status !== 'RESOLVED' && (
                            <StopPropagationWrapper>
                                <button
                                    onClick={() => setResolveModalOpen(true)}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300 hover:text-green-700 dark:hover:text-green-300 transition-colors duration-150 cursor-pointer"
                                    title="Mark as resolved"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                </button>
                            </StopPropagationWrapper>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-[color,transform] duration-150" aria-hidden="true" />
                    </div>
                </div>
            </div>

            {/* Reassign / Transfer PIC Confirmation Modal */}
            <ReassignConfirmDialog
                isOpen={reassignModalOpen}
                onClose={() => setReassignModalOpen(false)}
                ticket={{
                    id: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                    assignedTo: ticket.assignedTo
                        ? {
                              id: ticket.assignedTo.id,
                              fullName: ticket.assignedTo.fullName,
                          }
                        : null,
                }}
                targetAgent={targetAgentToAssign}
                onConfirm={handleConfirmReassign}
            />

            {/* Resolve Confirmation Modal with Explanation and Proof Attachments */}
            <ResolveTicketModal
                isOpen={resolveModalOpen}
                onClose={() => setResolveModalOpen(false)}
                ticket={{
                    id: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                }}
                onConfirm={async (note, files) => {
                    await onUpdateStatus(ticket.id, 'RESOLVED', note, files);
                    setResolveModalOpen(false);
                }}
            />
        </div>
    );
});

export default TicketListRow;
