import React from 'react';
import { X, User, Mail, Building, Shield, Ticket, CheckCircle, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    agent: {
        id: string;
        fullName: string;
        email: string;
        role: 'ADMIN' | 'AGENT' | 'USER';
        department?: { name: string };
        avatarUrl?: string;
        isActive?: boolean;
        openTickets?: number;
        inProgressTickets?: number;
        resolvedThisWeek?: number;
        resolvedThisMonth?: number;
        slaCompliance?: number;
    } | null;
}

export const AgentDetailModal: React.FC<AgentDetailModalProps> = ({ isOpen, onClose, agent }) => {
    if (!isOpen || !agent) return null;

    const statCards = [
        { label: 'Open', value: agent.openTickets || 0, icon: Ticket, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
        { label: 'In Progress', value: agent.inProgressTickets || 0, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        { label: 'Resolved (Week)', value: agent.resolvedThisWeek || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
        { label: 'Resolved (Month)', value: agent.resolvedThisMonth || 0, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    ];

    const sla = agent.slaCompliance || 100;
    const slaColor = sla >= 90 ? 'text-green-600' : sla >= 70 ? 'text-yellow-600' : 'text-red-600';
    const slaBg = sla >= 90 ? 'bg-green-100 dark:bg-green-900/30' : sla >= 70 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header with Avatar */}
                <div className="relative bg-gradient-to-br from-primary/20 to-secondary/20 p-6 pb-16">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                </div>

                {/* Avatar */}
                <div className="flex justify-center -mt-12 relative z-10">
                    <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center border-4 border-white dark:border-slate-900">
                        {agent.avatarUrl ? (
                            <img src={agent.avatarUrl} alt={agent.fullName} className="w-full h-full rounded-xl object-cover" />
                        ) : (
                            <span className="text-3xl font-bold text-primary">{agent.fullName.charAt(0)}</span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 pb-6 pt-4 text-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{agent.fullName}</h2>
                    <p className="text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 mt-1">
                        <Mail className="w-4 h-4" />
                        {agent.email}
                    </p>

                    {/* Role & Status */}
                    <div className="flex items-center justify-center gap-3 mt-4">
                        <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1",
                            agent.role === 'ADMIN' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                                agent.role === 'AGENT' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        )}>
                            <Shield className="w-3 h-3" />
                            {agent.role}
                        </span>
                        {agent.department && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {agent.department.name}
                            </span>
                        )}
                        <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold",
                            agent.isActive !== false
                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        )}>
                            {agent.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    </div>

                    {/* Performance Stats */}
                    <div className="grid grid-cols-2 gap-3 mt-6">
                        {statCards.map((stat) => (
                            <div key={stat.label} className={cn("p-3 rounded-xl", stat.bg)}>
                                <div className="flex items-center gap-2 mb-1">
                                    <stat.icon className={cn("w-4 h-4", stat.color)} />
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</span>
                                </div>
                                <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* SLA Compliance */}
                    <div className={cn("mt-4 p-4 rounded-xl", slaBg)}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {sla < 70 && <AlertTriangle className={cn("w-5 h-5", slaColor)} />}
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SLA Compliance</span>
                            </div>
                            <span className={cn("text-2xl font-bold", slaColor)}>{sla}%</span>
                        </div>
                        <div className="mt-2 h-2 bg-white/50 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full rounded-full transition-all", sla >= 90 ? 'bg-green-500' : sla >= 70 ? 'bg-yellow-500' : 'bg-red-500')}
                                style={{ width: `${sla}%` }}
                            />
                        </div>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="mt-6 w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
