import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { useCsiReport, useCsiRespondents, useSendCsiReminders } from '../../hooks/useCsi';
import type { CsiReminderResult, CsiRespondents, CsiScopeParam, CsiSiteSummary, CsiSla } from '../../types';
import { AdminSection } from './AdminParts';
import { PersonList } from './respondents/PersonList';
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

/** LISTED only: per-site progress of the registered raters against the period target. */
function siteProgress(rows: readonly PersonRow[], sites: readonly CsiSiteSummary[], targetPct: number): SiteProgress[] {
    // Sites without any assigned rater are not part of the survey audience: no "0/0" cards.
    return sites.filter((site) => rows.some((row) => row.siteId === site.id)).map((site) => {
        const own = rows.filter((row) => row.siteId === site.id);
        return { siteId: site.id, code: site.code, name: site.name, progress: progressOf(own.filter((row) => row.done).length, own.length, targetPct) };
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

function StatusBody({ data, rows, sites, targetPct, reminders, onOpenResponse, basis, hcTarget }: {
    data: CsiRespondents; rows: PersonRow[]; sites: readonly CsiSiteSummary[]; targetPct: number;
    reminders: ReturnType<typeof useReminders>; onOpenResponse: (responseId: string) => void;
    basis: CsiSla | undefined;
    hcTarget?: boolean;
}) {
    const listed = data.mode === 'LISTED';
    const progress = basis ? overallProgress(data, basis) : null;
    return (
        <div className="grid gap-6">
            {progress && (
                <RespondentHero progress={progress} targetPct={targetPct} basisLabel={hcTarget ? 'target responden (HC)' : BASIS_LABEL[data.mode]}
                    sites={listed && sites.length > 1 ? siteProgress(rows, sites, targetPct) : []} />
            )}
            <PersonList rows={rows} sites={sites} canRemind={listed} reminded={reminders.reminded} remindingId={reminders.rowId}
                onRemind={reminders.remindOne} onOpenResponse={onOpenResponse} />
        </div>
    );
}

export function RespondentStatus({ scope, periodId, sites, onOpenResponse, hcTarget }: {
    scope: CsiScopeParam; periodId: string; sites: readonly CsiSiteSummary[]; onOpenResponse: (responseId: string) => void;
    /** Open HC survey with an HC target number of respondents (the participation basis). */
    hcTarget?: boolean;
}) {
    const { data, isLoading, isError, refetch } = useCsiRespondents(scope, periodId);
    const { data: report } = useCsiReport(scope, periodId);
    const reminders = useReminders(scope, periodId);
    const listed = data?.mode === 'LISTED';
    const rows = data ? personRows(data) : [];
    const pendingIds = rows.filter((row) => !row.done && row.userId && !reminders.reminded.has(row.userId)).map((row) => row.userId as string);
    const remindAll = listed && pendingIds.length > 0 && (
        <Button variant="soft" onClick={() => reminders.remindAll(pendingIds)} loading={reminders.allPending}>
            {!reminders.allPending && <BellRing aria-hidden="true" />}Ingatkan semua yang belum
        </Button>
    );
    return (
        <AdminSection title="Status responden" actions={remindAll || undefined}
            description={data && !listed ? openDescription(!!hcTarget) : undefined}>
            {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--muted))] motion-reduce:animate-none" aria-busy="true" aria-label="Memuat responden" />}
            {isError && <ErrorState compact message="Gagal memuat status responden." onRetry={() => refetch()} />}
            {data && (
                <StatusBody data={data} rows={rows} sites={sites} targetPct={report?.sla.targetPct ?? 0} reminders={reminders}
                    onOpenResponse={onOpenResponse} basis={report?.sla} hcTarget={hcTarget} />
            )}
        </AdminSection>
    );
}
