import React, { useState } from 'react';
import { AlertCircle, Check, Copy, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
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
import { TicketHardwareSection, useHardwareHold } from '../../ticket-board/components/ticket-hardware';

const PAUSED_STATUS = 'WAITING_VENDOR';
const COPIED_RESET_MS = 2000;
/** "GENERAL" → "General", "ORACLE_REQUEST" → "Oracle Request" (mockup readonly value). */
const categoryLabel = (value: string) => value.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
/** Mockup "Perkiraan waktu" aside: "Kamis, 22 Okt". */
const TARGET_DAY = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'short' });

const AssignedAgentCard: React.FC<{ agent: TicketDetail['assignedTo'] }> = ({ agent }) => {
    const [copiedEmail, setCopiedEmail] = useState(false);
    const handleCopyEmail = () => {
        if (!agent?.email) return;
        navigator.clipboard.writeText(agent.email);
        setCopiedEmail(true);
        toast.success('Email teknisi disalin');
        setTimeout(() => setCopiedEmail(false), COPIED_RESET_MS);
    };

    return (
        <SidebarCard title="Ditangani oleh">
            {agent ? (
                <div className="td-person">
                    <div className="relative shrink-0">
                        <UserAvatar user={agent} size="sm" className="h-9 w-9 rounded-full" />
                        <PresenceDot userId={agent.id} userName={agent.fullName} ringed className="absolute -bottom-0.5 -right-0.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <b>{toDisplayName(agent.fullName)}</b>
                        <small>
                            <span className="truncate">IT Support Specialist{agent.site?.name ? ` · ${agent.site.name}` : ''}</span>
                        </small>
                        {agent.email && (
                            <small>
                                <span className="truncate">{agent.email}</span>
                                <button type="button" onClick={handleCopyEmail} className="shrink-0 cursor-pointer p-0.5 transition-colors hover:text-primary"
                                    title="Salin email teknisi" aria-label="Salin email teknisi">
                                    {copiedEmail ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                </button>
                            </small>
                        )}
                    </div>
                </div>
            ) : (
                <div className="td-person">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-slate-500"><UserX className="h-4 w-4" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                        <b>Menunggu teknisi</b>
                        <small><span className="truncate">Tiket Anda dalam antrean penugasan tim IT Support</span></small>
                    </div>
                </div>
            )}
        </SidebarCard>
    );
};

const HardwareSchedule: React.FC<{ ticket: TicketDetail }> = ({ ticket }) => (
    <SidebarCard title="Instalasi hardware" bodyClassName="td-kvs">
        <InfoRow label="Perangkat">{ticket.hardwareType || '-'}</InfoRow>
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
    const hardwareHold = useHardwareHold(ticket);
    const canManageParticipants = user?.role === 'ADMIN' || user?.role === 'AGENT' || Boolean(user?.role?.startsWith('AGENT_')) || user?.role === 'MANAGER';
    const canAddParticipants = canManageParticipants || ticket.user?.id === user?.id || Boolean(ticket.participants?.some(p => p.userId === user?.id));

    return (
        <div className={sidebarPanelClass}>
            <AssignedAgentCard agent={ticket.assignedTo} />

            <SidebarCard title="Detail tiket" bodyClassName="space-y-2">
                <div>
                    <PropertyRow label="Status"><StatusPill status={ticket.status} /></PropertyRow>
                    <PropertyRow label="Prioritas"><PriorityPill priority={ticket.priority} short /></PropertyRow>
                    <PropertyRow label="Kategori"><span className="td-readonly">{ticket.category ? categoryLabel(ticket.category) : 'Tidak ada'}</span></PropertyRow>
                    <PropertyRow label="Perangkat"><span className="td-readonly">{ticket.device || 'Tidak ada'}</span></PropertyRow>
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

            <SidebarCard title="Perkiraan waktu">
                <SlaProgress
                    variant="requester"
                    aside={ticket.slaTarget && !isPaused && !isClosed ? TARGET_DAY.format(new Date(ticket.slaTarget)) : undefined}
                    status={ticket.status}
                    priority={ticket.priority}
                    createdAt={ticket.createdAt}
                    slaStartedAt={ticket.slaStartedAt}
                    slaTarget={ticket.slaTarget}
                    slaRemainingMinutes={ticket.slaRemainingMinutes}
                    pausedAt={ticket.lastPausedAt}
                    pausedLabel={hardwareHold ? 'Menunggu hardware' : undefined}
                />
                <div className="td-kvs">
                    {isPaused ? (
                        <InfoRow label="Dijeda sejak">{ticket.lastPausedAt ? formatDateTimeID(ticket.lastPausedAt) : '—'}</InfoRow>
                    ) : ticket.slaTarget && (
                        <InfoRow label="Target SLA">{formatDateTimeID(ticket.slaTarget)}</InfoRow>
                    )}
                    <InfoRow label="Diajukan">{formatDateTimeID(ticket.createdAt)}</InfoRow>
                    <InfoRow label="Aktivitas terakhir">{formatRelativeTime(ticket.updatedAt)}</InfoRow>
                </div>
            </SidebarCard>

            <TicketParticipantsSection
                ticketId={ticket.id}
                creator={ticket.user}
                participants={ticket.participants}
                canManageUsers={canManageParticipants}
                canAddUsers={canAddParticipants}
                isClosed={isClosed}
            />

            <TicketHardwareSection ticketId={ticket.id} />

            {ticket.isHardwareInstallation && <HardwareSchedule ticket={ticket} />}
        </div>
    );
};
