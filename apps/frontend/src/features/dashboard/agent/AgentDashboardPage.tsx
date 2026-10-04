import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, RefreshCcw, ServerCrash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { SERVICE_SCOPE_LABELS } from '@/lib/constants/service-scope';
import { getRoleLabel } from '@/features/admin/components/agent-management/agent-types';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { MyRatingCard } from '../components/MyRatingCard';
import { useAgentDashboard } from './useAgentDashboard';
import { firstName, formatWibDateTime, wibGreeting } from './agentDashboard.format';
import {
    AGENT_DASHBOARD_PERIODS,
    DEFAULT_AGENT_DASHBOARD_PERIOD,
    type AgentDashboardData,
    type AgentDashboardPeriod,
} from './agentDashboard.types';
import { AttentionList, DevBreakdownCard, PerformanceCard, SummaryTiles, SupportCard, SURFACE } from './AgentDashboardWidgets';
import { AgentTrendChart } from './AgentTrendChart';

const MY_TICKETS_HREF = '/tickets/list?filter=assigned_to_me';

/** iOS-style segmented control. */
const PeriodToggle: React.FC<{ value: AgentDashboardPeriod; onChange: (p: AgentDashboardPeriod) => void }> = ({ value, onChange }) => (
    <div className="inline-flex items-center bg-foreground/[0.06] p-0.5 rounded-[10px]" role="group" aria-label="Periode">
        {AGENT_DASHBOARD_PERIODS.map((p) => (
            <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-pressed={value === p}
                className={cn(
                    'px-3.5 py-1 text-[13px] font-medium rounded-lg transition-all',
                    value === p ? 'bg-card dark:bg-white/15 text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-muted-foreground hover:text-foreground',
                )}
            >{p} hari</button>
        ))}
    </div>
);

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
                <button onClick={() => refetch()} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium">Coba lagi</button>
            </div>
        );
    }

    const isSelf = !id || data.agent.id === user?.id;
    const { agent, stats } = data;

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full pb-8">
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-2">
                <div className="min-w-0">
                    {!isSelf && (
                        <button onClick={() => navigate(-1)} className="flex items-center gap-0.5 text-sm font-medium text-primary mb-2 -ml-1 hover:opacity-80">
                            <ChevronLeft className="w-4 h-4" /> Kembali
                        </button>
                    )}
                    <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">
                        {isSelf ? 'Dashboard Saya' : `Dashboard ${agent.fullName}`}
                    </p>
                    <h1 className="text-[28px] md:text-[34px] font-bold text-foreground tracking-tight leading-tight">
                        {isSelf ? `${wibGreeting()}, ${firstName(agent.fullName)}` : agent.fullName}
                    </h1>
                    <p className="text-[15px] text-muted-foreground mt-1">{summarySentence(data)}</p>
                    <p className="text-xs text-muted-foreground/80 mt-1.5">
                        {agentMeta(agent)} · diperbarui {formatWibDateTime(data.generatedAt)} WIB
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <PeriodToggle value={days} onChange={setDays} />
                    <button
                        onClick={() => refetch()}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.06] hover:bg-foreground/10 text-muted-foreground"
                        title="Muat ulang"
                        aria-label="Muat ulang"
                    >
                        <RefreshCcw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
                    </button>
                </div>
            </header>

            <SummaryTiles stats={stats} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <AttentionList stats={stats} viewAllHref={isSelf ? MY_TICKETS_HREF : undefined} />
                    <AgentTrendChart stats={stats} />
                    {data.kind === 'dev' && <DevBreakdownCard stats={stats} />}
                </div>
                <div className="flex flex-col gap-6">
                    <PerformanceCard data={data} showRating={!isSelf} />
                    {data.support && <SupportCard support={data.support} />}
                    {isSelf && <MyRatingCard className={cn(SURFACE, 'border-0')} />}
                </div>
            </div>
        </div>
    );
};
