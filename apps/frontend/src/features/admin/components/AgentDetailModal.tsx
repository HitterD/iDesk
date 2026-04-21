import React, { useState } from 'react';
import { X, User, Users, Mail, Building, Shield, Ticket, CheckCircle, Clock, TrendingUp, AlertTriangle, Calendar, MessageSquare, ArrowUpRight, Activity, Phone, Briefcase, MapPin, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Site {
    id: string;
    code: string;
    name: string;
}

interface AgentDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    agent: {
        id: string;
        fullName: string;
        email: string;
        role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT';
        department?: { name: string };
        site?: Site;
        avatarUrl?: string;
        isActive?: boolean;
        employeeId?: string;
        jobTitle?: string;
        phoneNumber?: string;
        openTickets?: number;
        inProgressTickets?: number;
        resolvedThisWeek?: number;
        resolvedThisMonth?: number;
        slaCompliance?: number;
        createdAt?: string;
        lastActiveAt?: string;
    } | null;
}

interface RecentTicket {
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
}

interface ActivityItem {
    id: string;
    type: 'ticket_resolved' | 'ticket_assigned' | 'comment_added' | 'status_changed';
    description: string;
    timestamp: string;
}

const SITE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SMG: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const ROLE_CONFIG = {
    ADMIN: { icon: Shield, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    MANAGER: { icon: Crown, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    AGENT: { icon: User, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    AGENT_ADMIN: { icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    AGENT_ORACLE: { icon: User, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    AGENT_OPERATIONAL_SUPPORT: { icon: Users, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30' },
    USER: { icon: User, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
};

// Format relative time
const formatRelativeTime = (date: string | undefined) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
};

// Get avatar color based on name
const getAvatarColor = (name: string): string => {
    const colors = [
        'from-blue-500 to-cyan-500',
        'from-green-500 to-emerald-500',
        'from-purple-500 to-pink-500',
        'from-amber-500 to-orange-500',
        'from-rose-500 to-red-500',
        'from-indigo-500 to-violet-500',
        'from-teal-500 to-cyan-500',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

export const AgentDetailModal: React.FC<AgentDetailModalProps> = ({ isOpen, onClose, agent }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'tickets'>('overview');

    // Fetch recent tickets for this agent
    const { data: recentTickets = [] } = useQuery<RecentTicket[]>({
        queryKey: ['agent-recent-tickets', agent?.id],
        queryFn: async () => {
            if (!agent?.id) return [];
            try {
                const res = await api.get(`/tickets?assignedToId=${agent.id}&limit=5&sortBy=createdAt&sortOrder=DESC`);
                return (res.data.data || []).slice(0, 5).map((t: any) => ({
                    id: t.id,
                    ticketNumber: t.ticketNumber,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                    createdAt: t.createdAt
                }));
            } catch {
                return [];
            }
        },
        enabled: isOpen && !!agent?.id,
        staleTime: 30000
    });

    // Fetch real activity from audit logs API
    const { data: activityData = [] } = useQuery<ActivityItem[]>({
        queryKey: ['agent-activity', agent?.id],
        queryFn: async () => {
            if (!agent?.id) return [];
            try {
                const res = await api.get(`/audit-logs?userId=${agent.id}&limit=10`);
                const logs = res.data.data || res.data || [];
                return logs.slice(0, 5).map((log: any) => {
                    // Map audit log action to activity type
                    let type: ActivityItem['type'] = 'status_changed';
                    const action = (log.action || '').toLowerCase();
                    if (action.includes('resolv')) type = 'ticket_resolved';
                    else if (action.includes('assign')) type = 'ticket_assigned';
                    else if (action.includes('comment')) type = 'comment_added';

                    return {
                        id: log.id,
                        type,
                        description: log.description || `${log.action} on ${log.entityType || 'item'}`,
                        timestamp: log.createdAt || log.timestamp
                    };
                });
            } catch {
                return [];
            }
        },
        enabled: isOpen && !!agent?.id && activeTab === 'activity',
        staleTime: 30000
    });

    // Early return AFTER all hooks (React requires consistent hook order)
    if (!isOpen || !agent) return null;

    const roleConfig = ROLE_CONFIG[agent.role] || ROLE_CONFIG.USER;
    const RoleIcon = roleConfig.icon;

    const statCards = [
        { label: 'Open', value: agent.openTickets || 0, icon: Ticket, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
        { label: 'In Progress', value: agent.inProgressTickets || 0, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        { label: 'Resolved (Week)', value: agent.resolvedThisWeek || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
        { label: 'Resolved (Month)', value: agent.resolvedThisMonth || 0, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    ];

    const sla = agent.slaCompliance || 100;
    const slaColor = sla >= 90 ? 'text-green-600' : sla >= 70 ? 'text-yellow-600' : 'text-red-600';
    const slaBg = sla >= 90 ? 'bg-green-100 dark:bg-green-900/30' : sla >= 70 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30';

    const getActivityIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'ticket_resolved': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'ticket_assigned': return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
            case 'comment_added': return <MessageSquare className="w-4 h-4 text-purple-500" />;
            case 'status_changed': return <Activity className="w-4 h-4 text-amber-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OPEN': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
            case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'RESOLVED': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'CLOSED': return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'CRITICAL': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'HIGH': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'MEDIUM': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'LOW': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                {/* Header with Avatar */}
                <div className="relative bg-gradient-to-br from-primary/20 via-secondary/10 to-primary/5 p-6 pb-16 shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>

                    {/* Last active indicator */}
                    <div className="absolute top-4 left-4 flex items-center gap-2 text-xs text-slate-500 bg-white/50 dark:bg-slate-800/50 px-2 py-1 rounded-lg backdrop-blur-sm">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            agent.lastActiveAt && new Date(agent.lastActiveAt).getTime() > Date.now() - 300000
                                ? "bg-green-500 animate-pulse"
                                : "bg-slate-400"
                        )} />
                        {formatRelativeTime(agent.lastActiveAt)}
                    </div>
                </div>

                {/* Avatar */}
                <div className="flex justify-center -mt-12 relative z-10 shrink-0">
                    <div className={cn(
                        "w-24 h-24 rounded-2xl bg-gradient-to-br shadow-lg flex items-center justify-center border-4 border-white dark:border-slate-900",
                        getAvatarColor(agent.fullName)
                    )}>
                        {agent.avatarUrl ? (
                            <img src={agent.avatarUrl} alt={agent.fullName} className="w-full h-full rounded-xl object-cover" />
                        ) : (
                            <span className="text-3xl font-bold text-white">{agent.fullName.charAt(0)}</span>
                        )}
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 pb-6 pt-4 text-center">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{agent.fullName}</h2>
                        <p className="text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 mt-1">
                            <Mail className="w-4 h-4" />
                            {agent.email}
                        </p>

                        {/* Agent Info Row */}
                        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                            {agent.site && (
                                <span className={cn("px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1", SITE_COLORS[agent.site.code])}>
                                    <MapPin className="w-3 h-3" />
                                    {agent.site.code}
                                </span>
                            )}
                            <span className={cn("px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1", roleConfig.bg, roleConfig.color)}>
                                <RoleIcon className="w-3 h-3" />
                                {agent.role}
                            </span>
                            {agent.jobTitle && (
                                <span className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" />
                                    {agent.jobTitle}
                                </span>
                            )}
                            <span className={cn(
                                "px-2 py-1 rounded-lg text-xs font-bold",
                                agent.isActive !== false
                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            )}>
                                {agent.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        {/* Contact Info */}
                        {(agent.phoneNumber || agent.employeeId) && (
                            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-500">
                                {agent.phoneNumber && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="w-3.5 h-3.5" />
                                        {agent.phoneNumber}
                                    </span>
                                )}
                                {agent.employeeId && (
                                    <span>ID: {agent.employeeId}</span>
                                )}
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex items-center justify-center gap-1 mt-6 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            {(['overview', 'activity', 'tickets'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 capitalize",
                                        activeTab === tab
                                            ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white"
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="mt-4">
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    {/* Performance Stats */}
                                    <div className="grid grid-cols-2 gap-3">
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
                                    <div className={cn("p-4 rounded-xl", slaBg)}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {sla < 70 && <AlertTriangle className={cn("w-5 h-5", slaColor)} />}
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SLA Compliance</span>
                                            </div>
                                            <span className={cn("text-2xl font-bold", slaColor)}>{sla}%</span>
                                        </div>
                                        <div className="mt-2 h-2 bg-white/50 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-[opacity,transform,colors] duration-200 ease-out", sla >= 90 ? 'bg-green-500' : sla >= 70 ? 'bg-yellow-500' : 'bg-red-500')}
                                                style={{ width: `${sla}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Activity Tab */}
                            {activeTab === 'activity' && (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    {activityData.length === 0 ? (
                                        <div className="py-8 text-center text-slate-400">
                                            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p>No recent activity</p>
                                        </div>
                                    ) : (
                                        activityData.map((item) => (
                                            <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-left">
                                                <div className="p-1.5 bg-white dark:bg-slate-700 rounded-lg">
                                                    {getActivityIcon(item.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-slate-700 dark:text-slate-300">{item.description}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(item.timestamp)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Tickets Tab */}
                            {activeTab === 'tickets' && (
                                <div className="space-y-2 animate-in fade-in duration-200">
                                    {recentTickets.length === 0 ? (
                                        <div className="py-8 text-center text-slate-400">
                                            <Ticket className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p>No recent tickets</p>
                                        </div>
                                    ) : (
                                        recentTickets.map((ticket) => (
                                            <div key={ticket.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-slate-400">{ticket.ticketNumber}</span>
                                                        <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold", getPriorityColor(ticket.priority))}>
                                                            {ticket.priority}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate mt-0.5">{ticket.title}</p>
                                                </div>
                                                <span className={cn("px-2 py-1 rounded text-xs font-bold shrink-0", getStatusColor(ticket.status))}>
                                                    {ticket.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
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
        </div>
    );
};
