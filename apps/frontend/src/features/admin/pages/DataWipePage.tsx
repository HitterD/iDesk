import React, { useState } from 'react';
import { ShieldAlert, ScanSearch, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { WipeScopeSelector } from '../components/data-wipe/WipeScopeSelector';
import { WipePreviewTable } from '../components/data-wipe/WipePreviewTable';
import { WipeResultSummary } from '../components/data-wipe/WipeResultSummary';
import { WipeConfirmDialog, WIPE_CONFIRM_PHRASE } from '../components/data-wipe/WipeConfirmDialog';
import { WipeDomain, useDataWipe } from '../hooks/useDataWipe';
import { ResHead } from '@/components/resources/ResourceParts';
import '@/components/management/management.css';

/**
 * Danger zone: permanently clears ticketing, e-form and hardware-request data
 * so a production go-live can start from zero.
 *
 * The flow is deliberately three separate steps — pick, preview, type-to-confirm
 * — and each step invalidates the next: changing the selection drops the preview
 * token, so an approved preview can never be executed against a different scope.
 */
export const DataWipePage: React.FC = () => {
    const [domains, setDomains] = useState<WipeDomain[]>([]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const {
        preview,
        result,
        isPreviewing,
        isExecuting,
        runPreview,
        execute,
        clearPreview,
        clearResult,
    } = useDataWipe();

    const busy = isPreviewing || isExecuting;
    const previewHasData = Boolean(
        preview &&
        (preview.totalRows > 0 ||
            preview.files.fileCount > 0 ||
            preview.counterResets.some((counter) => counter.rows > 0)),
    );

    const handleDomainChange = (next: WipeDomain[]) => {
        setDomains(next);
        // A preview belongs to the exact scope it was counted for.
        if (preview) clearPreview();
    };

    const handlePreview = async () => {
        try {
            await runPreview(domains);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal memuat pratinjau data.');
        }
    };

    const handleExecute = async () => {
        if (!preview) return;
        try {
            const outcome = await execute(preview.token, WIPE_CONFIRM_PHRASE);
            setConfirmOpen(false);
            setDomains([]);
            toast.success(
                `Berhasil menghapus ${outcome.totalRowsDeleted.toLocaleString('id-ID')} baris data.`,
            );
        } catch (error: any) {
            setConfirmOpen(false);
            toast.error(
                error.response?.data?.message ||
                'Penghapusan gagal. Tidak ada data yang dihapus — periksa log audit.',
            );
        }
    };

    const handleReset = () => {
        setDomains([]);
        clearPreview();
        clearResult();
    };

    return (
        <div className="res-page mg-page is-narrow space-y-4">
            <ResHead icon={ShieldAlert} tone="red" title="Hapus Data Transaksional"
                description="Mengosongkan data tiketing, e-form, dan hardware request untuk go-live produksi" />

            <div className="rounded-2xl border border-bad/30 bg-bad/10 p-5">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bad text-white">
                        <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                        <h2 className="text-base font-black tracking-tight text-bad-ink">
                            Tindakan ini permanen
                        </h2>
                        <ul className="space-y-1 text-sm leading-relaxed text-bad-ink">
                            <li>
                                Data yang terhapus tidak dapat dikembalikan melalui aplikasi. Backup
                                pengaman dibuat otomatis dan wajib berhasil sebelum penghapusan dimulai.
                            </li>
                            <li>
                                Pengguna, hak akses, master data, konfigurasi sistem, dan backup Synology
                                <span className="font-semibold"> tidak tersentuh</span>.
                            </li>
                            <li>
                                Penomoran tiket dan permintaan hardware akan dimulai ulang dari 0001.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {result ? (
                <WipeResultSummary result={result} onReset={handleReset} />
            ) : (
                <>
                    <section className="space-y-3">
                        <StepHeading step={1} title="Pilih data yang akan dihapus" />
                        <WipeScopeSelector
                            selected={domains}
                            disabled={busy}
                            onChange={handleDomainChange}
                        />
                    </section>

                    <section className="space-y-3">
                        <StepHeading
                            step={2}
                            title="Tinjau jumlah data"
                            hint="Wajib dijalankan sebelum penghapusan"
                        />
                        <button
                            type="button"
                            onClick={handlePreview}
                            disabled={domains.length === 0 || busy}
                            className={cn(
                                'flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition-colors',
                                'hover:bg-fill dark:bg-surface',
                                'disabled:cursor-not-allowed disabled:opacity-50',
                            )}
                        >
                            {isPreviewing ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <ScanSearch className="h-4 w-4" aria-hidden="true" />
                            )}
                            {preview ? 'Muat Ulang Pratinjau' : 'Jalankan Pratinjau'}
                        </button>

                        {domains.length === 0 && (
                            <p className="text-xs text-ink-2">
                                Pilih minimal satu domain data terlebih dahulu.
                            </p>
                        )}

                        {preview && <WipePreviewTable preview={preview} />}
                    </section>

                    <section className="space-y-3">
                        <StepHeading step={3} title="Konfirmasi penghapusan" />
                        {!preview && (
                            <div className="flex items-center gap-2 text-xs text-ink-2">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>Tombol penghapusan aktif setelah pratinjau dijalankan.</span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setConfirmOpen(true)}
                            disabled={!preview || !previewHasData || busy}
                            className={cn(
                                'flex min-h-[44px] items-center gap-2 rounded-xl bg-bad px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors',
                                'hover:bg-bad/90 disabled:cursor-not-allowed disabled:opacity-50',
                            )}
                        >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Hapus Data Permanen
                        </button>
                        {preview && !previewHasData && (
                            <p className="text-xs text-ink-2">
                                Tidak ada data, lampiran, atau counter yang perlu dibersihkan pada domain terpilih.
                            </p>
                        )}
                    </section>
                </>
            )}

            <WipeConfirmDialog
                isOpen={confirmOpen}
                domains={domains}
                totalRows={preview?.totalRows ?? 0}
                isExecuting={isExecuting}
                onConfirm={handleExecute}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
};

const StepHeading: React.FC<{ step: number; title: string; hint?: string }> = ({
    step,
    title,
    hint,
}) => (
    <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-code font-mono text-xs font-black text-white">
            {step}
        </span>
        <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-sm font-bold text-ink">{title}</h3>
            {hint && <span className="text-xs text-ink-2">{hint}</span>}
        </div>
    </div>
);

export default DataWipePage;
