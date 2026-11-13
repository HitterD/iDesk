import React, { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, RefreshCw, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuth';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { getRoleHome, isAgentRole } from '@/lib/roleHome';
import { SERVICE_SCOPE_LABELS } from '@/lib/constants/service-scope';
import { getRoleLabel } from '@/features/admin/components/agent-management/agent-types';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { MyRatingCard } from '../components/MyRatingCard';
import { CsiPendingCard } from '@/features/csi/components/CsiPendingCard';
import { DashSeg } from '../components/DashboardParts';
import { useAgentDashboard } from './useAgentDashboard';
import { firstName, formatWibStamp, wibGreeting } from './agentDashboard.format';
import {
    AGENT_DASHBOARD_PERIODS,
    DEFAULT_AGENT_DASHBOARD_PERIOD,
    type AgentDashboardData,
    type AgentDashboardPeriod,
} from './agentDashboard.types';
import { AttentionList, DevBreakdownCard, PerformanceCard, SummaryTiles, SupportCard } from './AgentDashboardWidgets';
import { AgentTrendChart } from './AgentTrendChart';

const MY_TICKETS_HREF = '/tickets/list?filter=assigned_to_me';
const PERIOD_OPTIONS = AGENT_DASHBOARD_PERIODS.map((p) => ({ value: String(p) as `${AgentDashboardPeriod}`, label: `${p} hari` }));

/** One-sentence status the agent can act on. */
function summarySentence({ stats }: AgentDashboardData): string {
    if (stats.active === 0) return 'Tidak ada tiket aktif. Semua beres!';
    const overdue = stats.overdue > 0 ? `, ${stats.overdue} di antaranya lewat SLA` : ', semuanya masih tepat waktu';
    return `Ada ${stats.active} tiket aktif${overdue}.`;
}

function agentMeta(agent: AgentDashboardData['agent']): string {
    return [
        getRoleLabel(agent.role),
        agent.scope && `Lingkup ${SERVICE_SCOPE_LABELS[agent.scope]}`,
        agent.site?.code,
    ].filter(Boolean).join(' · ');
}

/**
 * Personal agent dashboard (mockup dashboard-me.html). `/dashboard/me` shows the signed-in agent;
 * `/dashboard/agent/:id` lets ADMIN/MANAGER open a specific agent (the backend enforces scope).
 * Non-agents have no personal dashboard (the API rejects them), so `/dashboard/me` sends them home.
 */
export const AgentDashboardPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    if (!id && user && !isAgentRole(user.role)) return <Navigate to={getRoleHome(user.role)} replace />;
    return <AgentDashboardView />;
};

const AgentDashboardView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [days, setDays] = useState<AgentDashboardPeriod>(DEFAULT_AGENT_DASHBOARD_PERIOD);
    const [reloading, setReloading] = useState(false);
    const { data, isLoading, isError, refetch } = useAgentDashboard(id, days);

    // Invalidates 'dashboard-stats' (our query key prefix) on ticket socket events.
    useTicketListSocket();

    if (isLoading) return <DashboardSkeleton variant="agent" />;
    if (isError || !data?.agent) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <ServerCrash className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Gagal memuat dashboard agent.</p>
                <Button variant="primary" onClick={() => refetch()}>Coba lagi</Button>
            </div>
        );
    }

    const isSelf = !id || data.agent.id === user?.id;
    const { agent, stats } = data;
    const reload = () => {
        setReloading(true);
        refetch().finally(() => setReloading(false));
    };

    return (
        <div className="dash" role="region" aria-label={isSelf ? 'Dashboard Saya' : `Dashboard ${agent.fullName}`}>
            <header className="dash-head">
                <div className="min-w-0">
                    {!isSelf && (
                        <button type="button" onClick={() => navigate(-1)} className="dash-back"><ChevronLeft aria-hidden="true" />Kembali</button>
                    )}
                    <h1>{isSelf ? `${wibGreeting()}, ${firstName(agent.fullName)}` : agent.fullName}</h1>
                    <p>{summarySentence(data)}</p>
                    <p className="dash-meta">{agentMeta(agent)} · diperbarui {formatWibStamp(data.generatedAt)} WIB</p>
                </div>
                <span className="dash-spacer" />
                <div className="dash-head-actions">
                    <DashSeg aria-label="Periode" options={PERIOD_OPTIONS} value={String(days) as `${AgentDashboardPeriod}`}
                        onChange={(v) => setDays(Number(v) as AgentDashboardPeriod)} />
                    <Button variant="soft" size="icon" onClick={reload} loading={reloading} aria-label="Muat ulang" title="Muat ulang">
                        {!reloading && <RefreshCw aria-hidden="true" />}
                    </Button>
                </div>
            </header>

            {isSelf && <CsiPendingCard className="mb-4" />}

            <SummaryTiles stats={stats} ticketsHref={isSelf ? MY_TICKETS_HREF : undefined} />

            <div className="dgrid">
                <div className="dash-stack s8">
                    <AttentionList stats={stats} viewAllHref={isSelf ? MY_TICKETS_HREF : undefined} isRefreshing={reloading} />
                    <AgentTrendChart stats={stats} />
                    {data.kind === 'dev' && <DevBreakdownCard stats={stats} />}
                </div>
                <div className="dash-stack s4">
                    <PerformanceCard data={data} showRating={!isSelf} />
                    {data.support && <SupportCard support={data.support} />}
                    {isSelf && <MyRatingCard />}
                </div>
            </div>
        </div>
    );
};
