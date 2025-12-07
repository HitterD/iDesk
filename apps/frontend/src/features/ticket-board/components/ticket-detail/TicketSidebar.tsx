import React from 'react';
import { UserCheck, Tag, Inbox, CircleDot, Hourglass, CheckCircle2, User, Building, AlertCircle, XCircle, Ban, Calendar, Wrench } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TicketDetail, Agent } from './types';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

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
            <CollapsibleSection
                id="ticket-assignment"
                title="Assignment"
                icon={UserCheck}
                defaultOpen={true}
            >
                <div className="p-4">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Assigned To</label>
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                        <SelectTrigger className="w-full text-slate-800 dark:text-white">
                            <SelectValue placeholder="Select Agent" />
                        </SelectTrigger>
                        <SelectContent>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>{agent.fullName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CollapsibleSection>

            {/* Ticket Properties Card */}
            <CollapsibleSection
                id="ticket-properties"
                title="Properties"
                icon={Tag}
                defaultOpen={true}
            >
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Status</label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-full text-slate-800 dark:text-white">
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
                        {ticket.priority === 'HARDWARE_INSTALLATION' ? (
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                                <span className="font-medium text-amber-700 dark:text-amber-400">Hardware Installation</span>
                            </div>
                        ) : (
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger className="w-full text-slate-800 dark:text-white">
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
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Category</label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="w-full text-slate-800 dark:text-white">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="GENERAL">General</SelectItem>
                                <SelectItem value="HARDWARE">Hardware</SelectItem>
                                <SelectItem value="SOFTWARE">Software</SelectItem>
                                <SelectItem value="NETWORK">Network</SelectItem>
                                <SelectItem value="HARDWARE_INSTALLATION">Hardware Installation</SelectItem>
                                {attributes.categories.map((attr: any) => (
                                    <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Device</label>
                        <Select value={device} onValueChange={setDevice}>
                            <SelectTrigger className="w-full text-slate-800 dark:text-white">
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
            </CollapsibleSection>

            {/* Hardware Installation Info Card - Only shown for hardware installation tickets */}
            {ticket.isHardwareInstallation && (
                <CollapsibleSection
                    id="ticket-hardware-info"
                    title="Installation Schedule"
                    icon={Calendar}
                    defaultOpen={true}
                >
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center">
                                <Wrench className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Hardware Type</p>
                                <p className="font-bold text-amber-800 dark:text-amber-300">{ticket.hardwareType || 'Not specified'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Scheduled Date</p>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">
                                    {ticket.scheduledDate
                                        ? new Date(ticket.scheduledDate).toLocaleDateString('id-ID', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })
                                        : '-'}
                                </p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Time Slot</p>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">
                                    {ticket.scheduledTime ? `${ticket.scheduledTime} WIB` : '-'}
                                </p>
                            </div>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
                            <strong>Note:</strong> Installation takes 2-4 hours. Ticket will auto-resolve on H+1 if not manually resolved.
                        </div>
                    </div>
                </CollapsibleSection>
            )}

            {/* Requester Info Card */}
            <CollapsibleSection
                id="ticket-requester"
                title="Requester"
                icon={User}
                defaultOpen={true}
            >
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
            </CollapsibleSection>

            {/* Actions Card */}
            {!isClosed && (
                <div className="glass-card border-red-200/50 dark:border-red-900/50 overflow-hidden shadow-lg shadow-red-200/20 dark:shadow-red-900/20">
                    <div className="px-4 py-3 bg-red-50/50 dark:bg-red-900/20 border-b border-red-200/60 dark:border-red-900/40 backdrop-blur-sm">
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
