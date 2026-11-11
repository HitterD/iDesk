import { useState } from 'react';
import { BarChart3, Download, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { CsiHcApi } from '../api/csiHc.api';
import { HcRecapBody } from '../components/admin/hc/HcRecapPanel';
import { PendingByDepartment } from '../components/admin/hc/PendingByDepartment';
import { CSI_CARD, FadeIn } from '../components/CsiSurveyParts';
import { useCsiMyReportAccess, useCsiMyReportPeriods, useCsiMyServiceReport } from '../hooks/useCsiHc';
import { serviceLabel } from '../lib/services';
import type { CsiScopeParam } from '../types';
import { downloadBlob, RAW_EXPORT_HINT, RAW_EXPORT_LABEL } from '../lib/csiAdmin';
import { formatDate } from '../lib/format';

const SELECT = 'h-9 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Which units (HC / ICT) the account owns a report in; HC first. */
function useReportScopes() {
    const hc = useCsiMyReportAccess('hc');
    const ict = useCsiMyReportAccess('ict');
    const scopes = ([['hc', hc.data], ['ict', ict.data]] as const).filter(([, access]) => (access?.services.length ?? 0) > 0).map(([scope]) => scope);
    return { scopes, loading: hc.isLoading || ict.isLoading };
}

/**
 * "Report CSI layanan": the service report of an HC layanan or an ICT team for its report owners (every location).
 * Ratings about the viewer are anonymous; who has not answered is shown per department only. The combined report
 * stays in the admin page.
 */
export function CsiServiceReportPage() {
    const owned = useReportScopes();
    const [chosenScope, setChosenScope] = useState<CsiScopeParam | null>(null);
    const scope: CsiScopeParam = chosenScope ?? owned.scopes[0] ?? 'hc';
    const { data: access, isLoading: periodsLoading, isError, refetch } = useCsiMyReportPeriods(scope, !owned.loading);
    const isLoading = owned.loading || periodsLoading;
    const [periodId, setPeriodId] = useState<string | null>(null);
    const [serviceCode, setServiceCode] = useState<string | null>(null);
    const period = periodId ?? access?.periods[0]?.id ?? null;
    const service = serviceCode ?? access?.services[0] ?? null;
    const report = useCsiMyServiceReport(scope, period, service);
    const switchScope = (next: CsiScopeParam) => { setChosenScope(next); setPeriodId(null); setServiceCode(null); };
    const [exporting, setExporting] = useState<'excel' | 'raw' | null>(null);
    const download = async (kind: 'excel' | 'raw') => {
        if (!period || !service) return;
        setExporting(kind);
        try {
            const raw = kind === 'raw';
            const blob = await (raw ? CsiHcApi.myServiceReportRawExport : CsiHcApi.myServiceReportExport)(scope, period, service);
            downloadBlob(blob, `csi-${scope}-${service}${raw ? ' - DATA MENTAH (RAHASIA)' : ''}.xlsx`);
        } catch {
            toast.error('Gagal mengunduh Excel.');
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            <FadeIn className="space-y-1.5 pt-1">
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-[28px]"><BarChart3 className="h-6 w-6" aria-hidden="true" />Report CSI layanan</h1>
                <p className="text-[14px] text-muted-foreground">Hasil penilaian layanan Anda di semua lokasi. Penilaian tentang diri Anda sendiri ditampilkan tanpa nama penilai.</p>
            </FadeIn>
            {isLoading && <div className={cn(CSI_CARD, 'h-40 animate-pulse')} aria-busy="true" />}
            {isError && <ErrorState title="Gagal memuat report" message="Silakan coba lagi." onRetry={() => refetch()} />}
            {access && !access.services.length && (
                <p className={cn(CSI_CARD, 'p-6 text-[14px] text-muted-foreground')}>Akun Anda belum ditunjuk sebagai penanggung jawab report layanan. Hubungi admin CSI.</p>
            )}
            {access && access.services.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {owned.scopes.length > 1 && (
                        <select aria-label="Unit" className={SELECT} value={scope} onChange={(event) => switchScope(event.target.value as CsiScopeParam)}>
                            {owned.scopes.map((code) => <option key={code} value={code}>{code === 'hc' ? 'HC' : 'ICT'}</option>)}
                        </select>
                    )}
                    <select aria-label="Survei" className={SELECT} value={period ?? ''} onChange={(event) => setPeriodId(event.target.value)}>
                        {access.periods.map((row) => <option key={row.id} value={row.id}>{`${row.title} (${formatDate(row.startDate)} – ${formatDate(row.endDate)})`}</option>)}
                    </select>
                    {access.services.length > 1 && (
                        <select aria-label="Layanan" className={SELECT} value={service ?? ''} onChange={(event) => setServiceCode(event.target.value)}>
                            {access.services.map((code) => <option key={code} value={code}>{serviceLabel(scope, code)}</option>)}
                        </select>
                    )}
                    <Button variant="soft" className="ml-auto" disabled={!period || !!exporting} onClick={() => void download('excel')}>
                        <Download aria-hidden="true" />{exporting === 'excel' ? 'Mengunduh…' : 'Unduh Excel'}
                    </Button>
                    <Button variant="subtle" disabled={!period || !!exporting} title={RAW_EXPORT_HINT} onClick={() => void download('raw')}>
                        <Lock aria-hidden="true" />{exporting === 'raw' ? 'Mengunduh…' : RAW_EXPORT_LABEL}
                    </Button>
                </div>
            )}
            {access && access.services.length > 0 && !access.periods.length && <p className={cn(CSI_CARD, 'p-6 text-[14px] text-muted-foreground')}>Belum ada survei HC yang terbit.</p>}
            {report.isError && <ErrorState title="Gagal memuat report layanan" message="Silakan coba lagi." onRetry={() => report.refetch()} />}
            {report.data && (
                <>
                    {report.data.pending && <PendingByDepartment rows={report.data.pending} className={cn(CSI_CARD, 'p-4')} />}
                    <section className={cn(CSI_CARD, 'p-4')}>
                        <h2 className="mb-3 text-[15px] font-bold">{serviceLabel(scope, report.data.serviceCode)}</h2>
                        {report.data.services.length ? <HcRecapBody recap={report.data} expandAll /> : <p className="text-[13px] text-muted-foreground">Belum ada PIC layanan ini pada survei tersebut.</p>}
                    </section>
                </>
            )}
        </div>
    );
}

export default CsiServiceReportPage;
