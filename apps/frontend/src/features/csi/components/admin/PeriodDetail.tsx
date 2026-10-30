import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useCsiPeriod } from '../../hooks/useCsi';
import { CSI_MODE_LABELS } from '../../lib/csiAdmin';
import { formatDateRange } from '../../lib/format';
import { formatSites } from '../../lib/location';
import type { WizardStepKey } from '../../lib/wizard';
import type { CsiScopeParam } from '../../types';
import { ADMIN_PANEL, MUTED_TEXT, PublishPill, StatusPill } from './AdminParts';
import { AssignmentMatrix } from './assignment/AssignmentMatrix';
import { PeriodChecklist } from './PeriodChecklist';
import { PeriodReport } from './PeriodReport';
import { RespondentStatus } from './RespondentStatus';
import { ResponseDetailSheet } from './ResponseDetailSheet';

type DetailTab = 'settings' | 'raters' | 'report';
const DETAIL_TABS = [
    { value: 'settings', label: 'Kelengkapan' },
    { value: 'raters', label: 'Penilai' },
    { value: 'report', label: 'Laporan' },
] as const;
export const UNSAVED_LEAVE_TITLE = 'Perubahan belum disimpan. Tinggalkan?';

function ReportPanel({ scope, periodId }: { scope: CsiScopeParam; periodId: string }) {
    const [responseId, setResponseId] = useState<string | null>(null);
    return (
        <div className="grid gap-5">
            <PeriodReport scope={scope} periodId={periodId} />
            <RespondentStatus scope={scope} periodId={periodId} onOpenResponse={setResponseId} />
            <ResponseDetailSheet scope={scope} periodId={periodId} responseId={responseId} onClose={() => setResponseId(null)} />
        </div>
    );
}

interface PeriodDetailProps {
    scope: CsiScopeParam;
    periodId: string;
    onBack: () => void;
    /** Opens the survey wizard at a step ("Ubah"). */
    onEditStep: (step: WizardStepKey) => void;
}

export function PeriodDetail({ scope, periodId, onBack, onEditStep }: PeriodDetailProps) {
    const { data: period, isLoading, isError, refetch } = useCsiPeriod(scope, periodId);
    const [tab, setTab] = useState<DetailTab>('settings');
    // The matrix edits locally; leaving its tab with unsaved pairs asks first.
    const [matrixDirty, setMatrixDirty] = useState(false);
    const [pendingTab, setPendingTab] = useState<DetailTab | null>(null);
    const changeTab = (next: DetailTab) => {
        if (next === tab) return;
        if (tab === 'raters' && matrixDirty) setPendingTab(next);
        else setTab(next);
    };
    const leave = () => { if (pendingTab) { setMatrixDirty(false); setTab(pendingTab); } setPendingTab(null); };

    if (isLoading) return <div className={`${ADMIN_PANEL} h-48 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Memuat survei" />;
    if (isError || !period) return <ErrorState message="Gagal memuat survei." onRetry={() => refetch()} />;

    return (
        <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={onBack} className="idesk-text-link"><ArrowLeft aria-hidden="true" />Semua survei</button>
            </div>
            <header className="flex flex-wrap items-end gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[20px] font-bold tracking-tight">{period.title}</h2>
                        <PublishPill status={period.publishStatus} />
                        <StatusPill status={period.status} />
                    </div>
                    <p className={MUTED_TEXT}>
                        {[formatSites(period.sites), formatDateRange(period.startDate, period.endDate), CSI_MODE_LABELS[period.respondentMode]].filter(Boolean).join(' · ')}
                    </p>
                </div>
                <SegmentedControl aria-label="Bagian survei" className="dash-seg" options={DETAIL_TABS} value={tab} onValueChange={changeTab} />
            </header>
            {tab === 'settings' && <PeriodChecklist scope={scope} period={period} onEditStep={onEditStep} onDeleted={onBack} />}
            {tab === 'raters' && <AssignmentMatrix scope={scope} period={period} onDirtyChange={setMatrixDirty} />}
            {tab === 'report' && <ReportPanel scope={scope} periodId={period.id} />}
            <ConfirmationDialog isOpen={pendingTab !== null} appearance="ticket" variant="warning" title={UNSAVED_LEAVE_TITLE}
                description="Perubahan pada matriks penilai akan hilang." confirmText="Tinggalkan" cancelText="Tetap di sini"
                onConfirm={leave} onCancel={() => setPendingTab(null)} />
        </div>
    );
}
