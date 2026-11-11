import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useCsiReport } from '../../hooks/useCsi';
import { CSI_SCORE_BANDS_DEFAULT, type CsiScoreBands } from '../../lib/csiTone';
import type { CsiReportRatee, CsiScopeParam, CsiSiteSummary } from '../../types';
import { AdminSection, EmptyNote } from './AdminParts';
import { byAverageDesc } from './report/reportModel';
import { ReportHero } from './report/ReportHero';
import { ScoreHeatmap } from './report/ScoreHeatmap';
import { SubjectDetailSheet } from './report/SubjectDetailSheet';
import { SubjectScoreCard } from './report/SubjectScoreCard';
import { RaterMatrixPanel } from './report/RaterMatrixPanel';
import { ReportExportDialog } from './report/ReportExportDialog';
import { HcRecapPanel } from './hc/HcRecapPanel';

const ALL_SITES = 'all';
type ReportView = 'cards' | 'heatmap';
const VIEW_OPTIONS = [{ value: 'cards', label: 'Kartu' }, { value: 'heatmap', label: 'Perbandingan' }] as const;

function SubjectCards({ ratees, siteCodeOf, bands, onOpen }: {
    ratees: CsiReportRatee[]; siteCodeOf: (siteId: string | null) => string | null; bands: CsiScoreBands; onOpen: (id: string) => void;
}) {
    return (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
            {ratees.map((ratee, index) => (
                <SubjectScoreCard key={ratee.periodRateeId} ratee={ratee} rank={index + 1} siteCode={siteCodeOf(ratee.siteId)} bands={bands}
                    onOpen={() => onOpen(ratee.periodRateeId)} />
            ))}
        </div>
    );
}

/** Readable report: hero, site filter, ranked subject cards (or heatmap) and a detail drawer per subject. */
export function PeriodReport({ scope, periodId, sites, initialSiteId }: {
    scope: CsiScopeParam; periodId: string; sites: readonly CsiSiteSummary[]; initialSiteId?: string | null;
}) {
    const [site, setSite] = useState<string>(initialSiteId && sites.some((row) => row.id === initialSiteId) ? initialSiteId : ALL_SITES);
    const siteParam = site === ALL_SITES ? undefined : site;
    const [view, setView] = useState<ReportView>('cards');
    const [openId, setOpenId] = useState<string | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const { data: report, isLoading, isError, refetch } = useCsiReport(scope, periodId, siteParam);
    const siteOf = (siteId: string | null) => sites.find((row) => row.id === siteId) ?? null;
    const siteCodeOf = (siteId: string | null) => siteOf(siteId)?.code ?? null;
    const siteOptions = [{ value: ALL_SITES, label: 'Semua site' },
        ...sites.map((row) => ({ value: row.id, label: row.code ?? row.name ?? row.id }))];
    const ranked = report ? byAverageDesc(report.ratees) : [];
    const open = ranked.find((ratee) => ratee.periodRateeId === openId) ?? null;
    // The sheet stays mounted while the report loads; it needs bands before any report exists.
    const bands = report?.scoreBands ?? CSI_SCORE_BANDS_DEFAULT;
    return (
        <>
        <AdminSection title="Laporan penilaian" description="Skala maksimal 5, dari rata-rata nilai setiap responden."
            actions={(
                <Button variant="soft" onClick={() => setExportOpen(true)}><FileText aria-hidden="true" />Laporan PDF & Excel</Button>
            )}>
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
                            ? <SubjectCards ratees={ranked} siteCodeOf={siteCodeOf} bands={bands} onOpen={setOpenId} />
                            : <ScoreHeatmap ratees={ranked} siteCodeOf={siteCodeOf} bands={bands} />}
                    </>
                )}
            </div>
            <SubjectDetailSheet ratee={open} siteName={open ? siteOf(open.siteId)?.name ?? null : null}
                siteCode={open ? siteCodeOf(open.siteId) : null} bands={bands} onClose={() => setOpenId(null)} />
        </AdminSection>
        {scope === 'hc' && <HcRecapPanel scope={scope} periodId={periodId} />}
        <RaterMatrixPanel scope={scope} periodId={periodId} siteId={siteParam} bands={bands} />
        <ReportExportDialog scope={scope} periodId={periodId} siteId={siteParam} open={exportOpen} onOpenChange={setExportOpen} />
        </>
    );
}
