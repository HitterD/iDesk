import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ShieldAlert, Star } from 'lucide-react';
import { ResHead } from '@/components/resources/ResourceParts';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import { DepartmentsTab } from '../components/admin/DepartmentsTab';
import { DimensionsTab } from '../components/admin/DimensionsTab';
import { PeriodDetail } from '../components/admin/PeriodDetail';
import { PeriodsTab } from '../components/admin/PeriodsTab';
import { RatersTab } from '../components/admin/RatersTab';
import { ADMIN_PANEL, MUTED_TEXT } from '../components/admin/AdminParts';
import { csiAdminPath, CSI_SCOPE_OF, isCsiScopeParam } from '../lib/csiAdmin';
import { useCsiAdminAccess } from '../lib/useCsiAdminAccess';
import { useCsiBasePath } from '../lib/useCsiBasePath';
import type { CsiScopeParam } from '../types';

type AdminTab = 'periods' | 'dimensions' | 'departments' | 'raters';
const TABS = [
    { value: 'periods', label: 'Periode' },
    { value: 'dimensions', label: 'Dimensi' },
    { value: 'departments', label: 'Departemen' },
    { value: 'raters', label: 'Penilai' },
] as const;
const PERIOD_PARAM = 'period';

function NotAuthorized() {
    return (
        <div className={cn(ADMIN_PANEL, 'mx-auto max-w-lg px-6 py-14 text-center')} role="status">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--muted))]">
                <ShieldAlert className="h-7 w-7 opacity-70" aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold">Anda tidak memiliki akses Admin CSI</p>
            <p className={cn(MUTED_TEXT, 'mt-1')}>Minta Admin iDesk menambahkan akses Admin CSI ke preset Anda.</p>
        </div>
    );
}

function TabBody({ scope, tab, onOpenPeriod }: { scope: CsiScopeParam; tab: AdminTab; onOpenPeriod: (id: string) => void }) {
    switch (tab) {
        case 'dimensions': return <DimensionsTab scope={scope} />;
        case 'departments': return <DepartmentsTab scope={scope} />;
        case 'raters': return <RatersTab scope={scope} />;
        default: return <PeriodsTab scope={scope} onOpen={onOpenPeriod} />;
    }
}

function ScopeAdmin({ scope }: { scope: CsiScopeParam }) {
    const [params, setParams] = useSearchParams();
    const [tab, setTab] = useState<AdminTab>('periods');
    const periodId = params.get(PERIOD_PARAM);
    const openPeriod = (id: string | null) => setParams((current) => {
        const next = new URLSearchParams(current);
        if (id) next.set(PERIOD_PARAM, id); else next.delete(PERIOD_PARAM);
        return next;
    });
    const selectTab = (value: AdminTab) => { setTab(value); if (periodId) openPeriod(null); };

    return (
        <div className="res-page">
            <ResHead icon={Star} tone="orange" title={`Survei Kepuasan — ${CSI_SCOPE_OF[scope]}`}
                description="Kelola periode, dimensi penilaian, departemen, dan penilai." />
            <SegmentedControl aria-label="Bagian Admin CSI" className="res-tabs" options={TABS}
                value={periodId ? 'periods' : tab} onValueChange={selectTab} />
            {periodId
                ? <PeriodDetail key={periodId} scope={scope} periodId={periodId} onBack={() => openPeriod(null)} />
                : <TabBody scope={scope} tab={tab} onOpenPeriod={openPeriod} />}
        </div>
    );
}

export function CsiAdminPage() {
    const { scope } = useParams<{ scope: string }>();
    const basePath = useCsiBasePath();
    const { scopes, isLoading } = useCsiAdminAccess();
    if (isLoading) return <div className={cn(ADMIN_PANEL, 'h-40 animate-pulse motion-reduce:animate-none')} aria-busy="true" aria-label="Memuat akses" />;
    if (isCsiScopeParam(scope) && scopes.includes(scope)) return <ScopeAdmin key={scope} scope={scope} />;
    // Unknown or unauthorised scope: fall back to the first scope this user may administer.
    if (scopes.length) return <Navigate to={csiAdminPath(basePath, scopes[0])} replace />;
    return <NotAuthorized />;
}

export default CsiAdminPage;
