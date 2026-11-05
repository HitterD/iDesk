import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    UserCheck,
    Activity,
    AlertCircle,
    Hash,
    Monitor,
    Building,
    Wrench,
    Copy,
    Check,
    ChevronDown,
    CalendarPlus,
    History,
    ChevronUp,
    ArrowRight,
    Bell,
    BellRing,
    Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { toast } from 'sonner';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { TicketDetail } from './types';
import { isTerminalStatus, buildPriorityOptions } from './constants';
import { PriorityDropdown, StatusDropdown } from '../TicketDropdowns';
import { AssigneeBubble, CategoryBubble, DeviceBubble, NO_DEVICE_VALUE, PropertyRow } from './TicketPropertyRows';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import type { Agent } from '../AgentSelectList';
import { ReassignConfirmDialog, type TargetAgentInfo } from '../ReassignConfirmDialog';
import { TicketForwardDialog, type ForwardTargetTeam } from '../TicketForwardDialog';
import { TicketParticipantsSection } from './TicketParticipantsSection';
import { ResolveTicketModal } from './ResolveTicketModal';
import { VendorVisitDialog } from './VendorVisitDialog';
import { SetTicketReminderModal } from './SetTicketReminderModal';
import { SidebarCard, InfoRow, CardBadge, sidebarPanelClass } from './SidebarCard';
import { SlaProgress } from './SlaProgress';
import { RequesterDeviceRows } from './RequesterDeviceRows';
import { toDisplayName } from './messageThread';
import { useAuth } from '@/stores/useAuth';
import { Button } from '@/components/ui/button';
import { TicketHardwareSection } from '../ticket-hardware';
import { TicketEFormSection } from '../ticket-eform';
import { useTicketHold } from './useTicketHold';

interface TicketSidebarProps {
    ticket: TicketDetail;
    agents: Agent[];
    slaConfigs: { id: string; priority: string; resolutionTimeMinutes: number }[];
    attributes: { categories: { id: string; value: string }[]; devices: { id: string; value: string }[]; software: any[] };
    onAssigneeChange: (value: string, reason?: string) => Promise<void>;
    onStatusChange: (value: string, resolutionNote?: string, files?: File[], extra?: StatusChangeExtra) => Promise<void>;
    onPriorityChange: (value: string) => Promise<void>;
    onCategoryChange: (value: string) => Promise<void>;
    onDeviceChange: (value: string) => Promise<void>;
    onForward?: (targetTeam: ForwardTargetTeam, reason: string) => Promise<void> | void;
    onExtendSla?: () => void;
    onSetReminder?: () => void;
    /** Moves the vendor appointment of a WAITING_VENDOR ticket. */
    onRescheduleVendorVisit?: (vendorVisitAt: string, vendorNote: string) => Promise<void>;
}

/** Extra PATCH /status fields some transitions need (WAITING_VENDOR: the agreed visit time and why). */
export interface StatusChangeExtra {
    vendorVisitAt?: string;
    vendorNote?: string;
}

type FieldKey = 'assignee' | 'status' | 'priority' | 'category' | 'device';

export const TicketSidebar: React.FC<TicketSidebarProps> = ({
    ticket,
    agents,
    slaConfigs,
    attributes,
    onAssigneeChange,
    onStatusChange,
    onPriorityChange,
    onCategoryChange,
    onDeviceChange,
    onForward,
    onExtendSla,
    onSetReminder,
    onRescheduleVendorVisit,
}) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const isClosed = isTerminalStatus(ticket.status);
    // Requester-side viewers (e.g. the agent who filed it) can't change properties.
    const isLocked = isClosed || ticket.viewerAccess === 'requester';
    const hold = useTicketHold(ticket);
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [forwardOpen, setForwardOpen] = useState(false);
    const [reminderModalOpen, setReminderModalOpen] = useState(false);
    const [showSlaHistory, setShowSlaHistory] = useState(false);

    const isStaff =
        isAdmin ||
        user?.role === 'AGENT' ||
        Boolean(user?.role?.startsWith('AGENT_')) ||
        user?.role === 'MANAGER' ||
        ticket.assignedTo?.id === user?.id;
    const canManageParticipants = isStaff && ticket.viewerAccess !== 'requester';
    const isOracleTicket = ticket.handlingTeam === 'ORACLE_DEV' ||
        ticket.handlingTeam === 'MOBILE_DEV' ||
        ticket.handlingTeam === 'WEB_DEV' ||
        (ticket.handlingTeam == null && (ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === 'ORACLE_REQUEST' || ticket.ticketType === 'WEB_DEV_REQUEST' || ticket.ticketType === 'MOBILE_DEV_REQUEST'));
    const canAddParticipants = canManageParticipants || ticket.user?.id === user?.id || Boolean(ticket.participants?.some(p => p.userId === user?.id));

    // Local optimistic state per field
    const [localAssigneeId, setLocalAssigneeId] = useState(ticket.assignedTo?.id || '');
    const [localStatus, setLocalStatus] = useState(ticket.status);
    const [localPriority, setLocalPriority] = useState(ticket.priority);
    const [localCategory, setLocalCategory] = useState(ticket.category || 'GENERAL');
    const [localDevice, setLocalDevice] = useState(ticket.device || '');

    // Per-field saving/saved states
    const [saving, setSaving] = useState<Record<FieldKey, boolean>>({
        assignee: false, status: false, priority: false, category: false, device: false,
    });
    const [saved, setSaved] = useState<Record<FieldKey, boolean>>({
        assignee: false, status: false, priority: false, category: false, device: false,
    });

    // Sync from server when ticket changes
    useEffect(() => { setLocalAssigneeId(ticket.assignedTo?.id || ''); }, [ticket.assignedTo?.id]);
    useEffect(() => { setLocalStatus(ticket.status); }, [ticket.status]);
    useEffect(() => { setLocalPriority(ticket.priority); }, [ticket.priority]);
    useEffect(() => { setLocalCategory(ticket.category || 'GENERAL'); }, [ticket.category]);
    useEffect(() => { setLocalDevice(ticket.device || ''); }, [ticket.device]);

    const showSaved = (field: FieldKey) => {
        setSaved(prev => ({ ...prev, [field]: true }));
        setTimeout(() => setSaved(prev => ({ ...prev, [field]: false })), 1800);
    };

    const makeHandler = (
        field: FieldKey,
        setter: (v: string) => void,
        handler: (v: string) => Promise<void>
    ) => async (value: string) => {
        setter(value);
        setSaving(prev => ({ ...prev, [field]: true }));
        try {
            await handler(value);
            showSaved(field);
        } finally {
            setSaving(prev => ({ ...prev, [field]: false }));
        }
    };

    const [reassignModalOpen, setReassignModalOpen] = useState(false);
    const [targetAgentToAssign, setTargetAgentToAssign] = useState<TargetAgentInfo | null>(null);

    const handleAssigneeChange = async (value: string, reason?: string) => {
        const actualVal = value === 'unassigned' ? '' : value;
        setLocalAssigneeId(actualVal);
        setSaving(prev => ({ ...prev, assignee: true }));
        try {
            await onAssigneeChange(actualVal, reason);
            showSaved('assignee');
        } finally {
            setSaving(prev => ({ ...prev, assignee: false }));
        }
    };

    const handleAgentSelect = async (agentId: string) => {
        const actualVal = agentId === 'unassigned' ? '' : agentId;
        if (localAssigneeId === actualVal) return;

        const target = actualVal
            ? (agents.find((a) => a.id === actualVal) || { id: actualVal, fullName: 'Selected Agent' })
            : null;

        // If ticket already has an assigned PIC, prompt for confirmation and reason
        if (localAssigneeId) {
            setTargetAgentToAssign(target);
            setReassignModalOpen(true);
        } else {
            // Unassigned ticket -> assign directly
            await handleAssigneeChange(actualVal);
        }
    };

    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [vendorDialog, setVendorDialog] = useState<'start' | 'reschedule' | null>(null);

    const handleConfirmReassign = async (reason: string) => {
        const val = targetAgentToAssign ? targetAgentToAssign.id : '';
        await handleAssigneeChange(val, reason);
        setReassignModalOpen(false);
    };

    const handleStatusChange = makeHandler('status', setLocalStatus, onStatusChange);
    const handlePriorityChange = makeHandler('priority', setLocalPriority, onPriorityChange);
    const handleCategoryChange = makeHandler('category', setLocalCategory, onCategoryChange);

    const handleStatusSelectChange = async (value: string) => {
        if (value === 'RESOLVED') {
            setResolveModalOpen(true);
            return;
        }
        if (value === 'WAITING_VENDOR') {
            setVendorDialog('start');
            return;
        }
        try {
            await handleStatusChange(value);
        } catch {
            // Cancelled takeover or failed save (already reported): show the server status again.
            setLocalStatus(ticket.status);
        }
    };

    const handleConfirmVendorVisit = async (vendorVisitAt: string, vendorNote: string) => {
        if (vendorDialog === 'reschedule') {
            await onRescheduleVendorVisit?.(vendorVisitAt, vendorNote);
            setVendorDialog(null);
            return;
        }
        setVendorDialog(null);
        setLocalStatus('WAITING_VENDOR');
        setSaving(prev => ({ ...prev, status: true }));
        try {
            await onStatusChange('WAITING_VENDOR', undefined, undefined, { vendorVisitAt, vendorNote });
            showSaved('status');
        } catch {
            setLocalStatus(ticket.status);
        } finally {
            setSaving(prev => ({ ...prev, status: false }));
        }
    };

    const handleConfirmResolve = async (note: string, files: File[]) => {
        setLocalStatus('RESOLVED');
        setSaving(prev => ({ ...prev, status: true }));
        try {
            await onStatusChange('RESOLVED', note, files);
            showSaved('status');
        } finally {
            setSaving(prev => ({ ...prev, status: false }));
            setResolveModalOpen(false);
        }
    };

    const handleDeviceChange = async (value: string) => {
        const actualVal = value === NO_DEVICE_VALUE ? '' : value;
        setLocalDevice(actualVal);
        setSaving(prev => ({ ...prev, device: true }));
        try {
            await onDeviceChange(actualVal);
            showSaved('device');
        } finally {
            setSaving(prev => ({ ...prev, device: false }));
        }
    };

    const handleCopyEmail = () => {
        if (ticket.user.email) {
            navigator.clipboard.writeText(ticket.user.email);
            setCopiedEmail(true);
            toast.success('Email copied to clipboard');
            setTimeout(() => setCopiedEmail(false), 2000);
        }
    };

    const assignedAgent = agents.find(a => a.id === localAssigneeId) || (ticket.assignedTo as Agent | undefined);
    const priorityOptions = useMemo(() => buildPriorityOptions(slaConfigs), [slaConfigs]);
    const currentSlaHours = priorityOptions.find(o => o.value === localPriority)?.slaHours ?? null;

    // Active Scheduled Reminders Query
    const { data: reminders = [] } = useQuery<any[]>({
        queryKey: ['ticket-reminders', ticket.id],
        queryFn: async () => {
            const res = await api.get(`/tickets/${ticket.id}/reminders`);
            return res.data?.data || [];
        },
        enabled: Boolean(ticket?.id),
    });

    const nextReminder = useMemo(() => {
        if (!reminders || reminders.length === 0) return null;
        const active = reminders.filter((r: any) => !r.isSent);
        if (active.length === 0) return null;
        return [...active].sort(
            (a: any, b: any) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()
        )[0];
    }, [reminders]);

    const openReminder = () => {
        if (onSetReminder) onSetReminder();
        else setReminderModalOpen(true);
    };

    return (
        <div className={cn(sidebarPanelClass, "select-none")}>

            {/* Pemohon */}
            <SidebarCard title="Pemohon">
                <div className="td-person">
                    <div className="relative shrink-0">
                        <UserAvatar user={ticket.user} size="sm" className="h-9 w-9 rounded-full" />
                        <PresenceDot userId={ticket.user.id} userName={ticket.user.fullName} ringed className="absolute -bottom-0.5 -right-0.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <b>{toDisplayName(ticket.user.fullName)}</b>
                        <small>
                            <span className="truncate">
                                {[ticket.user.email, ticket.user.department?.name, ticket.user.site?.name].filter(Boolean).join(' · ') || 'Tanpa departemen'}
                            </span>
                            {ticket.user.email && (
                                <button type="button" onClick={handleCopyEmail} className="shrink-0 cursor-pointer p-0.5 transition-colors hover:text-primary"
                                    title="Salin email" aria-label="Salin email">
                                    {copiedEmail ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                </button>
                            )}
                        </small>
                    </div>
                </div>
                {isStaff && ticket.viewerAccess !== 'requester' && <RequesterDeviceRows ticketId={ticket.id} />}
            </SidebarCard>

            {/* Ticket properties */}
            <SidebarCard
                title="Properti"
                accessory={isLocked ? (
                    <CardBadge tone="amber"><Lock className="w-3 h-3" />Terkunci</CardBadge>
                ) : undefined}
            >
                <PropertyRow icon={UserCheck} label="PIC" saving={saving.assignee} saved={saved.assignee}>
                    <AssigneeBubble agent={assignedAgent} agents={agents} isAdmin={isAdmin} locked={isLocked}
                        disabled={saving.assignee} onSelect={handleAgentSelect} />
                </PropertyRow>
                <PropertyRow icon={Activity} label="Status" saving={saving.status} saved={saved.status}>
                    <StatusDropdown value={localStatus} onChange={handleStatusSelectChange} disabled={isLocked || saving.status} />
                </PropertyRow>
                <PropertyRow icon={AlertCircle} label="Prioritas" saving={saving.priority} saved={saved.priority}>
                    <span title={currentSlaHours ? `${currentSlaHours}h SLA` : undefined}>
                        <PriorityDropdown value={localPriority} onChange={handlePriorityChange} disabled={isLocked || saving.priority} />
                    </span>
                </PropertyRow>

                {/* Critical Priority Justification Card */}
                {(ticket.priority === 'CRITICAL' || localPriority === 'CRITICAL') && (
                    <div className="my-1 p-2.5 bg-red-50 dark:bg-red-950/30 rounded-xl space-y-1 animate-in fade-in duration-200">
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-xs font-semibold">Justifikasi critical</span>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                            {ticket.criticalReason || 'Tidak ada catatan justifikasi tertulis dari requester.'}
                        </p>
                    </div>
                )}

                <PropertyRow icon={Hash} label="Kategori" saving={saving.category} saved={saved.category}>
                    <CategoryBubble value={localCategory} categories={attributes.categories} locked={isLocked}
                        disabled={saving.category} onChange={handleCategoryChange} />
                </PropertyRow>
                <PropertyRow icon={Monitor} label="Perangkat" saving={saving.device} saved={saved.device}>
                    <DeviceBubble value={localDevice} devices={attributes.devices} locked={isLocked}
                        disabled={saving.device} onChange={handleDeviceChange} />
                </PropertyRow>
            </SidebarCard>

            {/* SLA & Tracking */}
            <SidebarCard
                title="SLA"
                accessory={
                    <div className="flex items-center gap-1.5">
                        {ticket.slaAdjustments && ticket.slaAdjustments.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowSlaHistory(!showSlaHistory)}
                                className="cursor-pointer"
                                title="Lihat riwayat perpanjangan SLA"
                                aria-expanded={showSlaHistory}
                            >
                                <CardBadge tone="amber">
                                    <History className="w-3 h-3" />
                                    {ticket.slaAdjustments.length}x diundur
                                    {showSlaHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </CardBadge>
                            </button>
                        )}
                    </div>
                }
            >
                <SlaProgress
                    status={ticket.status}
                    priority={ticket.priority}
                    createdAt={ticket.createdAt}
                    slaStartedAt={ticket.slaStartedAt}
                    slaTarget={ticket.slaTarget}
                    slaRemainingMinutes={ticket.slaRemainingMinutes}
                    pausedAt={ticket.lastPausedAt}
                />
                <div className="td-kvs">
                    {ticket.status === 'WAITING_VENDOR' ? (<>
                        {!hold && ticket.vendorNote && <InfoRow label="Keterangan">{ticket.vendorNote}</InfoRow>}
                        {hold ? (
                            <InfoRow label={hold.label}><span title={hold.detail}>{hold.code}</span></InfoRow>
                        ) : <InfoRow label="Janji vendor">
                            <span className="td-vendor-visit">
                                <span className={cn(ticket.vendorVisitAt && new Date(ticket.vendorVisitAt) < new Date() && 'is-late')}>
                                    {ticket.vendorVisitAt ? formatDateTimeID(ticket.vendorVisitAt) : 'Belum dijadwalkan'}
                                </span>
                                {!isLocked && onRescheduleVendorVisit && (
                                    <button type="button" className="td-vendor-visit-edit" onClick={() => setVendorDialog('reschedule')}>
                                        {ticket.vendorVisitAt ? 'Ubah' : 'Atur'}
                                    </button>
                                )}
                            </span>
                        </InfoRow>}
                        <InfoRow label="Dijeda sejak">
                            {ticket.lastPausedAt ? formatDateTimeID(ticket.lastPausedAt) : '—'}
                        </InfoRow>
                    </>) : ticket.slaTarget && (
                        <InfoRow label="Target SLA">{formatDateTimeID(ticket.slaTarget)}</InfoRow>
                    )}
                    <InfoRow label="Dibuat">{formatDateTimeID(ticket.createdAt)}</InfoRow>
                    <InfoRow label="Aktivitas terakhir">{formatRelativeTime(ticket.updatedAt)}</InfoRow>
                </div>

                    {/* Actions: Perpanjang SLA & Set Reminder (mockup .actions.pair, secondary) */}
                    {!isLocked && (
                        <div className="td-pair">
                            {onExtendSla && (isAdmin || user?.role?.startsWith('AGENT')) && (
                                <Button variant="soft" className="ticket-action-sla" onClick={onExtendSla} title="Perpanjang target SLA">
                                    <CalendarPlus aria-hidden="true" /><span>Perpanjang SLA</span>
                                </Button>
                            )}
                            <Button variant="soft" className="ticket-action-reminder" onClick={openReminder} title="Atur pengingat email untuk agent">
                                <Bell aria-hidden="true" /><span>{nextReminder ? 'Ubah pengingat' : 'Atur pengingat'}</span>
                            </Button>
                        </div>
                    )}

                    {/* Scheduled reminder (mockup .reminder-chip) */}
                    {nextReminder && (
                        <button type="button" onClick={openReminder} className="td-reminder-chip"
                            title={nextReminder.note ? `"${nextReminder.note}"` : 'Lihat atau ubah jadwal pengingat email'}>
                            <BellRing aria-hidden="true" />
                            <span className="min-w-0 truncate">
                                Reminder: {formatDateTimeID(nextReminder.remindAt)} · {formatDistanceToNow(new Date(nextReminder.remindAt), { addSuffix: true, locale: idLocale })}
                            </span>
                        </button>
                    )}

                    {/* Expandable History Accordion */}
                    {showSlaHistory && ticket.slaAdjustments && ticket.slaAdjustments.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <History className="w-3 h-3 text-primary" />
                                <span>Riwayat Penundaan Target</span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {ticket.slaAdjustments.map((adj, idx) => (
                                    <div key={adj.id || idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-1 text-[11px]">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-primary">
                                                +{adj.minutes}m ({adj.reasonCategory})
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {formatDateTimeID(adj.createdAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                                            <span>{adj.previousTarget ? formatDateTimeID(adj.previousTarget) : '-'}</span>
                                            <ArrowRight className="w-3 h-3 shrink-0" />
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {adj.newTarget ? formatDateTimeID(adj.newTarget) : '-'}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-300 italic">
                                            "{adj.reasonText}"
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
            </SidebarCard>

            {/* 3. Ticket Participants (All Tickets / Multi-user Group) */}
            <TicketParticipantsSection
                ticketId={ticket.id}
                creator={ticket.user}
                participants={ticket.participants}
                canManageUsers={canManageParticipants}
                canAddUsers={canAddParticipants}
                isClosed={isClosed}
            />

            {/* Hardware requests and e-form access proposed from this ticket */}
            <TicketHardwareSection ticketId={ticket.id} />
            <TicketEFormSection ticketId={ticket.id} />

            {/* 4. Hardware Installation Schedule (if applicable) */}
            {ticket.isHardwareInstallation && (
                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 ring-1 ring-amber-200/70 dark:ring-amber-900/50 space-y-3">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                        <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-[13px] font-semibold text-amber-700 dark:text-amber-400">
                            Instalasi hardware
                        </span>
                    </div>

                    <div className="text-xs space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-amber-700/80 dark:text-amber-400/80">Hardware Item:</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                                {ticket.hardwareType || 'N/A'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-2.5">
                                <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Tanggal</span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {ticket.scheduledDate ? new Date(ticket.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-2.5">
                                <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Jam</span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {ticket.scheduledTime || '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Set Reminder Dialog */}
            <SetTicketReminderModal
                isOpen={reminderModalOpen}
                onClose={() => setReminderModalOpen(false)}
                ticketId={ticket.id}
                ticketNumber={ticket.ticketNumber}
                ticketTitle={ticket.title}
                assignedAgent={ticket.assignedTo ? {
                    id: ticket.assignedTo.id,
                    fullName: ticket.assignedTo.fullName,
                    email: ticket.assignedTo.email,
                } : null}
            />

            {/* Forward Dialog */}
            <TicketForwardDialog
                isOpen={forwardOpen}
                onClose={() => setForwardOpen(false)}
                ticket={{
                    id: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                    handlingTeam: ticket.handlingTeam,
                }}
                onConfirm={async (targetTeam, reason) => {
                    if (onForward) await onForward(targetTeam, reason);
                    setForwardOpen(false);
                }}
            />

            {/* Reassign Modal */}
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

            <VendorVisitDialog
                isOpen={vendorDialog !== null}
                onClose={() => setVendorDialog(null)}
                mode={vendorDialog ?? 'start'}
                ticket={{ id: ticket.id, ticketNumber: ticket.ticketNumber, title: ticket.title, vendorVisitAt: ticket.vendorVisitAt, vendorNote: ticket.vendorNote }}
                onConfirm={handleConfirmVendorVisit}
                isLoading={saving.status}
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
                onConfirm={handleConfirmResolve}
                isLoading={saving.status}
            />
        </div>
    );
};
