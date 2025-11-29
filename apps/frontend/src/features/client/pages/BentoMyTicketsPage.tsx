import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, Plus, Ticket, Search, CheckCircle, CircleDot, Hourglass, Inbox } from 'lucide-react';
import api from '@/lib/api';

interface TicketItem {
    id: string;
    ticketNumber?: string;
    title: string;
    status: string;
    priority: string;
    category?: string;
    createdAt: string;
    updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    TODO: { label: 'Open', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: Inbox },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', icon: CircleDot },
    WAITING_VENDOR: { label: 'Waiting', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', icon: Hourglass },
    RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
};

const PRIORITY_COLORS: Record<string, string> = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-yellow-500',
    LOW: 'bg-slate-400',
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

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
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">My Tickets</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Track your support requests</p>
                </div>
                <Link
                    to="/client/create"
                    className="flex items-center gap-2 bg-primary text-slate-900 px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors font-bold shadow-lg shadow-primary/20"
                >
                    <Plus className="w-5 h-5" />
                    New Ticket
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Inbox className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{openCount}</p>
                            <p className="text-xs text-slate-500">Open</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                            <CircleDot className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{inProgressCount}</p>
                            <p className="text-xs text-slate-500">In Progress</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{resolvedCount}</p>
                            <p className="text-xs text-slate-500">Resolved</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tickets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                    />
                </div>
                <div className="flex gap-2">
                    {['all', 'TODO', 'IN_PROGRESS', 'RESOLVED'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${statusFilter === status
                                    ? 'bg-primary text-slate-900'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ticket List */}
            <div className="space-y-4">
                {filteredTickets.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                        <Ticket className="w-16 h-16 text-slate-200 dark:text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No tickets found</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            {searchQuery || statusFilter !== 'all'
                                ? 'Try adjusting your search or filters'
                                : 'Create your first support ticket'}
                        </p>
                        <Link
                            to="/client/create"
                            className="inline-flex items-center gap-2 bg-primary text-slate-900 px-6 py-3 rounded-xl font-bold"
                        >
                            <Plus className="w-5 h-5" />
                            Create Ticket
                        </Link>
                    </div>
                ) : (
                    filteredTickets.map((ticket) => {
                        const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
                        const StatusIcon = statusConfig.icon;
                        return (
                            <Link
                                key={ticket.id}
                                to={`/client/tickets/${ticket.id}`}
                                className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-lg hover:border-primary/30 transition-all group"
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ticket.status === 'RESOLVED' ? 'bg-green-100 dark:bg-green-900/30' :
                                            ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 dark:bg-blue-900/30' :
                                                'bg-slate-100 dark:bg-slate-700'
                                        }`}>
                                        <StatusIcon className={`w-5 h-5 ${ticket.status === 'RESOLVED' ? 'text-green-600' :
                                                ticket.status === 'IN_PROGRESS' ? 'text-blue-600' :
                                                    'text-slate-500'
                                            }`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-mono text-xs text-slate-400">
                                                #{ticket.ticketNumber || ticket.id.split('-')[0]}
                                            </span>
                                            <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.LOW}`}></span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusConfig.color}`}>
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors truncate">
                                            {ticket.title}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                            {ticket.category && <span>{ticket.category}</span>}
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDate(ticket.updatedAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-slate-400 group-hover:text-primary transition-colors">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
};
