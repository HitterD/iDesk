import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { CsiApi } from '../../api/csi.api';
import { useCsiReport } from '../../hooks/useCsi';
import { blobErrorMessage, downloadBlob } from '../../lib/csiAdmin';
import type { CsiReportRatee, CsiScopeParam, CsiSiteSummary } from '../../types';
import { AdminSection, EmptyNote } from './AdminParts';
import { byAverageDesc } from './report/reportModel';
import { ReportHero } from './report/ReportHero';
import { ScoreHeatmap } from './report/ScoreHeatmap';
import { SubjectDetailSheet } from './report/SubjectDetailSheet';
import { SubjectScoreCard } from './report/SubjectScoreCard';

const ALL_SITES = 'all';
type ReportView = 'cards' | 'heatmap';
const VIEW_OPTIONS = [{ value: 'cards', label: 'Kartu' }, { value: 'heatmap', label: 'Perbandingan' }] as const;

function ExportButton({ scope, periodId }: { scope: CsiScopeParam; periodId: string }) {
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        try {
            const { blob, filename } = await CsiApi.exportPeriod(scope, periodId);
            downloadBlob(blob, filename);
        } catch (error) {
            // skipToast on the request: this is the only toast for a failed export.
            toast.error(await blobErrorMessage(error));
        } finally {
            setBusy(false);
        }
    };
    return (
        <Button variant="soft" onClick={run} loading={busy}>
            {!busy && <Download aria-hidden="true" />}Export Excel
        </Button>
    );
}

function SubjectCards({ ratees, siteCodeOf, onOpen }: {
    ratees: CsiReportRatee[]; siteCodeOf: (siteId: string | null) => string | null; onOpen: (id: string) => void;
}) {
    return (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
            {ratees.map((ratee, index) => (
                <SubjectScoreCard key={ratee.periodRateeId} ratee={ratee} rank={index + 1} siteCode={siteCodeOf(ratee.siteId)}
                    onOpen={() => onOpen(ratee.periodRateeId)} />
            ))}
        </div>
    );
}

/** Readable report: hero, site filter, ranked subject cards (or heatmap) and a detail drawer per subject. */
export function PeriodReport({ scope, periodId, sites }: { scope: CsiScopeParam; periodId: string; sites: readonly CsiSiteSummary[] }) {
    const [site, setSite] = useState<string>(ALL_SITES);
    const [view, setView] = useState<ReportView>('cards');
    const [openId, setOpenId] = useState<string | null>(null);
    const { data: report, isLoading, isError, refetch } = useCsiReport(scope, periodId, site === ALL_SITES ? undefined : site);
    const siteOf = (siteId: string | null) => sites.find((row) => row.id === siteId) ?? null;
    const siteCodeOf = (siteId: string | null) => siteOf(siteId)?.code ?? null;
    const siteOptions = [{ value: ALL_SITES, label: 'Semua site' },
        ...sites.map((row) => ({ value: row.id, label: row.code ?? row.name ?? row.id }))];
    const ranked = report ? byAverageDesc(report.ratees) : [];
    const open = ranked.find((ratee) => ratee.periodRateeId === openId) ?? null;
    return (
        <AdminSection title="Laporan penilaian" description="Skala maksimal 5, dari rata-rata nilai setiap responden."
            actions={<ExportButton scope={scope} periodId={periodId} />}>
            <div className="grid gap-4">
                {sites.length > 1 && (
                    <SegmentedControl aria-label="Filter site laporan" className="dash-seg w-fit" options={siteOptions} value={site} onValueChange={setSite} />
                )}
                {isLoading && <div className="h-32 animate-pulse rounded-2xl bg-[hsl(var(--muted))] motion-reduce:animate-none" aria-busy="true" aria-label="Memuat laporan" />}
                {isError && <ErrorState compact message="Gagal memuat laporan." onRetry={() => refetch()} />}
                {report && <ReportHero report={report} />}
                {report && !ranked.length && <EmptyNote>Belum ada orang yang dinilai pada periode ini.</EmptyNote>}
                {report && ranked.length > 0 && (
                    <>
                        <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-[13px] font-semibold">{`Per subjek · ${ranked.length} subjek, urut dari nilai tertinggi`}</h3>
                            <SegmentedControl aria-label="Tampilan laporan" className="dash-seg ml-auto" options={VIEW_OPTIONS} value={view} onValueChange={setView} />
                        </div>
                        {view === 'cards'
                            ? <SubjectCards ratees={ranked} siteCodeOf={siteCodeOf} onOpen={setOpenId} />
                            : <ScoreHeatmap ratees={ranked} siteCodeOf={siteCodeOf} />}
                    </>
                )}
            </div>
            <SubjectDetailSheet ratee={open} siteName={open ? siteOf(open.siteId)?.name ?? null : null}
                siteCode={open ? siteCodeOf(open.siteId) : null} onClose={() => setOpenId(null)} />
        </AdminSection>
    );
}
