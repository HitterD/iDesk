import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    MessageSquare,
    ChevronRight,
    Flame,
    CheckCircle2,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { formatSmartDate } from '@/lib/utils/dateFormat';

import { PriorityDropdown, StatusDropdown } from './TicketDropdowns';
import { TargetDateCell } from './TargetDateCell';
import { SelectCheckbox } from './BulkActionsBar';
import { TicketQuickPreview } from '@/components/ui/TicketQuickPreview';
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
    isHardwareInstallation?: boolean;
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
        role: string;
        email?: string;
        avatarUrl?: string;
        department?: {
            name: string;
        };
    };
    messages?: any[];
    site?: {
        id: string;
        code: string;
        name: string;
    };
}

interface Agent {
    id: string;
    fullName: string;
    avatarUrl?: string;
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
    onUpdateStatus: (ticketId: string, status: string) => void;
    onAssign: (ticketId: string, assigneeId: string) => void;
    /** Optional: custom style for virtualized lists */
    style?: React.CSSProperties;
}

export const TicketListRow: React.FC<TicketListRowProps> = ({
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
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;

    const handleRowClick = () => {
        navigate(`/tickets/${ticket.id}`);
    };

    // Combine custom style with staggered animation delay
    const rowStyle: React.CSSProperties = {
        ...style,
        ...getStaggeredDelay(index),
    };

    return (
        <div
            className={cn(
                "flex flex-col lg:grid lg:items-center gap-2 lg:gap-4 px-4 py-4 transition-all duration-200 cursor-pointer group animate-fade-in-up border-b border-slate-100 dark:border-slate-800 last:border-0",
                showSiteColumn
                    ? "lg:grid-cols-[32px_3fr_112px_80px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px]"
                    : "lg:grid-cols-[32px_3fr_112px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px]",
                "hover:bg-gradient-to-r hover:from-white/80 hover:to-white/40 dark:hover:from-slate-800/80 dark:hover:to-slate-800/40",
                "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20 hover:z-10 relative",
                ticket.isOverdue && "animate-overdue bg-red-50/50 dark:bg-red-900/10 border-l-4 border-l-red-500",
                ticket.priority === 'CRITICAL' && !ticket.isOverdue && "animate-critical-pulse border-l-4 border-l-orange-500",
                ticket.priority === 'HIGH' && !ticket.isOverdue && "animate-high-priority",
                isSelected && "bg-primary/5 dark:bg-primary/10 shadow-sm"
            )}
            style={rowStyle}
        >
            {/* Row Checkbox - Using StopPropagationWrapper */}
            {canEdit && (
                <StopPropagationWrapper className="hidden lg:block w-8 shrink-0">
                    <SelectCheckbox
                        checked={isSelected}
                        onChange={(checked) => onSelect(ticket.id, checked)}
                    />
                </StopPropagationWrapper>
            )}

            {/* Ticket Info with Quick Preview */}
            <TicketQuickPreview ticket={ticket} side="right" disabled={false}>
                <div className="flex items-center gap-3 min-w-0" onClick={handleRowClick}>
                    <div className={cn("w-1.5 h-12 rounded-full shrink-0", priorityConfig.barColor)} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                            </span>
                            {ticket.isOverdue && (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse-red" />
                            )}
                            {ticket.priority === 'CRITICAL' && (
                                <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse-red" />
                            )}
                        </div>
                        <h3
                            className="font-semibold text-base text-slate-800 dark:text-white group-hover:text-primary transition-colors truncate"
                            title={ticket.title}
                        >
                            {ticket.title}
                        </h3>
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
                <div className="" onClick={handleRowClick}>
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
                    onChange={(value) => onUpdateStatus(ticket.id, value)}
                    disabled={!canEdit}
                />
            </StopPropagationWrapper>

            {/* Requester */}
            <div className="flex items-center gap-2 min-w-0" onClick={handleRowClick}>
                <UserAvatar
                    user={ticket.user}
                    size="sm"
                />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{ticket.user?.fullName || 'Unknown'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden md:block">{ticket.user?.department?.name || '-'}</p>
                </div>
            </div>

            {/* Assigned To Dropdown - Using StopPropagationWrapper */}
            <StopPropagationWrapper className="min-w-0">
                {canEdit ? (
                    <Select
                        value={ticket.assignedTo?.id || "unassigned"}
                        onValueChange={(value) => {
                            if (value && value !== "unassigned") {
                                onAssign(ticket.id, value);
                            }
                        }}
                    >
                        <SelectTrigger className="h-8 w-full min-w-[140px] text-sm bg-transparent border-slate-200 dark:border-slate-700">
                            <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                    {agent.fullName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex items-center gap-2 min-w-0">
                        {ticket.assignedTo ? (
                            <>
                                <UserAvatar
                                    user={ticket.assignedTo}
                                    size="xs"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                    {ticket.assignedTo.fullName}
                                </span>
                            </>
                        ) : (
                            <span className="text-sm text-slate-400 italic">Unassigned</span>
                        )}
                    </div>
                )}
            </StopPropagationWrapper>

            {/* Target Date */}
            <div className="min-w-0" onClick={handleRowClick}>
                <TargetDateCell
                    slaTarget={ticket.slaTarget}
                    scheduledDate={ticket.scheduledDate}
                    isHardwareInstallation={ticket.isHardwareInstallation}
                    status={ticket.status}
                />
            </div>

            {/* Created Date & Quick Actions */}
            <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400" onClick={handleRowClick}>
                    <span>{formatSmartDate(ticket.createdAt)}</span>
                    {ticket.messages && ticket.messages.length > 0 && (
                        <span className="flex items-center gap-0.5">
                            <MessageSquare className="w-3 h-3" />
                            {ticket.messages.length}
                        </span>
                    )}
                </div>
                {/* Quick actions - visible on hover */}
                <div className="flex items-center gap-1">
                    {canEdit && ticket.status !== 'RESOLVED' && (
                        <StopPropagationWrapper>
                            <button
                                onClick={() => onUpdateStatus(ticket.id, 'RESOLVED')}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-all"
                                title="Mark as resolved"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                            </button>
                        </StopPropagationWrapper>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all" onClick={handleRowClick} />
                </div>
            </div>
        </div>
    );
};

export default TicketListRow;

