import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { TicketDetail, Agent } from './types';
import { STATUS_OPTIONS, STATUS_CONFIG, PRIORITY_CONFIG } from './constants';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';

interface TicketSidebarProps {
    ticket: TicketDetail;
    agents: Agent[];
    slaConfigs: { id: string; priority: string; resolutionTimeMinutes: number }[];
    attributes: { categories: { id: string; value: string }[]; devices: { id: string; value: string }[]; software: any[] };
    onAssigneeChange: (value: string) => Promise<void>;
    onStatusChange: (value: string) => Promise<void>;
    onPriorityChange: (value: string) => Promise<void>;
    onCategoryChange: (value: string) => Promise<void>;
    onDeviceChange: (value: string) => Promise<void>;
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
}) => {
    const isClosed = ticket.status === 'CANCELLED' || ticket.status === 'RESOLVED';
    const [copiedEmail, setCopiedEmail] = useState(false);

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

    const handleAssigneeChange = async (value: string) => {
        const actualVal = value === 'unassigned' ? '' : value;
        setLocalAssigneeId(actualVal);
        setSaving(prev => ({ ...prev, assignee: true }));
        try {
            await onAssigneeChange(actualVal);
            showSaved('assignee');
        } finally {
            setSaving(prev => ({ ...prev, assignee: false }));
        }
    };

    const handleStatusChange = makeHandler('status', setLocalStatus, onStatusChange);
    const handlePriorityChange = makeHandler('priority', setLocalPriority, onPriorityChange);
    const handleCategoryChange = makeHandler('category', setLocalCategory, onCategoryChange);

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

    const assignedAgent = agents.find(a => a.id === localAssigneeId) || ticket.assignedTo;

    return (
        <div className="p-4 space-y-5">

            {/* 1. Requester Profile Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
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

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
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

            {/* 2. Ticket Properties & Assignment Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
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
                    <Select value={localAssigneeId || 'unassigned'} onValueChange={handleAssigneeChange} disabled={isClosed || saving.assignee}>
                        <SelectTrigger className="w-full h-9 text-xs font-medium bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 rounded-xl">
                            <SelectValue placeholder="Unassigned">
                                {assignedAgent ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                                            {assignedAgent.fullName.charAt(0)}
                                        </div>
                                        <span className="truncate">{assignedAgent.fullName}</span>
                                        {/* Decorative: this sits inside the select trigger, whose accessible
                                            name must stay the agent, not a status. Hover reveals the title. */}
                                        <PresenceDot userId={assignedAgent.id} size="sm" decorative />
                                    </div>
                                ) : (
                                    <span className="text-slate-400">Unassigned</span>
                                )}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unassigned" className="text-xs text-slate-400">Unassigned</SelectItem>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id} className="text-xs">
                                    {agent.fullName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </PropertyRow>

                {/* Status */}
                <PropertyRow icon={Activity} label="Status" saving={saving.status} saved={saved.status}>
                    <Select value={localStatus} onValueChange={handleStatusChange} disabled={isClosed || saving.status}>
                        <SelectTrigger className="w-full h-9 text-xs font-medium bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </PropertyRow>

                {/* Priority */}
                <PropertyRow icon={AlertCircle} label="Priority" saving={saving.priority} saved={saved.priority}>
                    {ticket.priority === 'HARDWARE_INSTALLATION' ? (
                        <div className="h-9 flex items-center px-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 text-xs font-bold text-amber-700 dark:text-amber-400 rounded-xl">
                            Hardware Installation
                        </div>
                    ) : (
                        <Select value={localPriority} onValueChange={handlePriorityChange} disabled={isClosed || saving.priority}>
                            <SelectTrigger className="w-full h-9 text-xs font-medium bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {slaConfigs.map((sla) => (
                                    <SelectItem key={sla.id} value={sla.priority} className="text-xs">
                                        {sla.priority} ({Math.round(sla.resolutionTimeMinutes / 60)}h SLA)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </PropertyRow>

                {/* Category */}
                <PropertyRow icon={Hash} label="Category" saving={saving.category} saved={saved.category}>
                    <Select value={localCategory} onValueChange={handleCategoryChange} disabled={isClosed || saving.category}>
                        <SelectTrigger className="w-full h-9 text-xs font-medium bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="GENERAL" className="text-xs">General</SelectItem>
                            <SelectItem value="HARDWARE" className="text-xs">Hardware</SelectItem>
                            <SelectItem value="SOFTWARE" className="text-xs">Software</SelectItem>
                            <SelectItem value="NETWORK" className="text-xs">Network</SelectItem>
                            {attributes.categories.map((attr: any) => (
                                <SelectItem key={attr.id} value={attr.value} className="text-xs">{attr.value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </PropertyRow>

                {/* Device */}
                <PropertyRow icon={Monitor} label="Device / Hardware" saving={saving.device} saved={saved.device}>
                    <Select value={localDevice || 'none'} onValueChange={handleDeviceChange} disabled={isClosed || saving.device}>
                        <SelectTrigger className="w-full h-9 text-xs font-medium bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 rounded-xl">
                            <SelectValue placeholder="No device assigned" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none" className="text-xs text-slate-400">None</SelectItem>
                            {attributes.devices.map((dev: any) => (
                                <SelectItem key={dev.id} value={dev.value} className="text-xs">{dev.value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </PropertyRow>
            </div>

            {/* 3. SLA & Timeline Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        SLA & Tracking
                    </span>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                </div>

                <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="text-slate-400">Created At</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatDateTimeID(ticket.createdAt)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="text-slate-400">Last Activity</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatRelativeTime(ticket.updatedAt)}
                        </span>
                    </div>

                    {ticket.slaTarget && (
                        <div className="flex items-center justify-between py-1">
                            <span className="text-slate-400">SLA Resolution Target</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {formatDateTimeID(ticket.slaTarget)}
                            </span>
                        </div>
                    )}
                </div>
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
        </div>
    );
};
