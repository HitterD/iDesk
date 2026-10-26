import { AlertCircle, Check, Loader2 } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
const COPY = { saving: 'Menyimpan…', saved: 'Tersimpan', fallbackError: 'Gagal menyimpan' } as const;

/** Tiny per-card autosave status; always mounted so screen readers announce changes (aria-live polite). */
export function SaveStatusText({ status, error }: { status: SaveStatus; error: string | null }) {
    return (
        <span aria-live="polite" className="inline-flex min-h-5 items-center gap-1 text-[12px] text-[hsl(var(--idesk-text-secondary))]">
            {status === 'saving' && <><Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />{COPY.saving}</>}
            {status === 'saved' && <><Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />{COPY.saved}</>}
            {status === 'error' && (
                <span className="inline-flex items-center gap-1 font-medium text-[hsl(var(--destructive))]">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />{error ?? COPY.fallbackError}
                </span>
            )}
        </span>
    );
}
