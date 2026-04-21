import React from 'react';
import { UserCheck, Activity, AlertCircle, Hash, Monitor, Building, Calendar, Wrench } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TicketDetail, Agent } from './types';
import { STATUS_OPTIONS } from './constants';

interface TicketSidebarProps {
    ticket: TicketDetail;
    agents: Agent[];
    slaConfigs: { id: string; priority: string; resolutionTimeMinutes: number }[];
    attributes: { categories: { id: string; value: string }[]; devices: { id: string; value: string }[]; software: any[] };
    assigneeId: string;
    setAssigneeId: (id: string) => void;
    status: string;
    setStatus: (status: string) => void;
    priority: string;
    setPriority: (priority: string) => void;
    category: string;
    setCategory: (category: string) => void;
    device: string;
    setDevice: (device: string) => void;
}

export const TicketSidebar: React.FC<TicketSidebarProps> = ({
    ticket,
    agents,
    slaConfigs,
    attributes,
    assigneeId,
    setAssigneeId,
    status,
    setStatus,
    priority,
    setPriority,
    category,
    setCategory,
    device,
    setDevice,
}) => {
    const isClosed = ticket.status === 'CANCELLED' || ticket.status === 'RESOLVED';

    return (
        <div className="p-4 space-y-4">
            {/* Requester - Compact Single Row */}
            <div className="p-3 bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))]">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {ticket.user.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{ticket.user.fullName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{ticket.user.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-2 py-1.5">
                    <Building className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{ticket.user.department?.name || 'No Department'}</span>
                </div>
            </div>

            {/* Properties List */}
            <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] divide-y divide-slate-100 dark:divide-slate-800/60">
                {/* Assigned To */}
                <div className="group/prop p-2 flex flex-col">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                        <UserCheck className="w-3 h-3" /> Assigned To
                    </label>
                    <Select value={assigneeId} onValueChange={setAssigneeId} disabled={isClosed}>
                        <SelectTrigger className="w-full h-8 text-[11px] font-medium border-transparent bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:ring-1 focus:ring-primary/50 shadow-none px-2 rounded-xl transition-colors [&>svg]:hidden lg:group-hover/prop:[&>svg]:block">
                            <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id} className="text-xs">{agent.fullName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Status */}
                <div className="group/prop p-2 flex flex-col">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> Status
                    </label>
                    <Select value={status} onValueChange={setStatus} disabled={isClosed}>
                        <SelectTrigger className="w-full h-8 text-[11px] font-medium border-transparent bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:ring-1 focus:ring-primary/50 shadow-none px-2 rounded-xl transition-colors [&>svg]:hidden lg:group-hover/prop:[&>svg]:block">
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
                </div>

                {/* Priority */}
                <div className="group/prop p-2 flex flex-col">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" /> Priority
                    </label>
                    {ticket.priority === 'HARDWARE_INSTALLATION' ? (
                        <div className="h-8 flex items-center px-2 bg-amber-900/10 dark:bg-amber-900/30 border border-transparent text-[11px] font-medium text-amber-600 dark:text-amber-400 rounded">
                            HW Install
                        </div>
                    ) : (
                        <Select value={priority} onValueChange={setPriority} disabled={isClosed}>
                            <SelectTrigger className="w-full h-8 text-[11px] font-medium border-transparent bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:ring-1 focus:ring-primary/50 shadow-none px-2 rounded-xl transition-colors [&>svg]:hidden lg:group-hover/prop:[&>svg]:block">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {slaConfigs.map((sla) => (
                                    <SelectItem key={sla.id} value={sla.priority} className="text-xs">
                                        {sla.priority}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Category */}
                <div className="group/prop p-2 flex flex-col">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                        <Hash className="w-3 h-3" /> Category
                    </label>
                    <Select value={category} onValueChange={setCategory} disabled={isClosed}>
                        <SelectTrigger className="w-full h-8 text-[11px] font-medium border-transparent bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:ring-1 focus:ring-primary/50 shadow-none px-2 rounded-xl transition-colors [&>svg]:hidden lg:group-hover/prop:[&>svg]:block">
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
                </div>

                {/* Device */}
                <div className="group/prop p-2 flex flex-col">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                        <Monitor className="w-3 h-3" /> Device
                    </label>
                    <Select value={device} onValueChange={setDevice} disabled={isClosed}>
                        <SelectTrigger className="w-full h-8 text-[11px] font-medium border-transparent bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:ring-1 focus:ring-primary/50 shadow-none px-2 rounded-xl transition-colors [&>svg]:hidden lg:group-hover/prop:[&>svg]:block">
                            <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                            {attributes.devices.map((dev: any) => (
                                <SelectItem key={dev.id} value={dev.value} className="text-xs">{dev.value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Hardware Installation Info - Only for hardware tickets */}
            {ticket.isHardwareInstallation && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/40">
                    <div className="flex items-center gap-1.5 mb-2.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">Installation</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mb-3 font-medium">
                        <Wrench className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-800 dark:text-slate-200">{ticket.hardwareType || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl px-2 py-1.5 flex flex-col gap-0.5">
                            <span className="text-slate-400 uppercase tracking-wider text-[8px] font-bold">Date</span>
                            <span className="text-slate-800 dark:text-white font-medium">
                                {ticket.scheduledDate ? new Date(ticket.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                            </span>
                        </div>
                        <div className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl px-2 py-1.5 flex flex-col gap-0.5">
                            <span className="text-slate-400 uppercase tracking-wider text-[8px] font-bold">Time</span>
                            <span className="text-slate-800 dark:text-white font-medium">{ticket.scheduledTime || '-'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
