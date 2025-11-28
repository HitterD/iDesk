import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Users, Ticket, CheckCircle } from 'lucide-react';
import api from '../../../lib/api';
import { useTicketListSocket } from '../../../hooks/useTicketSocket';

const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-navy-light p-6 rounded-xl border border-white/5">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-slate-400 text-sm font-medium">{title}</p>
                <h3 className="text-2xl font-bold text-white mt-2">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg bg-${color}/10`}>
                <Icon className={`w-6 h-6 text-${color}`} />
            </div>
        </div>
    </div>
);

export const DashboardPage: React.FC = () => {
    // Listen for real-time updates
    useTicketListSocket();

    const { data: stats } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const res = await api.get('/tickets/dashboard/stats');
            return res.data;
        },
    });

    const { data: csatStats } = useQuery({
        queryKey: ['csat-stats'],
        queryFn: async () => {
            const res = await api.get('/surveys/stats');
            return res.data;
        },
    });

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Tickets"
                    value={stats?.totalTickets || 0}
                    icon={Ticket}
                    color="blue-500"
                />
                <StatCard
                    title="Active Agents"
                    value={stats?.activeAgents || 0}
                    icon={Users}
                    color="purple-500"
                />
                <StatCard
                    title="Resolved Today"
                    value={stats?.resolvedToday || 0}
                    icon={CheckCircle}
                    color="green-500"
                />
                <StatCard
                    title="Avg. CSAT Score"
                    value={csatStats?.averageRating ? csatStats.averageRating.toFixed(1) : 'N/A'}
                    icon={Star}
                    color="yellow-400"
                />
            </div>
        </div>
    );
};
