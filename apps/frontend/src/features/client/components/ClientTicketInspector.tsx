import React, { useState } from 'react';
import { Activity, AlertCircle, Check, Clock, Copy, MapPin, Monitor, SlidersHorizontal, Tag, UserCheck, UserX, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { TicketPill } from '@/components/ui/ticket-pill';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import type { TicketDetail } from '../../ticket-board/components/ticket-detail/types';
import { isTerminalStatus } from '../../ticket-board/components/ticket-detail/constants';
import { SidebarCard, InfoRow, sidebarPanelClass } from '../../ticket-board/components/ticket-detail/SidebarCard';
import { SlaProgress } from '../../ticket-board/components/ticket-detail/SlaProgress';
import { TicketParticipantsSection } from '../../ticket-board/components/ticket-detail/TicketParticipantsSection';
import { toDisplayName } from '../../ticket-board/components/ticket-detail/messageThread';
import { PriorityPill, PropertyRow, StatusPill } from '../../ticket-board/components/ticket-detail/TicketPropertyRows';

const PAUSED_STATUS = 'WAITING_VENDOR';

const AssignedAgentCard: React.FC<{ agent: TicketDetail['assignedTo'] }> = ({ agent }) => {
    const [copiedEmail, setCopiedEmail] = useState(false);
    const handleCopyEmail = () => {
        if (!agent?.email) return;
        navigator.clipboard.writeText(agent.email);
        setCopiedEmail(true);
        toast.success('Agent email copied to clipboard');
        setTimeout(() => setCopiedEmail(false), 2000);
    };

    return (
        <SidebarCard title="Teknisi" icon={UserCheck} bodyClassName="space-y-2">
            {agent ? (
                <>
                    <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                            <UserAvatar user={agent} size="md" className="h-10 w-10 rounded-full" />
                            <PresenceDot userId={agent.id} userName={agent.fullName} ringed className="absolute -bottom-0.5 -right-0.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{toDisplayName(agent.fullName)}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">IT Support Specialist</p>
                        </div>
                    </div>
                    {agent.email && (
                        <div>
                            <InfoRow label="Email">
                                <span className="inline-flex max-w-full items-center gap-1">
                                    <span className="truncate">{agent.email}</span>
                                    <button type="button" onClick={handleCopyEmail} className="shrink-0 cursor-pointer p-0.5 transition-colors hover:text-primary"
                                        title="Salin email teknisi" aria-label="Salin email teknisi">
                                        {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                                    </button>
                                </span>
                            </InfoRow>
                            {agent.site?.name && <InfoRow label="Site" icon={MapPin}>{agent.site.name}</InfoRow>}
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-1 py-2 text-center">
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-muted text-slate-500">
                        <UserX className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Menunggu teknisi</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tiket Anda dalam antrean penugasan tim IT Support</p>
                </div>
            )}
        </SidebarCard>
    );
};

const HardwareSchedule: React.FC<{ ticket: TicketDetail }> = ({ ticket }) => (
    <SidebarCard title="Instalasi hardware" icon={Wrench} bodyClassName="text-xs">
        <InfoRow label="Hardware Item">{ticket.hardwareType || 'N/A'}</InfoRow>
        <InfoRow label="Tanggal">
            {ticket.scheduledDate ? new Date(ticket.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
        </InfoRow>
        <InfoRow label="Jam">{ticket.scheduledTime || '-'}</InfoRow>
    </SidebarCard>
);

/** Requester inspector: plain readonly badges only, never editors or internal-note controls. */
export const ClientTicketInspector: React.FC<{ ticket: TicketDetail }> = ({ ticket }) => {
    const { user } = useAuth();
    const isClosed = isTerminalStatus(ticket.status);
    const isPaused = ticket.status === PAUSED_STATUS;
    const canManageParticipants = user?.role === 'ADMIN' || user?.role === 'AGENT' || Boolean(user?.role?.startsWith('AGENT_')) || user?.role === 'MANAGER';
    const canAddParticipants = canManageParticipants || ticket.user?.id === user?.id || Boolean(ticket.participants?.some(p => p.userId === user?.id));

    return (
        <div className={sidebarPanelClass}>
            <AssignedAgentCard agent={ticket.assignedTo} />

            <TicketParticipantsSection
                ticketId={ticket.id}
                creator={ticket.user}
                participants={ticket.participants}
                canManageUsers={canManageParticipants}
                canAddUsers={canAddParticipants}
                isClosed={isClosed}
            />

            <SidebarCard title="Properti tiket" icon={SlidersHorizontal} bodyClassName="space-y-2">
                <div>
                    <PropertyRow icon={Activity} label="Status"><StatusPill status={ticket.status} /></PropertyRow>
                    <PropertyRow icon={AlertCircle} label="Prioritas"><PriorityPill priority={ticket.priority} /></PropertyRow>
                    {ticket.category && (
                        <PropertyRow icon={Tag} label="Kategori"><TicketPill tone="neutral">{ticket.category.replace(/_/g, ' ')}</TicketPill></PropertyRow>
                    )}
                    {ticket.device && (
                        <PropertyRow icon={Monitor} label="Perangkat"><TicketPill tone="neutral">{ticket.device}</TicketPill></PropertyRow>
                    )}
                </div>
                {ticket.priority === 'CRITICAL' && ticket.criticalReason && (
                    <div className="rounded-xl bg-rose-50 p-3 text-xs dark:bg-rose-950/30">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                            <AlertCircle className="h-3 w-3" aria-hidden="true" />
                            Alasan blocker (critical)
                        </p>
                        <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{ticket.criticalReason}</p>
                    </div>
                )}
            </SidebarCard>

            <SidebarCard title="SLA" icon={Clock} bodyClassName="space-y-3">
                <SlaProgress
                    status={ticket.status}
                    priority={ticket.priority}
                    createdAt={ticket.createdAt}
                    slaStartedAt={ticket.slaStartedAt}
                    slaTarget={ticket.slaTarget}
                    slaRemainingMinutes={ticket.slaRemainingMinutes}
                    pausedAt={ticket.lastPausedAt}
                />
                <div>
                    <InfoRow label="Dibuat">{formatDateTimeID(ticket.createdAt)}</InfoRow>
                    <InfoRow label="Aktivitas terakhir">{formatRelativeTime(ticket.updatedAt)}</InfoRow>
                    {isPaused ? (
                        <InfoRow label="Dijeda sejak">{ticket.lastPausedAt ? formatDateTimeID(ticket.lastPausedAt) : '—'}</InfoRow>
                    ) : ticket.slaTarget && (
                        <InfoRow label="Target SLA"><span className="font-semibold text-primary">{formatDateTimeID(ticket.slaTarget)}</span></InfoRow>
                    )}
                </div>
            </SidebarCard>

            {ticket.isHardwareInstallation && <HardwareSchedule ticket={ticket} />}
        </div>
    );
};
