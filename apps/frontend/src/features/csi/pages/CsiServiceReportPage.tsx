import { useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { CsiHcApi } from '../api/csiHc.api';
import { HcRecapBody } from '../components/admin/hc/HcRecapPanel';
import { PendingByDepartment } from '../components/admin/hc/PendingByDepartment';
import { CSI_CARD, FadeIn } from '../components/CsiSurveyParts';
import { useCsiMyReportPeriods, useCsiMyServiceReport } from '../hooks/useCsiHc';
import { downloadBlob } from '../lib/csiAdmin';
import { formatDate } from '../lib/format';

const SERVICE_NAMES: Record<string, string> = { HCC: 'HC Compensation & Benefit', HCD: 'HC Development', HCS: 'HC Services' };
const SELECT = 'h-9 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * "Report CSI layanan": the HC service report for its report owners (every location). Ratings about the viewer are
 * anonymous; who has not answered is shown per department only. The combined report stays in the HC admin page.
 */
export function CsiServiceReportPage() {
    const { data: access, isLoading, isError, refetch } = useCsiMyReportPeriods();
    const [periodId, setPeriodId] = useState<string | null>(null);
    const [serviceCode, setServiceCode] = useState<string | null>(null);
    const period = periodId ?? access?.periods[0]?.id ?? null;
    const service = serviceCode ?? access?.services[0] ?? null;
    const report = useCsiMyServiceReport(period, service);
    const [exporting, setExporting] = useState(false);
    const download = async () => {
        if (!period || !service) return;
        setExporting(true);
        try {
            downloadBlob(await CsiHcApi.myServiceReportExport(period, service), `csi-hc-${service}.xlsx`);
        } catch {
            toast.error('Gagal mengunduh Excel.');
        } finally {
            setExporting(false);
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
                <p className={cn(CSI_CARD, 'p-6 text-[14px] text-muted-foreground')}>Akun Anda belum ditunjuk sebagai penanggung jawab report layanan HC. Hubungi admin HC.</p>
            )}
            {access && access.services.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <select aria-label="Survei" className={SELECT} value={period ?? ''} onChange={(event) => setPeriodId(event.target.value)}>
                        {access.periods.map((row) => <option key={row.id} value={row.id}>{`${row.title} (${formatDate(row.startDate)} – ${formatDate(row.endDate)})`}</option>)}
                    </select>
                    {access.services.length > 1 && (
                        <select aria-label="Layanan" className={SELECT} value={service ?? ''} onChange={(event) => setServiceCode(event.target.value)}>
                            {access.services.map((code) => <option key={code} value={code}>{`${code} · ${SERVICE_NAMES[code] ?? ''}`}</option>)}
                        </select>
                    )}
                    <Button variant="soft" className="ml-auto" disabled={!period || exporting} onClick={download}>
                        <Download aria-hidden="true" />{exporting ? 'Mengunduh…' : 'Unduh Excel'}
                    </Button>
                </div>
            )}
            {access && access.services.length > 0 && !access.periods.length && <p className={cn(CSI_CARD, 'p-6 text-[14px] text-muted-foreground')}>Belum ada survei HC yang terbit.</p>}
            {report.isError && <ErrorState title="Gagal memuat report layanan" message="Silakan coba lagi." onRetry={() => report.refetch()} />}
            {report.data && (
                <>
                    {report.data.pending && <PendingByDepartment rows={report.data.pending} className={cn(CSI_CARD, 'p-4')} />}
                    <section className={cn(CSI_CARD, 'p-4')}>
                        <h2 className="mb-3 text-[15px] font-bold">{`${report.data.serviceCode} · ${SERVICE_NAMES[report.data.serviceCode] ?? ''}`}</h2>
                        {report.data.services.length ? <HcRecapBody recap={report.data} expandAll /> : <p className="text-[13px] text-muted-foreground">Belum ada PIC layanan ini pada survei tersebut.</p>}
                    </section>
                </>
            )}
        </div>
    );
}

export default CsiServiceReportPage;
