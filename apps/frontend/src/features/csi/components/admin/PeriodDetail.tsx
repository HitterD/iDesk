import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useCsiPeriod, useDeleteCsiPeriod } from '../../hooks/useCsi';
import { CSI_MODE_LABELS } from '../../lib/csiAdmin';
import { formatDateRange } from '../../lib/format';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { ADMIN_PANEL, AdminSection, MUTED_TEXT, StatusPill } from './AdminParts';
import { PeriodEditor } from './PeriodEditor';
import { PeriodRaters } from './PeriodRaters';
import { PeriodReport } from './PeriodReport';
import { RateeAssignment } from './RateeAssignment';
import { RespondentStatus } from './RespondentStatus';
import { ResponseDetailSheet } from './ResponseDetailSheet';

type DetailTab = 'settings' | 'report';
const DETAIL_TABS = [
    { value: 'settings', label: 'Pengaturan' },
    { value: 'report', label: 'Laporan' },
] as const;

function DeletePeriod({ scope, period, onDeleted }: { scope: CsiScopeParam; period: CsiPeriodDetail; onDeleted: () => void }) {
    const [open, setOpen] = useState(false);
    const remove = useDeleteCsiPeriod(scope);
    return (
        <>
            <Button variant="danger" onClick={() => setOpen(true)} disabled={period.locked}
                title={period.locked ? 'Periode yang sudah memiliki jawaban tidak dapat dihapus' : undefined}>
                <Trash2 aria-hidden="true" />Hapus periode
            </Button>
            <ConfirmationDialog isOpen={open} appearance="ticket" variant="destructive" title="Hapus periode?"
                description={`"${period.title}" beserta penugasannya akan dihapus permanen.`} confirmText="Hapus" cancelText="Batal"
                isLoading={remove.isPending} onCancel={() => setOpen(false)}
                onConfirm={() => remove.mutate(period.id, { onSuccess: () => { setOpen(false); onDeleted(); } })} />
        </>
    );
}

function SettingsPanel({ scope, period, onDeleted }: { scope: CsiScopeParam; period: CsiPeriodDetail; onDeleted: () => void }) {
    return (
        <div className="grid gap-5">
            <AdminSection title="Pengaturan periode" description="Teks dan tanggal tetap dapat diubah setelah ada jawaban."
                actions={<DeletePeriod scope={scope} period={period} onDeleted={onDeleted} />}>
                <PeriodEditor key={period.updatedAt} scope={scope} period={period} />
            </AdminSection>
            {/* Keyed by updatedAt + locked so a refetch after saving resets the local drafts. */}
            <RateeAssignment key={`ratees-${period.updatedAt}-${period.locked}-${period.ratees.length}`} scope={scope} period={period} />
            {period.respondentMode === 'LISTED' && (
                <PeriodRaters key={`raters-${period.raters.map((rater) => rater.userId).join(',')}-${period.locked}`} scope={scope} period={period} />
            )}
        </div>
    );
}

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

export function PeriodDetail({ scope, periodId, onBack }: { scope: CsiScopeParam; periodId: string; onBack: () => void }) {
    const { data: period, isLoading, isError, refetch } = useCsiPeriod(scope, periodId);
    const [tab, setTab] = useState<DetailTab>('settings');

    if (isLoading) return <div className={`${ADMIN_PANEL} h-48 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Memuat periode" />;
    if (isError || !period) return <ErrorState message="Gagal memuat periode." onRetry={() => refetch()} />;

    return (
        <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={onBack} className="idesk-text-link"><ArrowLeft aria-hidden="true" />Semua periode</button>
            </div>
            <header className="flex flex-wrap items-end gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[20px] font-bold tracking-tight">{period.title}</h2>
                        <StatusPill status={period.status} />
                    </div>
                    <p className={MUTED_TEXT}>
                        {[period.site?.code, formatDateRange(period.startDate, period.endDate), CSI_MODE_LABELS[period.respondentMode]].filter(Boolean).join(' · ')}
                    </p>
                </div>
                <SegmentedControl aria-label="Bagian periode" className="dash-seg" options={DETAIL_TABS} value={tab} onValueChange={setTab} />
            </header>
            {tab === 'settings'
                ? <SettingsPanel scope={scope} period={period} onDeleted={onBack} />
                : <ReportPanel scope={scope} periodId={period.id} />}
        </div>
    );
}
