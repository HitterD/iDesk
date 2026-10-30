import React from 'react';
import { cn } from '@/lib/utils';
import { DashChartSkeleton, DashSkeletonList } from './DashboardParts';

const AGENT_STATS = 4;
const TEAM_STATS = 5;
const LIST_ROWS = 5;
const SIDE_ROWS = 3;

const StatSkeleton: React.FC = () => (
    <div className="dash-stat" aria-hidden="true">
        <span className="portal-stat-top"><i className="dash-sk is-box" style={{ width: 26, height: 26, borderRadius: 999 }} /><i className="dash-sk is-num" /></span>
        <i className="dash-sk w-1/2" />
        <i className="dash-sk w-3/4" />
    </div>
);

const PanelSkeleton: React.FC<{ className?: string; rows?: number; chart?: boolean }> = ({ className, rows = SIDE_ROWS, chart }) => (
    <div className={cn('dash-panel', className)} aria-hidden="true">
        <i className="dash-sk w-1/4 mb-4" />
        {chart ? <DashChartSkeleton /> : <DashSkeletonList rows={rows} />}
    </div>
);

/** Loading state in the dashboard grid (mockup shimmer); `team` = 5 stats, `agent` = 4. */
export const DashboardSkeleton: React.FC<{ variant?: 'agent' | 'team' }> = ({ variant = 'team' }) => {
    const statCount = variant === 'agent' ? AGENT_STATS : TEAM_STATS;
    return (
        <div className="dash" role="status" aria-label="Memuat dashboard">
            <div className="dash-head" aria-hidden="true">
                <div className="grid gap-2 min-w-0 w-72 max-w-full"><i className="dash-sk w-4/5" style={{ height: 22 }} /><i className="dash-sk w-3/5" /></div>
            </div>
            <div className={cn('dash-stats', variant === 'agent' ? 'is-four' : 'is-five')}>
                {Array.from({ length: statCount }, (_, i) => <StatSkeleton key={i} />)}
            </div>
            <div className="dgrid">
                <div className="dash-stack s8">
                    {variant === 'agent' && <PanelSkeleton rows={LIST_ROWS} />}
                    <PanelSkeleton chart className="is-fill" />
                </div>
                <div className="dash-stack s4">
                    <PanelSkeleton />
                    <PanelSkeleton />
                </div>
            </div>
            <span className="sr-only">Memuat dashboard…</span>
        </div>
    );
};
