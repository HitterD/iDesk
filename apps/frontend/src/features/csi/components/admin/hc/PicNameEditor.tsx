import { useState, type ReactNode } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CSI_PIC_NAME_MAX, CSI_PIC_NAME_MIN } from '../../../hcTypes';

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

export interface PicNameEditorProps {
    /** Name as stored (any case); the edit starts from `display`. */
    display: string;
    /** Rendered name (the caller's typography). */
    children: ReactNode;
    pending?: boolean;
    /** Resolves when saved; a rejection keeps the input open (the API layer already shows the error). */
    onSave: (fullName: string) => Promise<unknown>;
    className?: string;
}

/**
 * PIC name with a pencil: an input with save/cancel (Enter saves, Escape cancels). The rename is the single PIC master
 * rename, so every place that shows the PIC follows.
 */
export function PicNameEditor({ display, children, pending, onSave, className }: PicNameEditorProps) {
    const [draft, setDraft] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    if (draft === null) {
        return (
            <span className={cn('flex min-w-0 items-start gap-1', className)}>
                {children}
                <button type="button" aria-label={`Ubah nama ${display}`} disabled={pending} onClick={() => setDraft(display)}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-[hsl(var(--muted))]">
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                </button>
            </span>
        );
    }
    const value = clean(draft);
    const valid = value.length >= CSI_PIC_NAME_MIN && value.length <= CSI_PIC_NAME_MAX;
    const cancel = () => setDraft(null);
    const save = async () => {
        if (!valid || saving) return;
        if (value === clean(display)) { cancel(); return; }
        setSaving(true);
        try {
            await onSave(value);
            setDraft(null);
        } catch {
            // Stay in edit mode so the admin can correct the name.
        } finally {
            setSaving(false);
        }
    };
    return (
        <span className={cn('flex min-w-0 items-center gap-1', className)}>
            <input autoFocus aria-label="Nama PIC" value={draft} maxLength={CSI_PIC_NAME_MAX} disabled={saving} aria-invalid={!valid}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); void save(); }
                    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
                }}
                className="min-w-0 flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-2 py-1 text-[13px] font-semibold" />
            <button type="button" aria-label="Simpan nama" disabled={!valid || saving} onClick={() => void save()}
                className="shrink-0 rounded p-1 text-[hsl(var(--ticket-green-ink))] hover:bg-[hsl(var(--muted))] disabled:opacity-40">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Batal ubah nama" disabled={saving} onClick={cancel}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-[hsl(var(--muted))]">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
        </span>
    );
}
