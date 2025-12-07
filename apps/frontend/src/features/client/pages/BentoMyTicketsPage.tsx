import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, Plus, Search, CheckCircle2, CircleDot, Inbox, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';

// Using a comprehensive interface matching standard API response
interface TicketItem {
    id: string;
    ticketNumber?: string;
    title: string;
    status: string;
    priority: string;
    category?: string;
    createdAt: string;
    updatedAt: string;
    assignedTo?: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    };
}

export const BentoMyTicketsPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const { data: tickets = [], isLoading } = useQuery<TicketItem[]>({
        queryKey: ['my-tickets'],
        queryFn: async () => {
            const res = await api.get('/tickets');
            return res.data;
        },
    });

    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.ticketNumber?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const openCount = tickets.filter(t => t.status === 'TODO').length;
    const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
    const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                        <Inbox className="w-6 h-6 text-slate-900" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">My Tickets</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Track your support requests</p>
                    </div>
                </div>
                <Link
                    to="/client/create"
                    className="flex items-center gap-2 bg-primary text-slate-900 px-6 py-3 rounded-xl hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                >
                    <Plus className="w-5 h-5" />
                    New Ticket
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="glass-card hover:glass-hover-lift rounded-2xl p-4 transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Inbox className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{openCount}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Open</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card hover:glass-hover-lift rounded-2xl p-4 transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                            <CircleDot className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{inProgressCount}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">In Progress</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card hover:glass-hover-lift rounded-2xl p-4 transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{resolvedCount}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Resolved</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart List Container */}
            <div className="glass-card overflow-hidden rounded-2xl">
                {/* Search & Filter Bar */}
                <div className="p-4 border-b border-white/20 dark:border-white/10 flex flex-col md:flex-row gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by title or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-sm text-slate-800 dark:text-white transition-all focus:bg-white dark:focus:bg-slate-800"
                        />
                    </div>
                    <div className="flex gap-2 font-medium">
                        {['all', 'TODO', 'IN_PROGRESS', 'RESOLVED'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === status
                                    ? 'bg-primary text-slate-900 shadow-lg shadow-primary/20 scale-105'
                                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-white/40 dark:border-white/10 hover:bg-white dark:hover:bg-slate-700 hover:scale-105'
                                    }`}
                            >
                                {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List Header (Desktop) */}
                <div className="hidden md:flex items-center px-6 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-b border-white/20 dark:border-white/10 text-xs font-bold text-slate-500 uppercase tracking-wider backdrop-blur-sm">
                    <div className="w-48">Status / ID</div>
                    <div className="flex-1">Details</div>
                    <div className="w-32">Priority</div>
                    <div className="w-40">Assignee</div>
                    <div className="w-32">Updated</div>
                    <div className="w-24 text-right">Action</div>
                </div>

                {/* List Items */}
                <div className="divide-y divide-white/20 dark:divide-white/10">
                    {filteredTickets.length === 0 ? (
                        <div className="p-16 text-center bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm">
                            <div className="w-20 h-20 bg-white/50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-lg shadow-slate-200/50 dark:shadow-none">
                                <Inbox className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No tickets found</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
                                {searchQuery || statusFilter !== 'all'
                                    ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                                    : 'Create your first support ticket to get started with our team.'}
                            </p>
                            <Link
                                to="/client/create"
                                className="inline-flex items-center gap-2 bg-primary text-slate-900 px-8 py-3.5 rounded-xl font-bold hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                Create Ticket
                            </Link>
                        </div>
                    ) : (
                        filteredTickets.map((ticket, index) => {
                            const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
                            const StatusIcon = statusConfig.icon;
                            const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;

                            // Safe date handling
                            let timeDisplay = '';
                            try {
                                const date = new Date(ticket.updatedAt);
                                const now = new Date();
                                const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

                                if (diffInHours < 24) {
                                    timeDisplay = `${diffInHours}h ago`;
                                    if (diffInHours === 0) timeDisplay = 'Just now';
                                } else {
                                    timeDisplay = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                }
                            } catch (e) {
                                timeDisplay = '-';
                            }

                            return (
                                <Link
                                    key={ticket.id}
                                    to={`/client/tickets/${ticket.id}`}
                                    className="flex flex-col md:flex-row md:items-center px-6 py-4 hover:bg-white/60 dark:hover:bg-slate-700/40 transition-all duration-200 group gap-4 md:gap-0 animate-fade-in-up"
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                >
                                    {/* Column 1: Status & ID */}
                                    <div className="md:w-48 flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${statusConfig.bgColor}`}>
                                            <StatusIcon className={`w-5 h-5 ${statusConfig.textColor}`} />
                                        </div>
                                        <div>
                                            <div className="font-mono text-xs text-slate-500 font-medium">
                                                #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                            </div>
                                            <div className={`text-[10px] font-bold uppercase tracking-wider ${statusConfig.textColor}`}>
                                                {statusConfig.label}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Main Details */}
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-bold text-slate-800 dark:text-white truncate group-hover:text-primary transition-colors text-sm md:text-base">
                                            {ticket.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            {ticket.category && (
                                                <span className="text-xs text-slate-500 bg-slate-100/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700/50">
                                                    {ticket.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Column 3: Priority */}
                                    <div className="md:w-32 flex items-center">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm",
                                            priorityConfig.badgeColor
                                        )}>
                                            <span className={cn("w-2 h-2 rounded-full", priorityConfig.dot)} />
                                            {priorityConfig.label}
                                        </span>
                                    </div>

                                    {/* Column 4: Assignee */}
                                    <div className="md:w-40 flex items-center">
                                        {ticket.assignedTo ? (
                                            <div className="flex items-center gap-2">
                                                <UserAvatar user={ticket.assignedTo} size="xs" />
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                                                    {ticket.assignedTo.fullName.split(' ')[0]}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic pl-1">Unassigned</span>
                                        )}
                                    </div>

                                    {/* Column 5: Time */}
                                    <div className="md:w-32 flex items-center text-xs text-slate-500">
                                        <Clock className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                        {timeDisplay}
                                    </div>

                                    {/* Column 6: Action */}
                                    <div className="md:w-24 flex items-center justify-end gap-1 text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                                        <span className="text-xs font-bold">Detail</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                    {/* Mobile chevron fallback (always visible) */}
                                    <div className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
