import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, LogIn, AlertTriangle, TrendingUp } from 'lucide-react';
import api from '../../../lib/api';
import { AuditStats } from '../../../types/audit.types';

export function AuditStatsCards() {
    const { data: stats, isLoading } = useQuery<AuditStats>({
        queryKey: ['audit-stats'],
        queryFn: async () => {
            const response = await api.get('/audit/stats');
            return response.data;
        },
        refetchInterval: 60000, // Refresh every minute
    });

    const cards = [
        {
            title: 'Total Logs',
            value: stats?.totalLogs ?? 0,
            icon: Activity,
            color: 'from-violet-500/20 to-purple-500/20',
            iconColor: 'text-violet-400',
            borderColor: 'border-violet-500/30',
        },
        {
            title: 'Logins Today',
            value: stats?.loginsToday ?? 0,
            icon: LogIn,
            color: 'from-green-500/20 to-emerald-500/20',
            iconColor: 'text-green-400',
            borderColor: 'border-green-500/30',
        },
        {
            title: 'Changes (24h)',
            value: stats?.changesLast24h ?? 0,
            icon: TrendingUp,
            color: 'from-blue-500/20 to-cyan-500/20',
            iconColor: 'text-blue-400',
            borderColor: 'border-blue-500/30',
        },
        {
            title: 'Failed Auth',
            value: stats?.failedAuthAttempts ?? 0,
            icon: AlertTriangle,
            color: 'from-red-500/20 to-orange-500/20',
            iconColor: 'text-red-400',
            borderColor: 'border-red-500/30',
            highlight: (stats?.failedAuthAttempts ?? 0) > 5,
        },
    ];

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-24 rounded-xl bg-white/5 animate-pulse"
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {cards.map((card, index) => (
                <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`
                        relative overflow-hidden rounded-xl border
                        bg-gradient-to-br ${card.color} ${card.borderColor}
                        p-4 backdrop-blur-sm
                        ${card.highlight ? 'ring-2 ring-red-500/50' : ''}
                    `}
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium text-white/60 mb-1">
                                {card.title}
                            </p>
                            <p className="text-2xl font-bold text-white">
                                {card.value.toLocaleString()}
                            </p>
                        </div>
                        <div className={`p-2 rounded-lg bg-white/10 ${card.iconColor}`}>
                            <card.icon className="w-5 h-5" />
                        </div>
                    </div>

                    {/* Decorative gradient */}
                    <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full bg-white/5 blur-xl" />
                </motion.div>
            ))}
        </div>
    );
}
