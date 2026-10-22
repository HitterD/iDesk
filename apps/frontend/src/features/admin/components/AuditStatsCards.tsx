import { useQuery } from '@tanstack/react-query';
import { Activity, LogIn, AlertTriangle, TrendingUp } from 'lucide-react';
import api from '../../../lib/api';
import { AuditStats } from '../../../types/audit.types';
import { MgStat } from '@/components/management/MgmtParts';

/** More failed logins than this tints the card (production threshold). */
const FAILED_AUTH_ALERT = 5;

export function AuditStatsCards() {
    const { data: stats, isLoading } = useQuery<AuditStats>({
        queryKey: ['audit-stats'],
        queryFn: async () => {
            const response = await api.get('/audit/stats');
            return response.data;
        },
        refetchInterval: 60000, // Refresh every minute
    });

    const failed = stats?.failedAuthAttempts ?? 0;
    return (
        <section className="res-stats is-four" aria-label="Ringkasan audit">
            <MgStat icon={Activity} tone="navy" label="Total Logs" value={stats?.totalLogs ?? 0} isLoading={isLoading} />
            <MgStat icon={LogIn} tone="green" label="Logins Today" value={stats?.loginsToday ?? 0} isLoading={isLoading} />
            <MgStat icon={TrendingUp} tone="blue" label="Changes (24h)" value={stats?.changesLast24h ?? 0} isLoading={isLoading} />
            <MgStat icon={AlertTriangle} tone="red" label="Failed Auth" value={failed} isLoading={isLoading} attention={failed > FAILED_AUTH_ALERT} zero={failed === 0} />
        </section>
    );
}
