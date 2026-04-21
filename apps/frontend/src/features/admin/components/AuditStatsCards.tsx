import { useQuery } from '@tanstack/react-query';
import { Activity, LogIn, AlertTriangle, TrendingUp } from 'lucide-react';
import api from '../../../lib/api';
import { AuditStats } from '../../../types/audit.types';
import { cn } from '@/lib/utils';

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
            iconBg: 'bg-[hsl(var(--primary))]/10 text-primary',
            highlight: false,
        },
        {
            title: 'Logins Today',
            value: stats?.loginsToday ?? 0,
            icon: LogIn,
            iconBg: 'bg-[hsl(var(--success-50))] dark:bg-[hsl(var(--success-500))]/10 text-[hsl(var(--success-500))]',
            highlight: false,
        },
        {
            title: 'Changes (24h)',
            value: stats?.changesLast24h ?? 0,
            icon: TrendingUp,
            iconBg: 'bg-[hsl(var(--info-50))] dark:bg-[hsl(var(--info-500))]/10 text-[hsl(var(--info-500))]',
            highlight: false,
        },
        {
            title: 'Failed Auth',
            value: stats?.failedAuthAttempts ?? 0,
            icon: AlertTriangle,
            iconBg: 'bg-[hsl(var(--error-50))] dark:bg-[hsl(var(--error-500))]/10 text-[hsl(var(--error-500))]',
            highlight: (stats?.failedAuthAttempts ?? 0) > 5,
        },
    ];

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-[88px] rounded-xl bg-slate-100 dark:bg-[hsl(var(--card))] animate-pulse border border-[hsl(var(--border))]"
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map((card, index) => (
                <div
                    key={card.title}
                    className={cn(
                        "relative overflow-hidden rounded-xl border p-4 transition-[opacity,transform,colors] duration-200 ease-out group animate-fade-in-up",
                        card.highlight
                            ? "border-[hsl(var(--error-500))] bg-[hsl(var(--error-50))] dark:bg-[hsl(var(--error-500))]/5"
                            : "border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))]"
                    )}
                    style={{ animationDelay: `${index * 80}ms` }}
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className={cn(
                                "text-[11px] font-semibold uppercase tracking-wider mb-1.5",
                                card.highlight
                                    ? "text-[hsl(var(--error-600))] dark:text-[hsl(var(--error-400))]"
                                    : "text-slate-500 dark:text-slate-400"
                            )}>
                                {card.title}
                            </p>
                            <p className={cn(
                                "text-2xl font-extrabold tracking-tight leading-none",
                                card.highlight
                                    ? "text-[hsl(var(--error-500))]"
                                    : "text-slate-900 dark:text-white"
                            )}>
                                {card.value.toLocaleString()}
                            </p>
                        </div>
                        <div className={cn("p-2 rounded-lg", card.iconBg)}>
                            <card.icon className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Accent line — left side */}
                    <div className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-md transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group-hover:h-3/4",
                        card.highlight
                            ? "bg-[hsl(var(--error-500))]"
                            : "bg-slate-200 dark:bg-slate-700 group-hover:bg-primary"
                    )} />
                </div>
            ))}
        </div>
    );
}
