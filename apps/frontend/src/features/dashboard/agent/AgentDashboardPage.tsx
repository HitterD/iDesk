import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCcw, ServerCrash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { SERVICE_SCOPE_LABELS } from '@/lib/constants/service-scope';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { MyRatingCard } from '../components/MyRatingCard';
import { useAgentDashboard } from './useAgentDashboard';
import { formatWibDateTime } from './agentDashboard.format';
import {
    AGENT_DASHBOARD_PERIODS,
    DEFAULT_AGENT_DASHBOARD_PERIOD,
    type AgentDashboardPeriod,
} from './agentDashboard.types';
import {
    ActiveTicketList,
    AppraisalRow,
    DevBreakdownCard,
    PerformanceCard,
    RatingSummaryCard,
    StatGrid,
    SupportCard,
    TrendChart,
} from './AgentDashboardWidgets';

const PeriodToggle: React.FC<{ value: AgentDashboardPeriod; onChange: (p: AgentDashboardPeriod) => void }> = ({ value, onChange }) => (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-xl" role="group" aria-label="Periode">
        {AGENT_DASHBOARD_PERIODS.map((p) => (
            <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-pressed={value === p}
                className={cn(
                    'px-3 py-1.5 text-xs font-bold rounded-lg transition-colors',
                    value === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
            >{p} hari</button>
        ))}
    </div>
);

/**
 * Personal agent dashboard. `/dashboard/me` shows the signed-in agent;
 * `/dashboard/agent/:id` lets ADMIN/MANAGER open a specific agent (the backend enforces scope).
 */
export const AgentDashboardPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [days, setDays] = useState<AgentDashboardPeriod>(DEFAULT_AGENT_DASHBOARD_PERIOD);
    const { data, isLoading, isError, refetch, isFetching } = useAgentDashboard(id, days);

    // Invalidates 'dashboard-stats' (our query key prefix) on ticket socket events.
    useTicketListSocket();

    if (isLoading) return <DashboardSkeleton />;
    if (isError || !data?.agent) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <ServerCrash className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gagal memuat dashboard agent.</p>
                <button onClick={() => refetch()} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold">Coba lagi</button>
            </div>
        );
    }

    const isSelf = !id || data.agent.id === user?.id;
    const { agent, stats } = data;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {!isSelf && (
                        <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-border hover:bg-secondary/60" aria-label="Kembali">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                            {isSelf ? 'Dashboard Saya' : `Dashboard ${agent.fullName}`}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {agent.fullName} · {agent.role}
                            {agent.scope && ` · Lingkup ${SERVICE_SCOPE_LABELS[agent.scope]}`}
                            {agent.site && ` · ${agent.site.code}`}
                            {` · diperbarui ${formatWibDateTime(data.generatedAt)} WIB`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <PeriodToggle value={days} onChange={setDays} />
                    <button
                        onClick={() => refetch()}
                        className="p-2.5 bg-card rounded-xl border border-border hover:bg-secondary/60"
                        title="Refresh"
                        aria-label="Refresh"
                    >
                        <RefreshCcw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
                    </button>
                </div>
            </div>

            <StatGrid stats={stats} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2"><TrendChart stats={stats} /></div>
                <PerformanceCard stats={stats} />
            </div>

            {data.kind === 'dev' && <DevBreakdownCard stats={stats} />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2"><ActiveTicketList stats={stats} /></div>
                <div className="flex flex-col gap-6">
                    {data.support && <SupportCard support={data.support} />}
                    {isSelf ? (
                        <>
                            <MyRatingCard />
                            <div className="bg-card border border-border rounded-2xl p-5"><AppraisalRow points={agent.appraisalPoints} /></div>
                        </>
                    ) : (
                        <RatingSummaryCard data={data} />
                    )}
                </div>
            </div>
        </div>
    );
};
