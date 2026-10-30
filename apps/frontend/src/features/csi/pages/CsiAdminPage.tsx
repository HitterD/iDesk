import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ShieldAlert, Star } from 'lucide-react';
import { ResHead } from '@/components/resources/ResourceParts';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import { CsiDashboard } from '../components/admin/dashboard/CsiDashboard';
import { MasterDataPanel } from '../components/admin/MasterDataPanel';
import { PeriodDetail } from '../components/admin/PeriodDetail';
import { PeriodsTab } from '../components/admin/PeriodsTab';
import { SubjectsTab } from '../components/admin/subjects/SubjectsTab';
import { ADMIN_PANEL, MUTED_TEXT } from '../components/admin/AdminParts';
import { WizardRoute } from '../components/wizard/WizardRoute';
import { csiAdminPath, CSI_SCOPE_OF, isCsiScopeParam } from '../lib/csiAdmin';
import { useAdminRoute, type AdminRoute } from '../lib/useAdminRoute';
import { useCsiAdminAccess } from '../lib/useCsiAdminAccess';
import { useCsiBasePath } from '../lib/useCsiBasePath';
import type { CsiPeriodListItem, CsiScopeParam } from '../types';

type AdminArea = 'dashboard' | 'surveys' | 'subjects' | 'master';
const AREAS = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'surveys', label: 'Survei' },
    { value: 'subjects', label: 'Subjek & foto' },
    { value: 'master', label: 'Master data' },
] as const;

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

function SurveysArea({ scope, route }: { scope: CsiScopeParam; route: AdminRoute }) {
    if (route.wizard !== undefined) return <WizardRoute key={route.wizard ?? 'new'} scope={scope} route={route} />;
    if (route.periodId) {
        return <PeriodDetail key={route.periodId} scope={scope} periodId={route.periodId} onBack={route.closeAll}
            onEditStep={(step) => route.openWizard(route.periodId, step)} />;
    }
    // Drafts resume in the wizard (the step is resolved once the detail loads); published surveys open the detail.
    const open = (period: CsiPeriodListItem) => period.publishStatus === 'DRAFT' ? route.openWizard(period.id) : route.openDetail(period.id);
    return <PeriodsTab scope={scope} onOpen={open} onCreate={() => route.openWizard(null, 'info')} />;
}

function AreaBody({ area, scope, route }: { area: AdminArea; scope: CsiScopeParam; route: AdminRoute }) {
    switch (area) {
        case 'dashboard': return <CsiDashboard scope={scope} />;
        case 'subjects': return <SubjectsTab scope={scope} />;
        case 'master': return <MasterDataPanel scope={scope} />;
        case 'surveys': return <SurveysArea scope={scope} route={route} />;
    }
}

function ScopeAdmin({ scope }: { scope: CsiScopeParam }) {
    const route = useAdminRoute();
    const [area, setArea] = useState<AdminArea>('dashboard');
    const inSurvey = route.wizard !== undefined || !!route.periodId;
    const selectArea = (value: AdminArea) => { setArea(value); if (inSurvey) route.closeAll(); };

    return (
        <div className="res-page">
            <ResHead icon={Star} tone="orange" title={`Survei Kepuasan — ${CSI_SCOPE_OF[scope]}`}
                description="Buat survei langkah demi langkah, terbitkan, lalu pantau hasilnya." />
            <SegmentedControl aria-label="Bagian Admin CSI" className="res-tabs" options={AREAS}
                value={inSurvey ? 'surveys' : area} onValueChange={selectArea} />
            <AreaBody area={inSurvey ? 'surveys' : area} scope={scope} route={route} />
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
