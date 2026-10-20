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
    Calendar,
    Wrench,
    CheckCircle2,
    Loader2,
    Mail,
    Copy,
    Clock,
    Shield,
    Check,
    MapPin,
    Tag,
    ChevronDown,
    UserX,
    UserPlus,
    X,
    ArrowLeftRight,
    ArrowUpRight,
    CalendarPlus,
    History,
    ChevronUp,
    ArrowRight,
    Bell,
    User,
    SlidersHorizontal,
    Lock,
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { toast } from 'sonner';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { TicketDetail } from './types';
import { STATUS_OPTIONS, STATUS_CONFIG, PRIORITY_CONFIG, isTerminalStatus, buildPriorityOptions } from './constants';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import { AgentSelectList, type Agent } from '../AgentSelectList';
import { ReassignConfirmDialog, type TargetAgentInfo } from '../ReassignConfirmDialog';
import { TicketForwardDialog, type ForwardTargetTeam } from '../TicketForwardDialog';
import { TicketParticipantsSection } from './TicketParticipantsSection';
import { ResolveTicketModal } from './ResolveTicketModal';
import { SetTicketReminderModal } from './SetTicketReminderModal';
import { SidebarCard, InfoRow, CardBadge, fieldTriggerClass, sidebarPanelClass } from './SidebarCard';
import { SlaProgress } from './SlaProgress';
import { toDisplayName } from './messageThread';
import { useAuth } from '@/stores/useAuth';

interface TicketSidebarProps {
    ticket: TicketDetail;
    agents: Agent[];
    slaConfigs: { id: string; priority: string; resolutionTimeMinutes: number }[];
    attributes: { categories: { id: string; value: string }[]; devices: { id: string; value: string }[]; software: any[] };
    onAssigneeChange: (value: string, reason?: string) => Promise<void>;
    onStatusChange: (value: string, resolutionNote?: string, files?: File[]) => Promise<void>;
    onPriorityChange: (value: string) => Promise<void>;
    onCategoryChange: (value: string) => Promise<void>;
    onDeviceChange: (value: string) => Promise<void>;
    onForward?: (targetTeam: ForwardTargetTeam, reason: string) => Promise<void> | void;
    onExtendSla?: () => void;
    onSetReminder?: () => void;
}

type FieldKey = 'assignee' | 'status' | 'priority' | 'category' | 'device';

const PropertyRow: React.FC<{
    icon: React.ElementType;
    label: string;
    saving: boolean;
    saved: boolean;
    children: React.ReactNode;
}> = ({ icon: Icon, label, saving, saved, children }) => (
    <div className="flex min-h-10 items-center justify-between gap-2 py-0.5">
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
            <Icon className="w-3.5 h-3.5" />
            {label}
            {saving && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
            {!saving && saved && (
                <CheckCircle2 className="w-3 h-3 text-emerald-500 animate-in fade-in zoom-in duration-200" />
            )}
        </span>
        {children}
    </div>
);

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
}) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const isClosed = isTerminalStatus(ticket.status);
    // Requester-side viewers (e.g. the agent who filed it) can't change properties.
    const isLocked = isClosed || ticket.viewerAccess === 'requester';
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [agentPickerOpen, setAgentPickerOpen] = useState(false);
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
        setAgentPickerOpen(false);
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
        try {
            await handleStatusChange(value);
        } catch {
            // Cancelled takeover or failed save (already reported): show the server status again.
            setLocalStatus(ticket.status);
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
        const actualVal = value === 'none' ? '' : value;
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
    const currentStatusConfig = STATUS_CONFIG[localStatus] || STATUS_CONFIG.TODO;
    const StatusIcon = currentStatusConfig.icon;
    const currentPriorityConfig = PRIORITY_CONFIG[localPriority] || PRIORITY_CONFIG.MEDIUM;
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

    return (
        <div className={cn(sidebarPanelClass, "select-none")}>

            {/* Requester */}
            <SidebarCard title="Requester" icon={User}>
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                        <UserAvatar user={ticket.user} size="md" className="w-10 h-10 rounded-full" />
                        <PresenceDot userId={ticket.user.id} userName={ticket.user.fullName} ringed className="absolute -bottom-0.5 -right-0.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {toDisplayName(ticket.user.fullName)}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <span className="truncate">{ticket.user.email}</span>
                            <button
                                type="button"
                                onClick={handleCopyEmail}
                                className="p-0.5 hover:text-primary transition-colors shrink-0 cursor-pointer"
                                title="Salin email"
                                aria-label="Salin email"
                            >
                                {copiedEmail ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                        <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                            <Building className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                                {[ticket.user.department?.name, ticket.user.site?.name].filter(Boolean).join(' · ') || 'Tanpa departemen'}
                            </span>
                        </p>
                    </div>
                </div>
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

            {/* Ticket properties */}
            <SidebarCard
                title="Properti tiket"
                icon={SlidersHorizontal}
                bodyClassName="divide-y divide-slate-100 dark:divide-slate-800"
                accessory={isClosed ? (
                    <CardBadge tone="amber"><Lock className="w-3 h-3" />Terkunci</CardBadge>
                ) : undefined}
            >
                {/* Assigned Agent */}
                <PropertyRow icon={UserCheck} label="Teknisi" saving={saving.assignee} saved={saved.assignee}>
                    <Popover open={agentPickerOpen} onOpenChange={setAgentPickerOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                disabled={isLocked || saving.assignee}
                                title={assignedAgent ? `${assignedAgent.fullName} · ${assignedAgent.email ?? ''}` : 'Pilih teknisi'}
                                className={cn(
                                    "flex h-8 min-w-0 max-w-[62%] -mr-2 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800",
                                    assignedAgent ? "text-slate-900 dark:text-white" : "text-primary",
                                    (isLocked || saving.assignee) && "opacity-60 cursor-not-allowed"
                                )}
                            >
                                {assignedAgent ? (
                                    <>
                                        <UserAvatar user={assignedAgent} size="xs" className="w-5 h-5 rounded-full text-[9px]" />
                                        <span className="truncate">{toDisplayName(assignedAgent.fullName)}</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-3.5 h-3.5" />
                                        <span>Pilih teknisi</span>
                                    </>
                                )}
                                <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-40" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="p-0 w-[300px] rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden bg-card" sideOffset={6}>
                            <AgentSelectList
                                agents={agents}
                                selectedId={localAssigneeId}
                                isAdmin={isAdmin}
                                onSelect={handleAgentSelect}
                            />
                        </PopoverContent>
                    </Popover>
                </PropertyRow>

                {/* Status */}
                <PropertyRow icon={Activity} label="Status" saving={saving.status} saved={saved.status}>
                    <Select value={localStatus} onValueChange={handleStatusSelectChange} disabled={isLocked || saving.status}>
                        <SelectTrigger className={fieldTriggerClass}>
                            {/* div, not span: SelectTrigger line-clamps direct span children, which wraps the icon */}
                            <div className={cn("inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium border-0", currentStatusConfig.color)}>
                                <StatusIcon className="w-3 h-3 shrink-0" />
                                {currentStatusConfig.label}
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl p-1 min-w-[180px]">
                            {STATUS_OPTIONS.map((opt) => {
                                const cfg = STATUS_CONFIG[opt.value] || STATUS_CONFIG.TODO;
                                const OptIcon = cfg.icon;
                                return (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs rounded-lg py-2 cursor-pointer font-medium">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "w-2 h-2 rounded-full shrink-0",
                                                opt.value === 'TODO' ? 'bg-slate-400' :
                                                opt.value === 'IN_PROGRESS' ? 'bg-primary' :
                                                opt.value === 'WAITING_VENDOR' ? 'bg-amber-500' :
                                                opt.value === 'RESOLVED' ? 'bg-emerald-500' : 'bg-rose-500'
                                            )} />
                                            <span className="flex items-center gap-1.5 font-medium">
                                                <OptIcon className="w-3.5 h-3.5 opacity-70" />
                                                {opt.label}
                                            </span>
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </PropertyRow>

                {/* Priority */}
                <PropertyRow icon={AlertCircle} label="Prioritas" saving={saving.priority} saved={saved.priority}>
                    {ticket.priority === 'HARDWARE_INSTALLATION' ? (
                        <div className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
                            Hardware Installation
                        </div>
                    ) : (
                        <Select value={localPriority} onValueChange={handlePriorityChange} disabled={isLocked || saving.priority}>
                            <SelectTrigger className={fieldTriggerClass}>
                                <span className="flex items-center gap-1.5 truncate" title={currentSlaHours ? `${currentSlaHours}h SLA` : undefined}>
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", currentPriorityConfig.dot)} />
                                    <span className="truncate text-slate-900 dark:text-white">{currentPriorityConfig.label}</span>
                                </span>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl p-1 min-w-[200px]">
                                {priorityOptions.map((opt) => {
                                    const pCfg = PRIORITY_CONFIG[opt.value];
                                    return (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs rounded-lg py-2 cursor-pointer font-medium">
                                            <div className="flex items-center justify-between w-full gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("w-2 h-2 rounded-full shrink-0", pCfg.dot)} />
                                                    <span className="font-semibold">{pCfg.label}</span>
                                                </div>
                                                {opt.slaHours !== null && (
                                                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                        {opt.slaHours}h SLA
                                                    </span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    )}
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

                {/* Category */}
                <PropertyRow icon={Hash} label="Kategori" saving={saving.category} saved={saved.category}>
                    <Select value={localCategory} onValueChange={handleCategoryChange} disabled={isLocked || saving.category}>
                        <SelectTrigger className={fieldTriggerClass}>
                            <span className="truncate text-slate-900 dark:text-white">{localCategory}</span>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl p-1 min-w-[180px]">
                            <SelectItem value="GENERAL" className="text-xs rounded-lg py-2 cursor-pointer font-medium">General</SelectItem>
                            <SelectItem value="HARDWARE" className="text-xs rounded-lg py-2 cursor-pointer font-medium">Hardware</SelectItem>
                            <SelectItem value="SOFTWARE" className="text-xs rounded-lg py-2 cursor-pointer font-medium">Software</SelectItem>
                            <SelectItem value="NETWORK" className="text-xs rounded-lg py-2 cursor-pointer font-medium">Network</SelectItem>
                            {attributes.categories.map((attr: any) => (
                                <SelectItem key={attr.id} value={attr.value} className="text-xs rounded-lg py-2 cursor-pointer font-medium">{attr.value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </PropertyRow>

                {/* Device */}
                <PropertyRow icon={Monitor} label="Perangkat" saving={saving.device} saved={saved.device}>
                    <Select value={localDevice || 'none'} onValueChange={handleDeviceChange} disabled={isLocked || saving.device}>
                        <SelectTrigger className={fieldTriggerClass}>
                            <span className={cn("truncate", localDevice ? "text-slate-900 dark:text-white" : "text-slate-400")}>
                                {localDevice || 'Tidak ada'}
                            </span>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl p-1 min-w-[180px]">
                            <SelectItem value="none" className="text-xs text-slate-400 rounded-lg py-2 cursor-pointer">None (Tidak Ada)</SelectItem>
                            {attributes.devices.map((dev: any) => (
                                <SelectItem key={dev.id} value={dev.value} className="text-xs rounded-lg py-2 cursor-pointer font-medium">{dev.value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </PropertyRow>
            </SidebarCard>

            {/* SLA & Tracking */}
            <SidebarCard
                title="SLA"
                icon={Clock}
                bodyClassName="space-y-3"
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
                <div>
                    <InfoRow label="Dibuat">{formatDateTimeID(ticket.createdAt)}</InfoRow>
                    <InfoRow label="Aktivitas terakhir">{formatRelativeTime(ticket.updatedAt)}</InfoRow>
                    {ticket.status === 'WAITING_VENDOR' ? (
                        <InfoRow label="Dijeda sejak">
                            {ticket.lastPausedAt ? formatDateTimeID(ticket.lastPausedAt) : '—'}
                        </InfoRow>
                    ) : ticket.slaTarget && (
                        <InfoRow label="Target SLA">
                            <span className="font-semibold text-primary">{formatDateTimeID(ticket.slaTarget)}</span>
                        </InfoRow>
                    )}
                </div>

                    {/* Scheduled Reminder Hint Card */}
                    {nextReminder && (
                        <div
                            onClick={() => {
                                if (onSetReminder) onSetReminder();
                                else setReminderModalOpen(true);
                            }}
                            className="group p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100/70 dark:hover:bg-purple-950/60 transition-colors cursor-pointer space-y-1"
                            title="Klik untuk melihat atau mengubah jadwal pengingat email"
                        >
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-300">
                                    <Bell className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 fill-purple-600/20" />
                                    <span>Pengingat Terjadwal</span>
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-200/70 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200">
                                    {formatDistanceToNow(new Date(nextReminder.remindAt), { addSuffix: true, locale: idLocale })}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {formatDateTimeID(nextReminder.remindAt)}
                                </span>
                                <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 group-hover:underline">
                                    Ubah →
                                </span>
                            </div>
                            {nextReminder.note && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate pt-0.5 border-t border-purple-200/60 dark:border-purple-900/40">
                                    "{nextReminder.note}"
                                </p>
                            )}
                        </div>
                    )}

                    {/* Actions: Perpanjang SLA & Atur Pengingat */}
                    {!isLocked && (
                        <div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                                {onExtendSla && (isAdmin || user?.role?.startsWith('AGENT')) && (
                                    <button
                                        type="button"
                                        onClick={onExtendSla}
                                        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline cursor-pointer"
                                        title="Perpanjang target SLA"
                                    >
                                        <CalendarPlus className="w-3.5 h-3.5" />
                                        <span>Perpanjang SLA</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onSetReminder) onSetReminder();
                                        else setReminderModalOpen(true);
                                    }}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline cursor-pointer"
                                    )}
                                    title="Atur pengingat email untuk agent"
                                >
                                    <Bell className={cn("w-3.5 h-3.5", nextReminder && "fill-primary")} />
                                    <span>{nextReminder ? 'Ubah Reminder' : 'Set Reminder'}</span>
                                    {nextReminder && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    )}
                                </button>
                            </div>
                        </div>
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
