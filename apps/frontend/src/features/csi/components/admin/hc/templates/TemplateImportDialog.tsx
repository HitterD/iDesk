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

type Resolutions = Record<string, CsiTemplatePicResolution>;
type Unresolved = CsiTemplateImportReport['unresolved'];
/** A dry-run result and the resolutions it was computed with. */
interface Preview { report: CsiTemplateImportReport; key: string }

/** Complete decisions for the names of the file's first preview, in that order (also the cache key of a preview). */
function resolutionsOf(unresolved: Unresolved, choices: ImportChoices): Resolutions {
    return Object.fromEntries(unresolved.filter((item) => isChoiceComplete(choices[item.name])).map((item) => [item.name, choices[item.name]]));
}
const keyOf = (resolutions: Resolutions) => JSON.stringify(resolutions);

/**
 * Replacing needs a preview computed with exactly the current decisions (a pending or failed re-run leaves it
 * stale), every unknown name decided, and no problem rows (a skipped row would drop those people from the template).
 */
function canCommit(preview: Preview | null, failed: boolean, unresolved: Unresolved, choices: ImportChoices) {
    if (!preview || failed || preview.report.problems.length) return false;
    if (preview.key !== keyOf(resolutionsOf(unresolved, choices))) return false;
    return unresolved.every((item) => isChoiceComplete(choices[item.name]));
}

/**
 * Excel → template for one location: pick a file, read the dry-run summary (the file replaces the template), decide
 * unknown names (new team, new PIC or a typo of a suggestion; each complete decision re-runs the preview so the
 * counts include it), then replace. Errors are toasted by the API client; the dialog keeps its state for a retry.
 */
export function TemplateImportDialog({ scope, location, open, onOpenChange }: {
    scope: CsiScopeParam; location: TemplateLocation; open: boolean; onOpenChange: (open: boolean) => void;
}) {
    const importer = useTemplateImport(scope, location.code);
    const input = useRef<HTMLInputElement>(null);
    const latest = useRef(0);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    // Names to decide come from the file's first preview: later previews resolve them, the list must stay put.
    const [unresolved, setUnresolved] = useState<Unresolved>([]);
    const [failed, setFailed] = useState(false);
    const [choices, setChoices] = useState<ImportChoices>({});

    /** Only the newest dry run may land: a slow earlier one must not overwrite the summary. */
    const dryRun = async (target: File, resolutions: Resolutions, first: boolean) => {
        const request = ++latest.current;
        setFailed(false);
        try {
            const options = Object.keys(resolutions).length ? { commit: false, resolutions } : { commit: false };
            const report = await importer.mutateAsync({ file: target, options });
            if (request !== latest.current) return;
            setPreview({ report, key: keyOf(resolutions) });
            if (first) setUnresolved(report.unresolved);
        } catch {
            // The API client toasts the cause; the stale preview stays visible but cannot be saved.
            if (request === latest.current) setFailed(true);
        }
    };
    const pickFile = (picked: File) => {
        setFile(picked);
        setPreview(null);
        setUnresolved([]);
        setChoices({});
        void dryRun(picked, {}, true);
    };
    const choose = (name: string, choice: CsiTemplatePicResolution) => {
        const next = { ...choices, [name]: choice };
        setChoices(next);
        const resolutions = resolutionsOf(unresolved, next);
        if (file && keyOf(resolutions) !== keyOf(resolutionsOf(unresolved, choices))) void dryRun(file, resolutions, false);
    };
    const save = async () => {
        if (!file) return;
        try {
            await importer.mutateAsync({ file, options: { commit: true, resolutions: resolutionsOf(unresolved, choices) } });
            toast.success(`Template ${location.name} diganti`);
            onOpenChange(false);
        } catch {
            // Already toasted by the API client.
        }
    };
    const report = preview?.report ?? null;
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
                        <TemplateImportPreview report={report} unresolved={unresolved} locationName={location.name} choices={choices} onChoose={choose} />
                    )}
                    {failed && <p role="alert" className="text-[13px] font-medium text-[hsl(var(--destructive))]">{PREVIEW_FAILED}</p>}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button variant="primary" disabled={importer.isPending || !canCommit(preview, failed, unresolved, choices)} onClick={save}>Ganti template</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
