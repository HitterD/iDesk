import React from 'react';
import { UserCheck, Tag, User, Building, Calendar, Wrench } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
        <div className="p-3 space-y-3">
            {/* Requester - Compact Single Row */}
            <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xs font-bold text-slate-900 shrink-0">
                        {ticket.user.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{ticket.user.fullName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{ticket.user.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400 bg-slate-900/50 rounded px-2 py-1">
                    <Building className="w-3 h-3 text-blue-400" />
                    <span className="truncate">{ticket.user.department?.name || 'No Department'}</span>
                </div>
            </div>

            {/* Assignment */}
            <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-1.5 mb-2">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Assigned To</span>
                </div>
                <Select value={assigneeId} onValueChange={setAssigneeId} disabled={isClosed}>
                    <SelectTrigger className="w-full h-8 text-xs bg-slate-900/50 border-slate-700">
                        <SelectValue placeholder="Select Agent" />
                    </SelectTrigger>
                    <SelectContent>
                        {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id} className="text-xs">{agent.fullName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Properties - 2x2 Grid */}
            <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-1.5 mb-2">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Properties</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {/* Status */}
                    <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Status</label>
                        <Select value={status} onValueChange={setStatus} disabled={isClosed}>
                            <SelectTrigger className="w-full h-7 text-[11px] bg-slate-900/50 border-slate-700">
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
                    <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Priority</label>
                        {ticket.priority === 'HARDWARE_INSTALLATION' ? (
                            <div className="h-7 flex items-center px-2 bg-amber-900/30 border border-amber-800/50 rounded text-[10px] text-amber-400">
                                HW Install
                            </div>
                        ) : (
                            <Select value={priority} onValueChange={setPriority} disabled={isClosed}>
                                <SelectTrigger className="w-full h-7 text-[11px] bg-slate-900/50 border-slate-700">
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
                    <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Category</label>
                        <Select value={category} onValueChange={setCategory} disabled={isClosed}>
                            <SelectTrigger className="w-full h-7 text-[11px] bg-slate-900/50 border-slate-700">
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
                    <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Device</label>
                        <Select value={device} onValueChange={setDevice} disabled={isClosed}>
                            <SelectTrigger className="w-full h-7 text-[11px] bg-slate-900/50 border-slate-700">
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
            </div>

            {/* Hardware Installation Info - Only for hardware tickets */}
            {ticket.isHardwareInstallation && (
                <div className="p-2.5 bg-amber-900/20 rounded-lg border border-amber-800/50">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Installation</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <Wrench className="w-3 h-3 text-amber-500" />
                        <span className="text-amber-300">{ticket.hardwareType || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                        <div className="bg-slate-900/50 rounded px-2 py-1">
                            <span className="text-slate-500">Date: </span>
                            <span className="text-white">
                                {ticket.scheduledDate ? new Date(ticket.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                            </span>
                        </div>
                        <div className="bg-slate-900/50 rounded px-2 py-1">
                            <span className="text-slate-500">Time: </span>
                            <span className="text-white">{ticket.scheduledTime || '-'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
