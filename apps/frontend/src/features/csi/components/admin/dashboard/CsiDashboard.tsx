import { useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useCsiDashboard } from '../../../hooks/useCsi';
import type { CsiScopeParam } from '../../../types';
import { DashboardLive } from './DashboardLive';
import { DashboardTrend } from './DashboardTrend';

type DashboardTab = 'live' | 'trend';
const TABS = [
    { value: 'live', label: 'Periode aktif' },
    { value: 'trend', label: 'Tren' },
] as const;

/** CSI dashboard of one scope (spec "Dashboard CSI"): active-period progress and the score trend. */
export function CsiDashboard({ scope, onOpenReport }: { scope: CsiScopeParam; onOpenReport?: (periodId: string, siteId: string | null) => void }) {
    const [tab, setTab] = useState<DashboardTab>('live');
    const { data, isLoading, isError, refetch } = useCsiDashboard(scope);
    const today = useMemo(() => new Date(), []);
    return (
        <div className="grid gap-4">
            <SegmentedControl aria-label="Tampilan dashboard CSI" className="w-fit" options={TABS} value={tab} onValueChange={setTab} />
            {isLoading && <div className="h-40 animate-pulse rounded-[18px] bg-[hsl(var(--muted))] motion-reduce:animate-none" aria-busy="true" aria-label="Memuat dashboard" />}
            {isError && <ErrorState compact message="Gagal memuat dashboard CSI." onRetry={() => refetch()} />}
            {data && (tab === 'live' ? <DashboardLive scope={scope} data={data} today={today} onOpenReport={onOpenReport} /> : <DashboardTrend data={data} />)}
        </div>
    );
}
