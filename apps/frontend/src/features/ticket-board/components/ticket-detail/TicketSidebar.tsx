import React from 'react';
import { UserCheck, Tag, Inbox, CircleDot, Hourglass, CheckCircle2, User, Building, AlertCircle, XCircle, Ban } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TicketDetail, Agent } from './types';

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
    onCancel: () => void;
    isCancelling: boolean;
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
    onCancel,
    isCancelling,
}) => {
    const isCancelled = ticket.status === 'CANCELLED';
    const isResolved = ticket.status === 'RESOLVED';
    const isClosed = isCancelled || isResolved;

    return (
        <div className="space-y-4">
            {/* Assignee Card */}
            <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/90 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 overflow-hidden shadow-lg shadow-slate-200/40 dark:shadow-slate-900/40">
                <div className="px-4 py-3 bg-gradient-to-r from-slate-100/80 to-slate-50/80 dark:from-slate-900/60 dark:to-slate-800/60 border-b border-slate-200/60 dark:border-slate-700/60">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <UserCheck className="w-3.5 h-3.5 text-primary" />
                        </div>
                        Assignment
                    </h4>
                </div>
                <div className="p-4">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Assigned To</label>
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                        <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm text-slate-800 dark:text-white">
                            <SelectValue placeholder="Select Agent" />
                        </SelectTrigger>
                        <SelectContent>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>{agent.fullName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Ticket Properties Card */}
            <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/90 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 overflow-hidden shadow-lg shadow-slate-200/40 dark:shadow-slate-900/40">
                <div className="px-4 py-3 bg-gradient-to-r from-slate-100/80 to-slate-50/80 dark:from-slate-900/60 dark:to-slate-800/60 border-b border-slate-200/60 dark:border-slate-700/60">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
                            <Tag className="w-3.5 h-3.5 text-purple-500" />
                        </div>
                        Properties
                    </h4>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Status</label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm text-slate-800 dark:text-white">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TODO">
                                    <span className="flex items-center gap-2">
                                        <Inbox className="w-3.5 h-3.5 text-slate-500" /> Open
                                    </span>
                                </SelectItem>
                                <SelectItem value="IN_PROGRESS">
                                    <span className="flex items-center gap-2">
                                        <CircleDot className="w-3.5 h-3.5 text-blue-500" /> In Progress
                                    </span>
                                </SelectItem>
                                <SelectItem value="WAITING_VENDOR">
                                    <span className="flex items-center gap-2">
                                        <Hourglass className="w-3.5 h-3.5 text-orange-500" /> Waiting Vendor
                                    </span>
                                </SelectItem>
                                <SelectItem value="RESOLVED">
                                    <span className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Resolved
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Priority</label>
                        <Select value={priority} onValueChange={setPriority}>
                            <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm text-slate-800 dark:text-white">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                {slaConfigs.map((sla) => (
                                    <SelectItem key={sla.id} value={sla.priority}>
                                        <span className="flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${sla.priority === 'CRITICAL' ? 'bg-red-500' :
                                                    sla.priority === 'HIGH' ? 'bg-orange-500' :
                                                        sla.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-slate-400'
                                                }`}></span>
                                            {sla.priority}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Category</label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm text-slate-800 dark:text-white">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="GENERAL">General</SelectItem>
                                <SelectItem value="HARDWARE">Hardware</SelectItem>
                                <SelectItem value="SOFTWARE">Software</SelectItem>
                                <SelectItem value="NETWORK">Network</SelectItem>
                                {attributes.categories.map((attr: any) => (
                                    <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Device</label>
                        <Select value={device} onValueChange={setDevice}>
                            <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm text-slate-800 dark:text-white">
                                <SelectValue placeholder="Select Device" />
                            </SelectTrigger>
                            <SelectContent>
                                {attributes.devices.map((dev: any) => (
                                    <SelectItem key={dev.id} value={dev.value}>{dev.value}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Requester Info Card */}
            <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/90 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 overflow-hidden shadow-lg shadow-slate-200/40 dark:shadow-slate-900/40">
                <div className="px-4 py-3 bg-gradient-to-r from-slate-100/80 to-slate-50/80 dark:from-slate-900/60 dark:to-slate-800/60 border-b border-slate-200/60 dark:border-slate-700/60">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        Requester
                    </h4>
                </div>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-sm font-bold text-slate-900 shadow-md">
                            {ticket.user.fullName.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white">{ticket.user.fullName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{ticket.user.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-200/50 dark:border-slate-700/50">
                        <Building className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">{ticket.user.department?.name || 'No Department'}</span>
                    </div>
                </div>
            </div>

            {/* Actions Card */}
            {!isClosed && (
                <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/10 dark:to-slate-800 rounded-2xl border border-red-200/70 dark:border-red-900/50 overflow-hidden shadow-lg shadow-red-200/20 dark:shadow-red-900/20">
                    <div className="px-4 py-3 bg-gradient-to-r from-red-100/80 to-red-50/80 dark:from-red-900/30 dark:to-red-900/20 border-b border-red-200/60 dark:border-red-900/40">
                        <h4 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500/20 to-red-500/10 flex items-center justify-center">
                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            </div>
                            Danger Zone
                        </h4>
                    </div>
                    <div className="p-4">
                        <button
                            onClick={onCancel}
                            disabled={isCancelling}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <XCircle className="w-5 h-5" />
                            {isCancelling ? 'Cancelling...' : 'Cancel Ticket'}
                        </button>
                    </div>
                </div>
            )}

            {isCancelled && (
                <div className="bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-900/20 rounded-2xl border border-red-300 dark:border-red-800 p-5 shadow-lg shadow-red-200/30 dark:shadow-red-900/20">
                    <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                            <Ban className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="font-bold text-lg">Ticket Cancelled</span>
                            <p className="text-sm text-red-600/70 dark:text-red-400/70">This ticket has been cancelled</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
