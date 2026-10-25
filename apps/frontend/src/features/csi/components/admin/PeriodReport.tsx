import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { CsiApi } from '../../api/csi.api';
import { useCsiReport } from '../../hooks/useCsi';
import { blobErrorMessage, downloadBlob } from '../../lib/csiAdmin';
import { formatPercent, formatScore } from '../../lib/format';
import type { CsiReport, CsiScopeParam } from '../../types';
import { StarRating } from '../StarRating';
import { AdminSection, EmptyNote, MUTED_TEXT } from './AdminParts';

type ReportRow = CsiReport['ratees'][number];

function ReportRowView({ row }: { row: ReportRow }) {
    return (
        <tr className="border-b border-[hsl(var(--idesk-border)/.5)] last:border-0 align-top">
            <td className="px-4 py-3">
                <span className="block font-medium">{row.displayName}</span>
                {row.jobTitle && <span className={cn(MUTED_TEXT, 'block text-[12px]')}>{row.jobTitle}</span>}
            </td>
            <td className="px-4 py-3 tabular-nums">{row.respondentCount}</td>
            <td className="px-4 py-3">
                {row.average === null ? <span className={MUTED_TEXT}>—</span> : (
                    <span className="flex items-center gap-2">
                        <StarRating value={Math.round(row.average)} label={`Rata-rata ${row.displayName}`} size="sm" hideLabel />
                        <span className="font-semibold tabular-nums">{formatScore(row.average)}</span>
                    </span>
                )}
            </td>
            <td className="px-4 py-3 font-semibold tabular-nums">{formatPercent(row.indexPct)}</td>
            <td className="px-4 py-3">
                <span className="flex flex-wrap gap-1">
                    {row.dimensions.map((dimension) => (
                        <span key={dimension.name} className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-[12px] font-medium tabular-nums">
                            {`${dimension.name}: ${formatScore(dimension.average)}`}
                        </span>
                    ))}
                </span>
            </td>
        </tr>
    );
}

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

export function PeriodReport({ scope, periodId }: { scope: CsiScopeParam; periodId: string }) {
    const { data: report, isLoading, isError, refetch } = useCsiReport(scope, periodId);
    return (
        <AdminSection title="Laporan per orang" description="Rata-rata total = rata-rata dari rata-rata dimensi; indeks = total ÷ 5 × 100."
            actions={<ExportButton scope={scope} periodId={periodId} />}>
            {isLoading && <div className="h-32 animate-pulse rounded-2xl bg-[hsl(var(--muted))] motion-reduce:animate-none" aria-busy="true" aria-label="Memuat laporan" />}
            {isError && <ErrorState compact message="Gagal memuat laporan." onRetry={() => refetch()} />}
            {report && !report.ratees.length && <EmptyNote>Belum ada orang yang dinilai pada periode ini.</EmptyNote>}
            {report && report.ratees.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--idesk-border)/.7)]">
                    <table aria-label="Laporan per orang" className="w-full min-w-[720px] text-left text-[13.5px]">
                        <thead className={cn(MUTED_TEXT, 'text-[12px]')}>
                            <tr className="border-b border-[hsl(var(--idesk-border)/.7)]">
                                <th className="px-4 py-2.5 font-medium">Nama</th>
                                <th className="px-4 py-2.5 font-medium">Responden</th>
                                <th className="px-4 py-2.5 font-medium">Rata-rata</th>
                                <th className="px-4 py-2.5 font-medium">Indeks</th>
                                <th className="px-4 py-2.5 font-medium">Per dimensi</th>
                            </tr>
                        </thead>
                        <tbody>{report.ratees.map((row) => <ReportRowView key={row.periodRateeId} row={row} />)}</tbody>
                    </table>
                </div>
            )}
        </AdminSection>
    );
}
