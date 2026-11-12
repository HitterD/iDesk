import { useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTemplateImport } from '../../../../hooks/useCsiHc';
import type { CsiTemplateImportReport, CsiTemplatePicResolution } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { MUTED_TEXT } from '../../AdminParts';
import type { TemplateLocation } from './TemplateEmptyState';
import { isChoiceComplete, TemplateImportPreview, type ImportChoices } from './TemplateImportPreview';

const PREVIEW_FAILED = 'Pratinjau gagal dimuat, coba lagi';

/**
 * Replacing needs a preview of this file, every unknown name decided, and no problem rows (a skipped row would drop
 * those people from the template).
 */
function canCommit(report: CsiTemplateImportReport | null, failed: boolean, choices: ImportChoices) {
    if (!report || failed || report.problems.length) return false;
    return report.unresolved.every((item) => isChoiceComplete(choices[item.name]));
}

/**
 * Excel → template for one location: pick a file, read the dry-run summary (the file replaces the template), decide
 * unknown names (new team, new PIC or a typo of a suggestion), then replace. Errors are toasted by the API client;
 * the dialog keeps its state so the user can retry.
 */
export function TemplateImportDialog({ scope, location, open, onOpenChange }: {
    scope: CsiScopeParam; location: TemplateLocation; open: boolean; onOpenChange: (open: boolean) => void;
}) {
    const importer = useTemplateImport(scope, location.code);
    const input = useRef<HTMLInputElement>(null);
    const latest = useRef(0);
    const [file, setFile] = useState<File | null>(null);
    const [report, setReport] = useState<CsiTemplateImportReport | null>(null);
    const [failed, setFailed] = useState(false);
    const [choices, setChoices] = useState<ImportChoices>({});

    /** Only the newest dry run may land: a slow one for an earlier file must not overwrite the summary. */
    const dryRun = async (target: File) => {
        const request = ++latest.current;
        setFailed(false);
        try {
            // Resolutions stay out of dry runs: the unresolved list must stay put while the user is deciding.
            const result = await importer.mutateAsync({ file: target, options: { commit: false } });
            if (request === latest.current) setReport(result);
        } catch {
            // The API client toasts the cause; the stale preview stays visible but cannot be saved.
            if (request === latest.current) setFailed(true);
        }
    };
    const pickFile = (picked: File) => {
        setFile(picked);
        setReport(null);
        setChoices({});
        void dryRun(picked);
    };
    const save = async () => {
        if (!file) return;
        // Only names still unresolved in the latest preview; choices for a previous file are dropped on pick.
        const resolutions: Record<string, CsiTemplatePicResolution> = Object.fromEntries(
            (report?.unresolved ?? []).map((item) => [item.name, choices[item.name]]).filter(([, choice]) => !!choice));
        try {
            await importer.mutateAsync({ file, options: { commit: true, resolutions } });
            toast.success(`Template ${location.name} diganti`);
            onOpenChange(false);
        } catch {
            // Already toasted by the API client.
        }
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] max-w-xl grid-rows-[auto_minmax(0,1fr)_auto]">
                <DialogHeader>
                    <DialogTitle>{`Impor Excel – ${location.name}`}</DialogTitle>
                    <DialogDescription>Isi file menggantikan seluruh template lokasi ini. Pratinjau dulu; template berubah setelah Ganti template.</DialogDescription>
                </DialogHeader>
                {/* Only the body scrolls: a long unresolved list must not push the footer buttons off-screen. */}
                <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <input ref={input} type="file" accept=".xlsx" aria-label="File Excel" className="hidden" onChange={(event) => {
                            const picked = event.target.files?.[0];
                            if (picked) pickFile(picked);
                            event.target.value = '';
                        }} />
                        <Button variant="soft" disabled={importer.isPending} onClick={() => input.current?.click()}>
                            <FileSpreadsheet aria-hidden="true" />{file ? 'Ganti file' : 'Pilih file .xlsx'}
                        </Button>
                        <span className={MUTED_TEXT}>{importer.isPending ? 'Membaca file…' : file?.name ?? 'Belum ada file'}</span>
                    </div>
                    {report && (
                        <TemplateImportPreview report={report} locationName={location.name} choices={choices}
                            onChoose={(name, choice) => setChoices((current) => ({ ...current, [name]: choice }))} />
                    )}
                    {failed && <p role="alert" className="text-[13px] font-medium text-[hsl(var(--destructive))]">{PREVIEW_FAILED}</p>}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button variant="primary" disabled={importer.isPending || !canCommit(report, failed, choices)} onClick={save}>Ganti template</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
