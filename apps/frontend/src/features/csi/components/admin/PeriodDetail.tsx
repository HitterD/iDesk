import { EditOnly } from '../../lib/CsiReadOnly';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useCsiPeriod, useCsiPeriods } from '../../hooks/useCsi';
import { CSI_MODE_LABELS, isOrgCsiScope, isRaterAdditionOpen } from '../../lib/csiAdmin';
import { formatDateRange } from '../../lib/format';
import { formatSites } from '../../lib/location';
import type { WizardStepKey } from '../../lib/wizard';
import type { CsiScopeParam, CsiSiteSummary } from '../../types';
import { ADMIN_PANEL, MUTED_TEXT, SurveyStatePill } from './AdminParts';
import { PairsPanel } from '../wizard/StepPairs';
import { HcPairsPanel } from './hc/HcPairsPanel';
import { isHcDecided } from '../../lib/hcMode';
import { PeriodChecklist } from './PeriodChecklist';
import { PeriodReport } from './PeriodReport';
import { RespondentStatus } from './RespondentStatus';

type DetailTab = 'settings' | 'raters' | 'report';
const DETAIL_TABS = [
    { value: 'report', label: 'Laporan & progres' },
    { value: 'raters', label: 'Siapa menilai siapa' },
    { value: 'settings', label: 'Syarat terbit' },
] as const;
export const UNSAVED_LEAVE_TITLE = 'Perubahan belum disimpan. Tinggalkan?';

function ReportPanel({ scope, periodId, periodTitle, sites, initialSiteId, onSiteChange, hcTarget, canEditRaters }: {
    scope: CsiScopeParam; periodId: string; periodTitle?: string; sites: readonly CsiSiteSummary[];
    initialSiteId?: string | null; onSiteChange?: (siteId: string | null) => void; hcTarget?: boolean; canEditRaters?: boolean;
}) {
    return (
        <div className="grid gap-5">
            {/* Progress first: "who has not filled it yet" is what admins look for while a survey runs. */}
            <RespondentStatus scope={scope} periodId={periodId} periodTitle={periodTitle} sites={sites}
                hcTarget={hcTarget} canEditRaters={canEditRaters} />
            <PeriodReport scope={scope} periodId={periodId} sites={sites} initialSiteId={initialSiteId} onSiteChange={onSiteChange} />
        </div>
    );
}

interface PeriodDetailProps {
    scope: CsiScopeParam;
    periodId: string;
    onBack: () => void;
    /** Opens the survey wizard at a step ("Ubah"). */
    onEditStep: (step: WizardStepKey) => void;
    /** Deep link from the dashboard: open this tab (and site filter) first. */
    initialTab?: DetailTab | null;
    initialSiteId?: string | null;
    onSiteChange?: (siteId: string | null) => void;
}

export function PeriodDetail({ scope, periodId, onBack, onEditStep, initialTab, initialSiteId, onSiteChange }: PeriodDetailProps) {
    const { data: period, isLoading, isError, refetch } = useCsiPeriod(scope, periodId);
    const { data: listed } = useCsiPeriods(scope);
    const responseCount = listed?.find((row) => row.id === periodId)?.responseCount ?? 0;
    // A draft opens on what it still needs; anything published or cancelled opens on its results.
    const [chosenTab, setTab] = useState<DetailTab | null>(initialTab ?? null);
    const tab: DetailTab = chosenTab ?? (period && period.publishStatus === 'DRAFT' ? 'settings' : 'report');
    // The matrix edits locally; leaving its tab with unsaved pairs asks first.
    const [matrixDirty, setMatrixDirty] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ type: 'tab'; tab: DetailTab } | { type: 'back' } | null>(null);
    const changeTab = (next: DetailTab) => {
        if (next === tab) return;
        if (tab === 'raters' && matrixDirty) setPendingAction({ type: 'tab', tab: next });
        else setTab(next);
    };
    const requestBack = () => {
        if (tab === 'raters' && matrixDirty) setPendingAction({ type: 'back' });
        else onBack();
    };
    const leave = () => {
        const action = pendingAction;
        setPendingAction(null);
        setMatrixDirty(false);
        if (action?.type === 'tab') setTab(action.tab);
        else if (action?.type === 'back') onBack();
    };

    if (isLoading) return <div className={`${ADMIN_PANEL} h-48 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Memuat survei" />;
    if (isError || !period) return <ErrorState message="Gagal memuat survei." onRetry={() => refetch()} />;

    return (
        <div className="grid gap-5">
            <div className="sticky top-[var(--csi-admin-sticky-top,47px)] z-10 -mx-3 flex flex-wrap items-center gap-3 border-b border-[hsl(var(--idesk-border)/.45)] bg-[hsl(var(--shell-sheet)/.92)] px-3 py-2 backdrop-blur-md lg:-mx-3.5 lg:px-3.5">
                <button type="button" onClick={requestBack} className="idesk-text-link"><ArrowLeft aria-hidden="true" />Semua survei</button>
                <SegmentedControl aria-label="Bagian survei" className="dash-seg ml-auto" options={DETAIL_TABS} value={tab} onValueChange={changeTab} />
            </div>
            <header className="flex flex-wrap items-end gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[20px] font-bold tracking-tight">{period.title}</h2>
                        <SurveyStatePill period={period} />
                    </div>
                    <p className={MUTED_TEXT}>
                        {[formatSites(period.sites), formatDateRange(period.startDate, period.endDate), CSI_MODE_LABELS[period.respondentMode]].filter(Boolean).join(' · ')}
                    </p>
                </div>
            </header>
            {tab === 'settings' && <EditOnly><PeriodChecklist scope={scope} period={period} responseCount={responseCount} onEditStep={onEditStep} onDeleted={onBack} /></EditOnly>}
            {tab === 'raters' && <EditOnly>{isHcDecided(scope, period) ? <HcPairsPanel scope={scope} period={period} />
                : <PairsPanel scope={scope} period={period} onDirtyChange={setMatrixDirty} />}</EditOnly>}
            {tab === 'report' && <ReportPanel scope={scope} periodId={period.id} periodTitle={period.title} sites={period.sites} initialSiteId={initialSiteId}
                onSiteChange={onSiteChange} hcTarget={isOrgCsiScope(scope) && !!period.respondentPicks && !!period.targetRespondents}
                canEditRaters={isRaterAdditionOpen(period)} />}
            <ConfirmationDialog isOpen={pendingAction !== null} appearance="ticket" variant="warning" title={UNSAVED_LEAVE_TITLE}
                description="Perubahan pada matriks penilai akan hilang." confirmText="Tinggalkan" cancelText="Tetap di sini"
                onConfirm={leave} onCancel={() => setPendingAction(null)} />
        </div>
    );
}
