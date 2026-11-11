import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmRaters } from '../../../../hooks/useCsiHc';
import type { CsiTemplatePic } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { titleCase } from '../hcFormat';
import { AddRaterField, RaterRow, type AddRaterBody } from './RaterRow';

const FUNCTION_MAX = 150;

function ServiceFunctionEditor({ pic, onSave }: { pic: CsiTemplatePic; onSave: (value: string | null) => void }) {
    const [draft, setDraft] = useState<string | null>(null);
    if (draft === null) {
        return (
            <p className="mt-1 flex items-start gap-1 text-[12.5px]">
                <span className={pic.serviceFunction ? 'font-semibold text-[hsl(var(--idesk-sapphire))]' : 'italic text-muted-foreground'}>
                    {pic.serviceFunction ?? 'Fungsi pelayanan belum diisi'}
                </span>
                <button type="button" aria-label="Ubah fungsi pelayanan" onClick={() => setDraft(pic.serviceFunction ?? '')} className="rounded p-0.5 hover:bg-[hsl(var(--muted))]">
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                </button>
            </p>
        );
    }
    const save = () => { onSave(draft.trim() || null); setDraft(null); };
    return (
        <input autoFocus aria-label="Fungsi pelayanan" value={draft} maxLength={FUNCTION_MAX} onChange={(event) => setDraft(event.target.value)} onBlur={save}
            onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); save(); }
                if (event.key === 'Escape') setDraft(null);
            }}
            className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-2 py-1 text-[12.5px]" />
    );
}

export interface TemplatePicCardProps {
    scope: CsiScopeParam;
    templateId: string;
    pic: CsiTemplatePic;
    pending: boolean;
    onServiceFunction: (value: string | null) => void;
    onAddRater: (body: AddRaterBody) => void;
    onRemoveRater: (raterId: string) => void;
    onRemovePic: () => void;
}

/** One PIC (or team) of a template: name, title, editable service function and the raters with their account match. */
export function TemplatePicCard({ scope, templateId, pic, pending, onServiceFunction, onAddRater, onRemoveRater, onRemovePic }: TemplatePicCardProps) {
    const confirm = useConfirmRaters(scope);
    const busy = pending || confirm.isPending;
    const okIds = pic.raters.filter((rater) => rater.status === 'ok').map((rater) => rater.id);
    const confirmRows = (raterIds: string[]) => confirm.mutate({ raterIds, confirmed: true });
    return (
        <section aria-label={pic.picName} className="grid gap-2 rounded-2xl bg-[hsl(var(--idesk-surface))] p-3 ring-1 ring-[hsl(var(--border)/.7)]">
            <header className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 break-words text-[13.5px] font-bold">
                        {titleCase(pic.picName)}
                        {pic.teamId && <span className="rounded-full bg-[hsl(var(--idesk-sapphire)/.12)] px-1.5 text-[11px] font-semibold text-[hsl(var(--idesk-sapphire))]">Tim</span>}
                    </p>
                    <p className="text-[12px] text-muted-foreground">{titleCase(pic.jobTitle ?? '')}{!pic.picId && !pic.teamId && ' · belum cocok dengan PIC master'}</p>
                    <ServiceFunctionEditor key={pic.serviceFunction ?? ''} pic={pic} onSave={(value) => value !== pic.serviceFunction && onServiceFunction(value)} />
                </div>
                <button type="button" aria-label={`Hapus ${pic.picName} dari template`} disabled={busy} onClick={onRemovePic}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--muted))]">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </header>
            <div className="flex items-center gap-2">
                <p className="flex-1 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">{pic.raterCount ? `${pic.raterCount} penilai` : 'Belum ada penilai'}</p>
                {okIds.length > 0 && (
                    <Button variant="subtle" size="sm" disabled={busy} onClick={() => confirmRows(okIds)}
                        title="Konfirmasi hanya penilai berstatus Cocok otomatis di kartu ini">{`Konfirmasi semua (${okIds.length})`}</Button>
                )}
            </div>
            {pic.raters.length > 0 && (
                <ul className="grid max-h-56 gap-1 overflow-auto pr-1">
                    {pic.raters.map((rater) => (
                        <RaterRow key={rater.id} scope={scope} templateId={templateId} rater={rater} pending={busy}
                            onConfirm={() => confirmRows([rater.id])} onRemove={() => onRemoveRater(rater.id)} />
                    ))}
                </ul>
            )}
            <AddRaterField scope={scope} templateId={templateId} onAdd={onAddRater} disabled={busy} />
        </section>
    );
}
