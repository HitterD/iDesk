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
import { isChoiceComplete, TemplateImportPreview, type ImportChoices, type PruneState } from './TemplateImportPreview';

const NO_PRUNE: PruneState = { prune: false, pruneConfirmed: false };
const PREVIEW_FAILED = 'Pratinjau gagal dimuat, coba lagi';

/** A dry-run result together with the prune options it was computed for. */
interface Preview { report: CsiTemplateImportReport; options: PruneState }

const sameOptions = (a: PruneState, b: PruneState) => a.prune === b.prune && a.pruneConfirmed === b.pruneConfirmed;

/**
 * Save only commits what was previewed: the report must belong to exactly the current prune options (a failed or
 * pending re-run leaves it stale), every unknown name must be decided, and pruning is refused while rows failed to
 * parse (they would look absent).
 */
function canCommit(preview: Preview | null, choices: ImportChoices, prune: PruneState) {
    if (!preview || !sameOptions(preview.options, prune)) return false;
    if (prune.prune && preview.report.problems.length) return false;
    return preview.report.unresolved.every((item) => isChoiceComplete(choices[item.name]));
}

/**
 * Excel → template for one location: pick a file, read the dry-run diff, decide unknown names (new team, new PIC or
 * a typo of a suggestion), optionally prune what the file no longer lists, then save. Errors are toasted by the API
 * client; the dialog keeps its state so the user can retry.
 */
export function TemplateImportDialog({ scope, location, open, onOpenChange }: {
    scope: CsiScopeParam; location: TemplateLocation; open: boolean; onOpenChange: (open: boolean) => void;
}) {
    const importer = useTemplateImport(scope, location.code);
    const input = useRef<HTMLInputElement>(null);
    const latest = useRef(0);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [failed, setFailed] = useState(false);
    const report = preview?.report ?? null;
    const [choices, setChoices] = useState<ImportChoices>({});
    const [prune, setPrune] = useState<PruneState>(NO_PRUNE);

    /** Only the newest dry run may land: a slow earlier one must not overwrite the prune counts. */
    const dryRun = async (target: File, nextPrune: PruneState) => {
        const request = ++latest.current;
        setFailed(false);
        try {
            const result = await importer.mutateAsync({ file: target, options: { commit: false, ...nextPrune } });
            if (request === latest.current) setPreview({ report: result, options: nextPrune });
        } catch {
            // The API client toasts the cause; the stale preview stays visible but cannot be saved.
            if (request === latest.current) setFailed(true);
        }
    };
    const pickFile = (picked: File) => {
        setFile(picked);
        setPreview(null);
        setChoices({});
        setPrune(NO_PRUNE);
        void dryRun(picked, NO_PRUNE);
    };
    const changePrune = (next: PruneState) => {
        setPrune(next);
        // Both switches change the removal counts (confirmed raters join it), so ask the backend again.
        // Resolutions stay out of dry runs: the unresolved list must stay put while the user is deciding.
        if (file) void dryRun(file, next);
    };
    const save = async () => {
        if (!file) return;
        // Only names still unresolved in the latest preview; choices for a previous file are dropped on pick.
        const resolutions: Record<string, CsiTemplatePicResolution> = Object.fromEntries(
            (report?.unresolved ?? []).map((item) => [item.name, choices[item.name]]).filter(([, choice]) => !!choice));
        try {
            await importer.mutateAsync({ file, options: { commit: true, ...prune, resolutions } });
            toast.success(`Template ${location.name} diperbarui`);
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
                    <DialogDescription>Pratinjau dulu; template baru berubah setelah Simpan.</DialogDescription>
                </DialogHeader>
                {/* Only the body scrolls: a long unresolved list must not push Simpan/Batal off-screen. */}
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
                        <TemplateImportPreview report={report} choices={choices} prune={prune} onPrune={changePrune}
                            onChoose={(name, choice) => setChoices((current) => ({ ...current, [name]: choice }))} />
                    )}
                    {failed && <p role="alert" className="text-[13px] font-medium text-[hsl(var(--destructive))]">{PREVIEW_FAILED}</p>}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button variant="primary" disabled={importer.isPending || !canCommit(preview, choices, prune)} onClick={save}>Simpan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
