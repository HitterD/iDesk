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
import { toast } from 'sonner';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { TicketDetail } from './types';
import { STATUS_OPTIONS, STATUS_CONFIG, PRIORITY_CONFIG } from './constants';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import { AgentSelectList, type Agent } from '../AgentSelectList';
import { ReassignConfirmDialog, type TargetAgentInfo } from '../ReassignConfirmDialog';
import { TicketForwardDialog, type ForwardTargetTeam } from '../TicketForwardDialog';
import { TicketParticipantsSection } from './TicketParticipantsSection';
import { ResolveTicketModal } from './ResolveTicketModal';
import { SetTicketReminderModal } from './SetTicketReminderModal';
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
    <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                {label}
            </span>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
            {!saving && saved && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 animate-in fade-in zoom-in duration-200" />
            )}
        </div>
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
    const isClosed = ticket.status === 'CANCELLED' || ticket.status === 'RESOLVED';
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [agentPickerOpen, setAgentPickerOpen] = useState(false);
    const [forwardOpen, setForwardOpen] = useState(false);
    const [reminderModalOpen, setReminderModalOpen] = useState(false);
    const [showSlaHistory, setShowSlaHistory] = useState(false);

    const isAgentOracle = user?.role === 'AGENT_ORACLE';
    const canManageParticipants = isAgentOracle || isAdmin;
    const isOracleTicket = ticket.handlingTeam === 'ORACLE_DEV' ||
        ticket.handlingTeam === 'MOBILE_DEV' ||
        ticket.handlingTeam === 'WEB_DEV' ||
        (ticket.handlingTeam == null && (ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === 'ORACLE_REQUEST' || ticket.ticketType === 'WEB_DEV_REQUEST' || ticket.ticketType === 'MOBILE_DEV_REQUEST'));
    const canAddParticipants = isOracleTicket && (canManageParticipants || ticket.user?.id === user?.id || Boolean(ticket.participants?.some(p => p.userId === user?.id)));

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
        await handleStatusChange(value);
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
    const currentSla = slaConfigs.find(s => s.priority === localPriority);
    const currentSlaHours = currentSla ? Math.round(currentSla.resolutionTimeMinutes / 60) : null;

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
        <div className="p-4 space-y-4 select-none">

            {/* 1. SLA & Tracking Card (Prominently Placed at Top) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60 shadow-2xs">
                            <Clock className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                            SLA & Tracking
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {ticket.slaAdjustments && ticket.slaAdjustments.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowSlaHistory(!showSlaHistory)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs hover:bg-amber-100 transition-colors cursor-pointer"
                                title="Lihat riwayat perpanjangan SLA"
                            >
                                <History className="w-2.5 h-2.5" />
                                <span>{ticket.slaAdjustments.length}x Diundur</span>
                                {showSlaHistory ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                            </button>
                        )}
                        {ticket.slaTarget && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                                Active SLA
                            </span>
                        )}
                    </div>
                </div>

                <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="text-slate-400 dark:text-slate-500">Created At</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatDateTimeID(ticket.createdAt)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="text-slate-400 dark:text-slate-500">Last Activity</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatRelativeTime(ticket.updatedAt)}
                        </span>
                    </div>

                    {ticket.slaTarget && (
                        <div className="flex items-center justify-between py-1">
                            <span className="text-slate-400 dark:text-slate-500">SLA Target</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-800/50 text-right">
                                {formatDateTimeID(ticket.slaTarget)}
                            </span>
                        </div>
                    )}

                    {/* Scheduled Reminder Hint Card */}
                    {nextReminder && (
                        <div
                            onClick={() => {
                                if (onSetReminder) onSetReminder();
                                else setReminderModalOpen(true);
                            }}
                            className="group p-2.5 rounded-xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/70 hover:border-purple-300 dark:hover:border-purple-600 transition-all cursor-pointer shadow-2xs space-y-1"
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
                    {!isClosed && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {onExtendSla && (isAdmin || user?.role?.startsWith('AGENT')) && (
                                    <button
                                        type="button"
                                        onClick={onExtendSla}
                                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-2xs cursor-pointer"
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
                                        "w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer",
                                        nextReminder
                                            ? "text-blue-700 dark:text-blue-300 bg-blue-100/90 dark:bg-blue-950/60 border border-blue-300/90 dark:border-blue-700/80 hover:bg-blue-200/80 dark:hover:bg-blue-900/60"
                                            : "text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                                    )}
                                    title="Atur pengingat email untuk agent"
                                >
                                    <Bell className={cn("w-3.5 h-3.5 text-blue-600 dark:text-blue-400", nextReminder && "fill-blue-600 dark:fill-blue-400")} />
                                    <span>{nextReminder ? 'Ubah Reminder' : 'Set Reminder'}</span>
                                    {nextReminder && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Expandable History Accordion */}
                    {showSlaHistory && ticket.slaAdjustments && ticket.slaAdjustments.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                <History className="w-3 h-3 text-blue-500" />
                                <span>Riwayat Penundaan Target</span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {ticket.slaAdjustments.map((adj, idx) => (
                                    <div key={adj.id || idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-1 text-[11px]">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-blue-600 dark:text-blue-400">
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
                </div>
            </div>

            {/* 2. Requester Profile Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/95 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Requester Profile
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                        User
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm shadow-xs">
                            {ticket.user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <PresenceDot userId={ticket.user.id} userName={ticket.user.fullName} ringed className="absolute -bottom-0.5 -right-0.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {ticket.user.fullName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                            <span className="truncate">{ticket.user.email}</span>
                            <button
                                type="button"
                                onClick={handleCopyEmail}
                                className="p-0.5 hover:text-blue-600 transition-colors shrink-0 cursor-pointer"
                                title="Copy Email"
                            >
                                {copiedEmail ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5" /> Department
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
                            {ticket.user.department?.name || 'No Department'}
                        </span>
                    </div>

                    {ticket.user.site?.name && (
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" /> Site / Branch
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
                                {ticket.user.site.name}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Ticket Participants (Oracle Tickets / Multi-user Group) */}
            {(isOracleTicket || (ticket.participants && ticket.participants.length > 0)) && (
                <TicketParticipantsSection
                    ticketId={ticket.id}
                    creator={ticket.user}
                    participants={ticket.participants}
                    canManageUsers={canManageParticipants}
                    canAddUsers={canAddParticipants}
                    isClosed={isClosed}
                />
            )}

            {/* 4. Ticket Properties & Assignment Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/95 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Ticket Properties
                    </span>
                    {isClosed && (
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            Ticket Closed (Locked)
                        </span>
                    )}
                </div>

                {/* Assigned Agent */}
                <PropertyRow icon={UserCheck} label="Assigned Agent" saving={saving.assignee} saved={saved.assignee}>
                    <Popover open={agentPickerOpen} onOpenChange={setAgentPickerOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                disabled={isClosed || saving.assignee}
                                className={cn(
                                    "w-full min-h-[44px] px-3 py-2 text-left rounded-xl transition-all border shadow-2xs cursor-pointer flex items-center justify-between gap-2.5",
                                    assignedAgent
                                        ? "bg-slate-50/80 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-foreground"
                                        : "bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 border-dashed border-slate-300 dark:border-slate-700 text-muted-foreground",
                                    (isClosed || saving.assignee) && "opacity-60 cursor-not-allowed"
                                )}
                            >
                                {assignedAgent ? (
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="relative shrink-0">
                                            <div className="w-7 h-7 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs shadow-2xs">
                                                {assignedAgent.fullName.charAt(0).toUpperCase()}
                                            </div>
                                            <PresenceDot userId={assignedAgent.id} size="sm" className="absolute -bottom-0.5 -right-0.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate leading-snug">
                                                {assignedAgent.fullName}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                {assignedAgent.site?.code && (
                                                    <span className="font-mono font-semibold px-1 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-600/50">
                                                        Site {assignedAgent.site.code}
                                                    </span>
                                                )}
                                                <span className="truncate opacity-75">{assignedAgent.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
                                        <UserPlus className="w-4 h-4 text-slate-400" />
                                        <span>Pilih teknisi / agent...</span>
                                    </div>
                                )}
                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="p-0 w-[300px] rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden bg-card" sideOffset={6}>
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
                    <Select value={localStatus} onValueChange={handleStatusSelectChange} disabled={isClosed || saving.status}>
                        <SelectTrigger className="w-full h-10 px-3 text-xs font-medium bg-slate-50/80 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shrink-0", currentStatusConfig.color)}>
                                    <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                                    <span>{currentStatusConfig.label}</span>
                                </span>
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
                                                opt.value === 'IN_PROGRESS' ? 'bg-blue-500' :
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
                <PropertyRow icon={AlertCircle} label="Priority" saving={saving.priority} saved={saved.priority}>
                    {ticket.priority === 'HARDWARE_INSTALLATION' ? (
                        <div className="h-10 flex items-center px-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 text-xs font-bold text-amber-700 dark:text-amber-400 rounded-xl">
                            Hardware Installation
                        </div>
                    ) : (
                        <Select value={localPriority} onValueChange={handlePriorityChange} disabled={isClosed || saving.priority}>
                            <SelectTrigger className="w-full h-10 px-3 text-xs font-medium bg-slate-50/80 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer">
                                <div className="flex items-center justify-between w-full min-w-0 pr-1">
                                    <div className="flex items-center gap-2 truncate">
                                        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", currentPriorityConfig.dot)} />
                                        <span className="font-bold text-slate-900 dark:text-white">{currentPriorityConfig.label}</span>
                                    </div>
                                    {currentSlaHours && (
                                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-md border border-slate-300/40 dark:border-slate-600/40 shrink-0">
                                            {currentSlaHours}h SLA
                                        </span>
                                    )}
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl p-1 min-w-[200px]">
                                {slaConfigs.map((sla) => {
                                    const pCfg = PRIORITY_CONFIG[sla.priority] || PRIORITY_CONFIG.MEDIUM;
                                    return (
                                        <SelectItem key={sla.id} value={sla.priority} className="text-xs rounded-lg py-2 cursor-pointer font-medium">
                                            <div className="flex items-center justify-between w-full gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("w-2 h-2 rounded-full shrink-0", pCfg.dot)} />
                                                    <span className="font-semibold">{pCfg.label}</span>
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                    {Math.round(sla.resolutionTimeMinutes / 60)}h SLA
                                                </span>
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
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/40 space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Critical Justification</span>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-red-100 dark:border-red-900/30 shadow-xs">
                            {ticket.criticalReason || 'Tidak ada catatan justifikasi tertulis dari requester.'}
                        </p>
                    </div>
                )}

                {/* Category */}
                <PropertyRow icon={Hash} label="Category" saving={saving.category} saved={saved.category}>
                    <Select value={localCategory} onValueChange={handleCategoryChange} disabled={isClosed || saving.category}>
                        <SelectTrigger className="w-full h-10 px-3 text-xs font-medium bg-slate-50/80 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer">
                            <div className="flex items-center gap-2 truncate">
                                <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className="font-semibold text-slate-900 dark:text-white truncate">{localCategory}</span>
                            </div>
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
                <PropertyRow icon={Monitor} label="Device / Hardware" saving={saving.device} saved={saved.device}>
                    <Select value={localDevice || 'none'} onValueChange={handleDeviceChange} disabled={isClosed || saving.device}>
                        <SelectTrigger className="w-full h-10 px-3 text-xs font-medium bg-slate-50/80 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer">
                            <div className="flex items-center gap-2 truncate">
                                <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className={cn("truncate font-semibold", localDevice ? "text-slate-900 dark:text-white" : "text-slate-400")}>
                                    {localDevice || 'None (Tidak Ada)'}
                                </span>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl p-1 min-w-[180px]">
                            <SelectItem value="none" className="text-xs text-slate-400 rounded-lg py-2 cursor-pointer">None (Tidak Ada)</SelectItem>
                            {attributes.devices.map((dev: any) => (
                                <SelectItem key={dev.id} value={dev.value} className="text-xs rounded-lg py-2 cursor-pointer font-medium">{dev.value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </PropertyRow>
            </div>

            {/* 4. Hardware Installation Schedule (if applicable) */}
            {ticket.isHardwareInstallation && (
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 shadow-2xs space-y-3">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                        <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            Hardware Installation
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
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Date</span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {ticket.scheduledDate ? new Date(ticket.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Time</span>
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
