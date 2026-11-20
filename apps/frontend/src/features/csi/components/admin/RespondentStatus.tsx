import { useState } from 'react';
import { BellRing, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { useCsiReport, useCsiRespondents, useSendCsiReminders } from '../../hooks/useCsi';
import { mergedSiteGroups } from '../../lib/siteHandlers';
import type { CsiReminderResult, CsiRespondents, CsiScopeParam, CsiSiteSummary, CsiSla } from '../../types';
import { AdminSection } from './AdminParts';
import { LiveStatusPill } from './LiveStatusPill';
import { PendingByDepartment } from './hc/PendingByDepartment';
import { PersonList } from './respondents/PersonList';
import { exportRespondentsExcel } from './respondents/respondentExcel';
import { RemovePeriodRaterDialog, type RemovePeriodRaterTarget } from './RemovePeriodRaterDialog';
import { useCsiReadOnly } from '../../lib/CsiReadOnly';
import { ResetResponseDialog, type ResetResponseTarget } from './ResetResponseDialog';
import { RespondentHero, type SiteProgress } from './respondents/RespondentHero';
import { overallProgress, personRows, progressOf, type PersonRow } from './respondents/respondentModel';

/** Basis copy per mode: OPEN counts iDesk ticket reporters (SLA basis), LISTED the registered raters. */
const BASIS_LABEL = { OPEN: 'Pelapor tiket iDesk', LISTED: 'penilai terpilih' } as const;

/** OPEN with an HC target (respondents pick their PICs): the basis is that target, not ticket reporters. */
const openDescription = (hcTarget: boolean) => (hcTarget
    ? 'Responden memilih PIC sendiri; basis = target jumlah responden yang ditetapkan HC (maks. 100%)'
    : 'Mode terbuka: semua user aktif di site dapat mengisi; basis target = pelapor tiket iDesk 12 bulan terakhir');

const reminderToast = ({ sent, skipped }: CsiReminderResult) =>
    `Pengingat terkirim ke ${sent} orang${skipped > 0 ? `, ${skipped} dilewati` : ''}`;

/** LISTED only: per-site progress against the period target (ICT merges delegated sites like SKD -> SPJ). */
function siteProgress(scope: CsiScopeParam, rows: readonly PersonRow[], sites: readonly CsiSiteSummary[], targetPct: number): SiteProgress[] {
    return mergedSiteGroups(scope, sites).map((group) => {
        const own = rows.filter((row) => row.siteId !== null && group.sourceSiteIds.has(row.siteId));
        return {
            siteId: group.id,
            code: group.code,
            name: group.displayName,
            progress: progressOf(own.filter((row) => row.done).length, own.length, targetPct),
        };
    });
}

function useReminders(scope: CsiScopeParam, periodId: string) {
    const send = useSendCsiReminders(scope, periodId);
    const [reminded, setReminded] = useState<ReadonlySet<string>>(new Set());
    const [rowId, setRowId] = useState<string | null>(null);
    const markSent = (userIds: readonly string[]) => setReminded((current) => new Set([...current, ...userIds]));
    const remindOne = (userId: string) => {
        setRowId(userId);
        send.mutate({ userIds: [userId] }, { onSuccess: () => markSent([userId]), onSettled: () => setRowId(null) });
    };
    // Explicit ids: an empty list would also target raters who already answered.
    const remindAll = (userIds: readonly string[]) => send.mutate({ userIds: [...userIds] }, {
        onSuccess: (result) => { markSent(userIds); toast.success(reminderToast(result)); },
    });
    return { reminded, rowId, remindOne, remindAll, allPending: send.isPending && rowId === null };
}

function StatusBody({ scope, periodTitle, data, rows, sites, targetPct, reminders, onRemovePending, onResetResponse, basis, hcTarget, namesHidden, readOnly }: {
    scope: CsiScopeParam; periodTitle?: string; data: CsiRespondents; rows: PersonRow[]; sites: readonly CsiSiteSummary[]; targetPct: number;
    reminders: ReturnType<typeof useReminders>;
    onRemovePending?: (target: RemovePeriodRaterTarget) => void;
    onResetResponse?: (target: ResetResponseTarget) => void;
    readOnly: boolean;
    basis: CsiSla | undefined;
    hcTarget?: boolean;
    /** HC: the statistic shows departments only until the admin asks for the names (follow-up). */
    namesHidden: boolean;
}) {
    const listed = data.mode === 'LISTED';
    const progress = basis ? overallProgress(data, basis) : null;
    const siteCards = listed ? siteProgress(scope, rows, sites, targetPct) : [];
    return (
        <div className="grid gap-6">
            {progress && (
                <RespondentHero progress={progress} targetPct={targetPct} basisLabel={hcTarget ? 'target responden (HC)' : BASIS_LABEL[data.mode]}
                    sites={siteCards.length > 1 ? siteCards : []} />
            )}
            {data.pendingByDepartment && namesHidden && <PendingByDepartment rows={data.pendingByDepartment} />}
            {/* Read-only viewers get anonymous rows only: progress cards and department totals, never the person list. */}
            {!readOnly && !(data.pendingByDepartment && namesHidden) && (
                <PersonList scope={scope} periodTitle={periodTitle} rows={rows} sites={sites} canRemind={listed && !readOnly}
                    reminded={reminders.reminded} remindingId={reminders.rowId} onRemind={reminders.remindOne}
                    onRemovePending={onRemovePending} onResetResponse={onResetResponse} />
            )}
        </div>
    );
}

export function RespondentStatus({ scope, periodId, periodTitle, sites, hcTarget, canEditRaters = true }: {
    scope: CsiScopeParam; periodId: string; periodTitle?: string; sites: readonly CsiSiteSummary[];
    /** Open HC survey with an HC target number of respondents (the participation basis). */
    hcTarget?: boolean;
    /** False when the survey has ended or been cancelled (blocks removing pending raters). */
    canEditRaters?: boolean;
}) {
    const { data, isLoading, isError, refetch } = useCsiRespondents(scope, periodId);
    const { data: report } = useCsiReport(scope, periodId);
    const reminders = useReminders(scope, periodId);
    const readOnly = useCsiReadOnly();
    const [showNames, setShowNames] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<RemovePeriodRaterTarget | null>(null);
    const [resetTarget, setResetTarget] = useState<ResetResponseTarget | null>(null);
    // Both scopes: who has not answered is summarised per department; names stay one click away for follow-up.
    const byDepartment = !!data?.pendingByDepartment;
    const listed = data?.mode === 'LISTED';
    const rows = data ? personRows(data) : [];
    const namesHidden = byDepartment && !showNames;
    const pendingIds = rows.filter((row) => !row.done && row.userId && !reminders.reminded.has(row.userId)).map((row) => row.userId as string);
    const handleExportAll = async () => {
        if (!rows.length || exporting) return;
        setExporting(true);
        try {
            await exportRespondentsExcel({ rows, sites, scope, periodTitle });
        } catch {
            toast.error('Gagal mengekspor daftar responden');
        } finally {
            setExporting(false);
        }
    };
    const remindAll = !readOnly && listed && pendingIds.length > 0 && (
        <Button variant="soft" onClick={() => reminders.remindAll(pendingIds)} loading={reminders.allPending}>
            {!reminders.allPending && <BellRing aria-hidden="true" />}Ingatkan semua yang belum
        </Button>
    );
    const exportCollapsed = !readOnly && namesHidden && rows.length > 0 && (
        <Button variant="soft" onClick={() => void handleExportAll()} loading={exporting}>
            {!exporting && <Download aria-hidden="true" />}Ekspor Excel
        </Button>
    );
    const namesToggle = !readOnly && byDepartment && (
        <Button variant="soft" onClick={() => setShowNames((value) => !value)}>{showNames ? 'Sembunyikan nama' : 'Tampilkan nama'}</Button>
    );
    const actions = <div className="flex flex-wrap items-center gap-2"><LiveStatusPill />{exportCollapsed}{namesToggle}{remindAll}</div>;
    return (
        <>
            <AdminSection title="Status responden" actions={actions}
                description={data && !listed ? openDescription(!!hcTarget) : undefined}>
                {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--muted))] motion-reduce:animate-none" aria-busy="true" aria-label="Memuat responden" />}
                {isError && <ErrorState compact message="Gagal memuat status responden." onRetry={() => refetch()} />}
                {data && (
                    <StatusBody scope={scope} periodTitle={periodTitle} data={data} rows={rows} sites={sites}
                        targetPct={report?.sla.targetPct ?? 0} reminders={reminders}
                        onRemovePending={listed && canEditRaters && !readOnly ? setRemoveTarget : undefined}
                        onResetResponse={readOnly ? undefined : setResetTarget} readOnly={readOnly} basis={report?.sla} hcTarget={hcTarget} namesHidden={namesHidden} />
                )}
            </AdminSection>
            <RemovePeriodRaterDialog scope={scope} periodId={periodId} target={removeTarget} onClose={() => setRemoveTarget(null)} />
            <ResetResponseDialog scope={scope} periodId={periodId} target={resetTarget} onClose={() => setResetTarget(null)} />
        </>
    );
}
