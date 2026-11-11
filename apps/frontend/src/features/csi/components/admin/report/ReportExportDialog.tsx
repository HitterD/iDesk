import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Lock, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { SignoffEditor } from '@/features/reports/components/SignoffEditor';
import type { SignoffLayout } from '@/features/reports/signoff';
import { CsiApi } from '../../../api/csi.api';
import { blobErrorMessage, downloadBlob, RAW_EXPORT_HINT, RAW_EXPORT_LABEL } from '../../../lib/csiAdmin';
import type { CsiScopeParam } from '../../../types';

/** Same limit as the backend (CSI_REPORT_NOTES_MAX). */
export const REPORT_NOTES_MAX = 2000;

type Props = { scope: CsiScopeParam; periodId: string; siteId?: string; open: boolean; onOpenChange: (open: boolean) => void };
type Preview = { url: string; blob: Blob; filename: string };

/**
 * Executive report: preview the PDF, add "Catatan & tindak lanjut" (printed on page 1 and in the Excel "Ringkasan")
 * and adjust the sign-off, then download the PDF or Excel. The sign-off can be saved as the default of the CSI scope.
 */
export function ReportExportDialog({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="full" className="flex h-[90vh] w-[95vw] flex-col gap-3">
                <DialogHeader>
                    <DialogTitle>Laporan survei (PDF & Excel)</DialogTitle>
                    <DialogDescription>Periksa pratinjau, tambahkan catatan untuk atasan, atur tanda tangan, lalu unduh. Excel memuat parameter yang sama.</DialogDescription>
                </DialogHeader>
                {open && <ReportExportBody {...props} />}
            </DialogContent>
        </Dialog>
    );
}

type Result = { key: string; preview?: Preview; error?: string };

function ReportExportBody({ scope, periodId, siteId }: Omit<Props, 'open' | 'onOpenChange'>) {
    const [notes, setNotes] = useState('');
    const [applied, setApplied] = useState<{ notes: string; signoff: SignoffLayout | null }>({ notes: '', signoff: null });
    const [result, setResult] = useState<Result | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [draft, setDraft] = useState<SignoffLayout | null>(null);
    const [busy, setBusy] = useState<'signoff' | 'excel' | 'raw' | null>(null);
    const urlRef = useRef<string | null>(null);
    const key = JSON.stringify([siteId ?? null, applied]);
    const loading = result?.key !== key;
    const preview = loading ? null : result?.preview ?? null;
    const error = loading ? null : result?.error ?? null;

    useEffect(() => {
        let cancelled = false;
        CsiApi.exportPdf(scope, periodId, { siteId, notes: applied.notes, signoff: applied.signoff })
            .then(({ blob, filename }) => {
                if (cancelled) return;
                if (urlRef.current) URL.revokeObjectURL(urlRef.current);
                const url = URL.createObjectURL(blob);
                urlRef.current = url;
                setResult({ key, preview: { url, blob, filename } });
            })
            .catch(async (failure) => { if (!cancelled) setResult({ key, error: await blobErrorMessage(failure) }); });
        return () => { cancelled = true; };
    }, [scope, periodId, siteId, applied, key]);

    // Release the preview when the dialog closes.
    useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

    const openEditor = async () => {
        setEditorOpen(true);
        if (draft) return;
        try {
            setDraft(applied.signoff ?? await CsiApi.reportSignoff(scope));
        } catch (failure) {
            setEditorOpen(false);
            toast.error(await blobErrorMessage(failure));
        }
    };
    const signoffAction = async (action: () => Promise<SignoffLayout>, message: string) => {
        setBusy('signoff');
        try {
            const layout = await action();
            setDraft(layout);
            setApplied((current) => ({ ...current, signoff: null }));
            toast.success(message);
        } catch (failure) {
            toast.error(await blobErrorMessage(failure));
        } finally {
            setBusy(null);
        }
    };
    const download = async (kind: 'excel' | 'raw', request: () => Promise<{ blob: Blob; filename: string }>) => {
        setBusy(kind);
        try {
            const { blob, filename } = await request();
            downloadBlob(blob, filename);
        } catch (failure) {
            toast.error(await blobErrorMessage(failure));
        } finally {
            setBusy(null);
        }
    };
    const downloadExcel = () => download('excel', () => CsiApi.exportPeriod(scope, periodId, applied.notes));
    const downloadRaw = () => download('raw', () => CsiApi.exportPeriodRaw(scope, periodId));
    const notesChanged = notes.trim() !== applied.notes;

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
            <section className="flex min-h-[40vh] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-[hsl(var(--muted))]" aria-label="Pratinjau PDF">
                {loading && <p role="status" className="m-auto text-sm text-muted-foreground">Menyiapkan pratinjau…</p>}
                {!loading && error && <p role="alert" className="m-auto text-sm text-destructive">{error}</p>}
                {!loading && !error && preview && <iframe title="Pratinjau laporan CSI" src={preview.url} className="h-full w-full border-0" />}
            </section>
            <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-80">
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="csi-report-notes">
                    Catatan & tindak lanjut
                    <Textarea id="csi-report-notes" rows={6} maxLength={REPORT_NOTES_MAX} value={notes} onChange={(event) => setNotes(event.target.value)}
                        placeholder="Contoh: Pelatihan respon cepat untuk Site Karawang, evaluasi ulang bulan depan." />
                    <span className="text-xs font-normal text-muted-foreground">Satu baris = satu poin. Tampil di halaman 1 PDF dan sheet Ringkasan. {notes.length}/{REPORT_NOTES_MAX}</span>
                </label>
                <Button variant="soft" disabled={!notesChanged || loading} onClick={() => setApplied((current) => ({ ...current, notes: notes.trim() }))}>Terapkan catatan ke pratinjau</Button>
                <Button variant="soft" aria-pressed={editorOpen} onClick={() => (editorOpen ? setEditorOpen(false) : void openEditor())}>
                    <PenLine aria-hidden="true" />Tanda tangan
                </Button>
                <div className="mt-auto grid gap-2">
                    <Button disabled={!preview || loading || notesChanged} onClick={() => preview && downloadBlob(preview.blob, preview.filename)}>
                        <FileText aria-hidden="true" />Unduh PDF
                    </Button>
                    <Button variant="soft" loading={busy === 'excel'} disabled={notesChanged} onClick={downloadExcel}>
                        {busy !== 'excel' && <FileSpreadsheet aria-hidden="true" />}Unduh Excel
                    </Button>
                    <Button variant="subtle" loading={busy === 'raw'} title={RAW_EXPORT_HINT} aria-describedby="csi-raw-export-hint" onClick={downloadRaw}>
                        {busy !== 'raw' && <Lock aria-hidden="true" />}{RAW_EXPORT_LABEL}
                    </Button>
                    <p id="csi-raw-export-hint" className="text-xs text-muted-foreground">{RAW_EXPORT_HINT}</p>
                    {notesChanged && <p className="text-xs text-muted-foreground">Terapkan catatan dulu agar unduhan sama dengan pratinjau.</p>}
                </div>
            </aside>
            {editorOpen && draft && (
                <SignoffEditor value={draft} onChange={setDraft} onApply={() => setApplied((current) => ({ ...current, signoff: draft }))}
                    onSaveDefault={() => void signoffAction(() => CsiApi.saveReportSignoff(scope, draft), 'Tanda tangan default disimpan')}
                    onReset={() => void signoffAction(() => CsiApi.resetReportSignoff(scope), 'Tanda tangan dikembalikan ke bawaan')}
                    busy={busy === 'signoff'} />
            )}
        </div>
    );
}
