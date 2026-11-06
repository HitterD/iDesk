import React, { useState } from 'react';
import { isValid } from 'date-fns';
import { ExternalSourceBadge } from '@/components/ui/ExternalSourceBadge';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    MessageSquare,
    ChevronDown,
    MonitorSmartphone,
    Flame,
    TriangleAlert,
    UserRoundPlus,
    Users,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import { TicketPill } from '@/components/ui/ticket-pill';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AgentSelectList } from './AgentSelectList';
import { ReassignConfirmDialog, type TargetAgentInfo } from './ReassignConfirmDialog';
import { useAuth } from '@/stores/useAuth';
import { REPORT_TEAM_LABELS } from '@/features/reports/reportTeams';

import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { PriorityDropdown, StatusDropdown } from './TicketDropdowns';
import { TargetDateCell } from './TargetDateCell';
import { SelectCheckbox } from './BulkActionsBar';
import { TicketQuickPreview } from '@/components/ui/TicketQuickPreview';
import { isTerminalStatus } from './ticket-detail/constants';
import { ResolveTicketModal } from './ticket-detail/ResolveTicketModal';
import { VendorVisitDialog } from './ticket-detail/VendorVisitDialog';
import { getStaggeredDelay, StopPropagationWrapper } from '../utils/listUtils';
import { useStatusTakeover, type TakeoverOptions } from '../hooks/useStatusTakeover';
import { TicketRowActions } from './TicketRowActions';

/** Created date in WIB like the rest of the app (SLA, timestamps), not the viewer's device zone. */
const CREATED_SHORT = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' });
const CREATED_FULL = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export interface TicketRowData {
    id: string;
    ticketNumber?: string;
    title: string;
    description: string;
    category: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'HARDWARE_INSTALLATION';
    source: 'WEB' | 'TELEGRAM' | 'EMAIL' | 'IPOP' | 'API';
    /** Connected app that filed it (source API), e.g. 'EBBK'. */
    externalSource?: string | null;
    isOverdue: boolean;
    slaTarget?: string;
    slaRemainingMinutes?: number | null;
    /** WAITING_VENDOR: agreed vendor time and why the ticket waits. */
    vendorVisitAt?: string | null;
    vendorNote?: string | null;
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
    /** Owning team; legacy rows without one are IT Support. */
    handlingTeam?: string | null;
}

export interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: { code: string; name: string };
}

export interface TicketListRowProps {
    ticket: TicketRowData;
    index: number;
    showSiteColumn: boolean;
    canEdit: boolean;
    isSelected: boolean;
    agents: Agent[];
    onSelect: (ticketId: string, selected: boolean) => void;
    onUpdatePriority: (ticketId: string, priority: string) => void;
    onUpdateStatus: (ticketId: string, status: string, resolutionNote?: string, files?: File[], takeover?: TakeoverOptions) => Promise<void>;
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
    // CLOSED is final: its status can no longer be changed from the list.
    const canEditStatus = canEdit && ticket.status !== 'CLOSED';
    const [desktopAssignOpen, setDesktopAssignOpen] = useState(false);
    const [mobileAssignOpen, setMobileAssignOpen] = useState(false);
    const [reassignModalOpen, setReassignModalOpen] = useState(false);
    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
    const [targetAgentToAssign, setTargetAgentToAssign] = useState<TargetAgentInfo | null>(null);
    const isCritical = ticket.priority === 'CRITICAL';
    const showCriticalIndicator = isCritical && !isTerminalStatus(ticket.status);
    // WAITING_VENDOR pauses the SLA clock: show the paused pill, never overdue.
    const showOverdue = ticket.isOverdue && ticket.status !== 'WAITING_VENDOR' && !isTerminalStatus(ticket.status);

    const statusTakeover = useStatusTakeover();
    const displayNumber = ticket.ticketNumber || ticket.id.slice(0, 8);
    const createdDate = ticket.createdAt ? new Date(ticket.createdAt) : null;
    const validCreatedDate = createdDate && isValid(createdDate) ? createdDate : null;
    const messageCount = ticket.messages?.length ?? 0;
    const selectLabel = `Pilih tiket ${displayNumber}`;
    // Same rule as the previous hover "Mark as resolved" button.
    const canQuickResolve = canEditStatus && ticket.status !== 'RESOLVED';
    const hardwarePath = ticket.isHardwareInstallation && ticket.ictBudgetRequestId
        ? `/hardware-requests/${ticket.ictBudgetRequestId}?highlight=installation` : null;

    const handleStatusChange = (newStatus: string) => {
        if (newStatus === 'RESOLVED') {
            setResolveModalOpen(true);
            return;
        }
        if (newStatus === 'WAITING_VENDOR') {
            setVendorDialogOpen(true);
            return;
        }
        statusTakeover
            .request(ticket, newStatus, (takeover) => onUpdateStatus(ticket.id, newStatus, undefined, undefined, takeover))
            .catch(() => undefined); // already reported by the status mutation's onError
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
        // Cegah event bubbling dari input, textarea, button, atau modal portal di dalam baris
        if (event.target !== event.currentTarget) {
            return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleRowClick();
        }
    };

    const rowActions = {
        number: displayNumber,
        onOpen: handleRowClick,
        onResolve: canQuickResolve ? () => setResolveModalOpen(true) : undefined,
        onOpenHardware: hardwarePath ? () => navigate(hardwarePath) : undefined,
    };
    const unreadLabel = ticket.unreadMessageCount ? `${ticket.unreadMessageCount} pesan baru` : 'Pesan baru';
    const unreadChip = ticket.hasUnreadChat && (
        <span className="queue-unread"><MessageSquare aria-hidden="true" />{unreadLabel}</span>
    );
    const hardwareLink = ticket.isHardwareInstallation && (hardwarePath ? (
        <button type="button" className="queue-hw-link" title="Buka Hardware Request"
            aria-label="Terkait Hardware Request (buka)"
            onClick={(e) => { e.stopPropagation(); navigate(hardwarePath); }}>
            <MonitorSmartphone aria-hidden="true" />Hardware
        </button>
    ) : (
        <span className="queue-hw-link" title="Hardware Installation">
            <MonitorSmartphone aria-hidden="true" />Hardware
        </span>
    ));

    const devTeam = ticket.handlingTeam && ticket.handlingTeam !== 'OPS_SUPPORT' ? ticket.handlingTeam : null;
    const teamTag = devTeam && (
        <span className="queue-src" title="Tim penanganan">{REPORT_TEAM_LABELS[devTeam as keyof typeof REPORT_TEAM_LABELS] ?? devTeam}</span>
    );

    // Combine custom style with staggered animation delay
    const rowStyle: React.CSSProperties = {
        ...style,
        ...getStaggeredDelay(index),
    };

    return (
        <div
            className={cn(
                'queue-row cursor-pointer group relative',
                (showOverdue || showCriticalIndicator) && 'queue-row-flagged',
                isSelected && 'is-selected'
            )}
            style={rowStyle}
            onClick={handleRowClick}
            onKeyDown={handleRowKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`Buka tiket ${displayNumber}: ${ticket.title}`}
        >
            {/* ========================================================================= */}
            {/* MOBILE CARD (< 1100px container) — mockup 390: id · ⋯ / title / status · SLA / PIC */}
            {/* ========================================================================= */}
            <div className="queue-mobile-row queue-mcard">
                <div className="queue-mcard-top">
                    <div className="queue-tk-id flex-wrap">
                        {canEdit && (
                            <label className="queue-select-cell queue-mcard-check" onClick={(event) => event.stopPropagation()}>
                                <input type="checkbox" className="size-4 accent-primary cursor-pointer"
                                    aria-label={selectLabel}
                                    checked={isSelected} onChange={(event) => onSelect(ticket.id, event.target.checked)} />
                            </label>
                        )}
                        <span>#{displayNumber}</span>
                        <ExternalSourceBadge source={ticket.source} externalSource={ticket.externalSource} />
                        {ticket.site && <TicketPill tone="neutral" className="queue-src font-mono">{ticket.site.code}</TicketPill>}
                        {hardwareLink}
                        {ticket.isParticipant && <span className="queue-src"><Users aria-hidden="true" />Partisipan</span>}
                        {teamTag}
                        {showOverdue && <span className="queue-flag"><TriangleAlert aria-hidden="true" />Overdue</span>}
                        {showCriticalIndicator && !showOverdue && <span className="queue-flag"><Flame aria-hidden="true" />{PRIORITY_CONFIG.CRITICAL.shortLabel}</span>}
                        {unreadChip}
                    </div>
                    <TicketRowActions layout="card" {...rowActions} className="queue-mcard-acts"
                        onChangePic={canEdit ? () => setMobileAssignOpen(true) : undefined}
                        selection={canEdit ? { selected: isSelected, onToggle: () => onSelect(ticket.id, !isSelected) } : undefined} />
                </div>
                <h3 className="queue-tk-title queue-mcard-title">{ticket.title}</h3>

                <div className="queue-mcard-mid">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <StopPropagationWrapper>
                            <StatusDropdown value={ticket.status} onChange={handleStatusChange} disabled={!canEditStatus} />
                        </StopPropagationWrapper>
                        {/* Mockup cards hide priority below 860px; kept on wider cards (tablet). */}
                        <StopPropagationWrapper className="queue-mcard-pri">
                            <PriorityDropdown value={ticket.priority} showCriticalIndicator={showCriticalIndicator}
                                onChange={(value) => onUpdatePriority(ticket.id, value)} disabled={!canEdit} />
                        </StopPropagationWrapper>
                    </div>
                    <div className="shrink-0">
                        <TargetDateCell ticket={ticket} />
                    </div>
                </div>

                <div className="queue-mcard-pic">
                    <StopPropagationWrapper className="min-w-0 flex-1">
                        {canEdit ? (
                            <Popover open={mobileAssignOpen} onOpenChange={setMobileAssignOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={`Ganti PIC: ${ticket.assignedTo?.fullName || 'Belum ada PIC'}`}
                                        className={cn('ticket-pill ticket-tone-neutral picker-trigger queue-pic', !ticket.assignedTo && 'queue-pic-empty')}
                                    >
                                        {ticket.assignedTo ? (
                                            <>
                                                <UserAvatar user={ticket.assignedTo} size="xs" />
                                                <span className="truncate flex-1 text-left">{ticket.assignedTo.fullName}</span>
                                            </>
                                        ) : (
                                            <>
                                                <UserRoundPlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                <span className="flex-1 text-left">Tetapkan PIC</span>
                                            </>
                                        )}
                                        <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
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
                        ) : (
                            <TicketPill tone="neutral" className="queue-pic">
                                {ticket.assignedTo ? (
                                    <><UserAvatar user={ticket.assignedTo} size="xs" /><span className="truncate">{ticket.assignedTo.fullName}</span></>
                                ) : <span className="text-muted-foreground">Belum ada PIC</span>}
                            </TicketPill>
                        )}
                    </StopPropagationWrapper>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* DESKTOP TABLE ROW (>= lg) - Full 9-column grid layout with all actions */}
            {/* ========================================================================= */}
            <div
                className={cn(
                    'queue-grid queue-desktop-row',
                    showSiteColumn ? 'queue-grid-sites' : 'queue-grid-default'
                )}
            >
                {/* Row Checkbox - Using StopPropagationWrapper */}
                {canEdit ? (
                    <SelectCheckbox
                        cell
                        label={selectLabel}
                        checked={isSelected}
                        onChange={(checked) => onSelect(ticket.id, checked)}
                    />
                ) : <span aria-hidden="true" />}

                {/* Ticket (mockup .tk): id line + title; quick actions float over the end of this cell only */}
                <div className="queue-title-cell">
                <TicketQuickPreview ticket={ticket} side="right" align="start" disabled={false}>
                    <div className="queue-tk">
                        <div className="queue-tk-id">
                            <span>#{displayNumber}</span>
                            <ExternalSourceBadge source={ticket.source} externalSource={ticket.externalSource} />
                            {hardwareLink}
                            {ticket.isParticipant && (
                                <span className="queue-src"><Users aria-hidden="true" />Partisipan</span>
                            )}
                            {teamTag}
                            {messageCount > 0 && (
                                <span className="queue-src" title={`${messageCount} pesan`}><MessageSquare aria-hidden="true" />{messageCount}</span>
                            )}
                            {unreadChip}
                        </div>
                        <h3 className="queue-tk-title">{ticket.title}</h3>
                    </div>
                </TicketQuickPreview>
                <TicketRowActions layout="row" {...rowActions}
                    onChangePic={canEdit ? () => setDesktopAssignOpen(true) : undefined} />
                </div>

                <StopPropagationWrapper>
                    <PriorityDropdown
                        value={ticket.priority}
                        showCriticalIndicator={showCriticalIndicator}
                        onChange={(value) => onUpdatePriority(ticket.id, value)}
                        disabled={!canEdit}
                    />
                </StopPropagationWrapper>

                {showSiteColumn && (
                    <div>
                        {ticket.site ? (
                            <TicketPill tone="neutral" className="font-mono">{ticket.site.code}</TicketPill>
                        ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                        )}
                    </div>
                )}

                <StopPropagationWrapper>
                    <StatusDropdown
                        value={ticket.status}
                        onChange={handleStatusChange}
                        disabled={!canEditStatus}
                    />
                </StopPropagationWrapper>

                {/* Pemohon (mockup .person) */}
                <div className="queue-person">
                    <UserAvatar user={ticket.user} size="sm" />
                    <div className="min-w-0">
                        <b>{ticket.user?.fullName || 'Tidak diketahui'}</b>
                        <small>{ticket.user?.department?.name || '-'}</small>
                    </div>
                </div>

                {/* PIC (mockup .bub.pic; dashed "Tetapkan PIC" when empty) */}
                <StopPropagationWrapper className="min-w-0">
                    {canEdit ? (
                        <Popover open={desktopAssignOpen} onOpenChange={setDesktopAssignOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={`Ganti PIC: ${ticket.assignedTo?.fullName || 'Belum ada PIC'}`}
                                    className={cn('ticket-pill ticket-tone-neutral picker-trigger queue-pic', !ticket.assignedTo && 'queue-pic-empty')}
                                >
                                    {ticket.assignedTo ? (
                                        <>
                                            <UserAvatar user={ticket.assignedTo} size="xs" />
                                            <span className="truncate flex-1 text-left">{ticket.assignedTo.fullName}</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserRoundPlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                            <span className="flex-1 text-left">Tetapkan PIC</span>
                                        </>
                                    )}
                                    <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
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
                        <TicketPill tone="neutral" className="queue-pic">
                            {ticket.assignedTo ? (
                                <>
                                    <UserAvatar user={ticket.assignedTo} size="xs" />
                                    <span className="truncate">{ticket.assignedTo.fullName}</span>
                                </>
                            ) : (
                                <span className="text-muted-foreground">Belum ada PIC</span>
                            )}
                        </TicketPill>
                    )}
                </StopPropagationWrapper>

                {/* SLA and created date occupy separate columns, matching the header. */}
                <div className="min-w-0">
                    <TargetDateCell ticket={ticket} />
                </div>
                {validCreatedDate ? (
                    <time className="queue-created-date" dateTime={ticket.createdAt}
                        title={CREATED_FULL.format(validCreatedDate)}>
                        {CREATED_SHORT.format(validCreatedDate)}
                    </time>
                ) : <span className="queue-created-date">-</span>}
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

            {/* PIC takeover confirmation when starting a ticket handled by another agent */}
            {statusTakeover.dialogProps && <ReassignConfirmDialog {...statusTakeover.dialogProps} />}

            {/* Waiting Vendor asks why (note) and when the vendor is expected */}
            <VendorVisitDialog
                isOpen={vendorDialogOpen}
                onClose={() => setVendorDialogOpen(false)}
                mode="start"
                ticket={{ id: ticket.id, ticketNumber: ticket.ticketNumber, title: ticket.title }}
                onConfirm={async (vendorVisitAt, vendorNote) => {
                    setVendorDialogOpen(false);
                    await statusTakeover
                        .request(ticket, 'WAITING_VENDOR', (takeover) =>
                            onUpdateStatus(ticket.id, 'WAITING_VENDOR', undefined, undefined, { ...takeover, vendorVisitAt, vendorNote }))
                        .catch(() => undefined); // already reported by the status mutation's onError
                }}
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
                    // Failures are toasted by the status mutation; close like before.
                    await onUpdateStatus(ticket.id, 'RESOLVED', note, files).catch(() => undefined);
                    setResolveModalOpen(false);
                }}
            />
        </div>
    );
});

export default TicketListRow;
