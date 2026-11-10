import { useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CsiTemplatePic, CsiTemplateRaterStatus } from '../../../../hcTypes';
import { titleCase } from '../hcFormat';

const STATUS: Record<CsiTemplateRaterStatus, { label: string; className: string; hint: string }> = {
    confirmed: { label: 'Terkonfirmasi', className: 'bg-[hsl(var(--ticket-green)/.14)] text-[hsl(var(--ticket-green-ink))]', hint: 'Akun dikonfirmasi atau cocok berdasarkan NIK' },
    ok: { label: 'Cocok', className: 'bg-[hsl(var(--ticket-green)/.14)] text-[hsl(var(--ticket-green-ink))]', hint: 'Nama cocok dengan satu akun iDesk' },
    'no-account': { label: 'Belum punya akun', className: 'bg-[hsl(var(--ticket-amber)/.16)] text-[hsl(var(--ticket-amber-ink))]', hint: 'Masuk survei otomatis saat akunnya ada (Sinkronkan)' },
    ambiguous: { label: 'Nama ganda', className: 'bg-[hsl(var(--ticket-red)/.12)] text-[hsl(var(--ticket-red))]', hint: 'Lebih dari satu akun dengan nama ini: hapus lalu tambah ulang lewat akun' },
};
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

function AddRaterField({ onAdd, disabled }: { onAdd: (name: string) => void; disabled: boolean }) {
    const [name, setName] = useState('');
    return (
        <input aria-label="Tambah penilai" placeholder="Tambah penilai (nama lengkap), Enter" value={name} disabled={disabled}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' || name.trim().length < 2) return;
                event.preventDefault();
                onAdd(name.trim());
                setName('');
            }}
            className="h-8 w-full rounded-lg border border-dashed border-[hsl(var(--border))] bg-transparent px-2 text-[12.5px]" />
    );
}

export interface TemplatePicCardProps {
    pic: CsiTemplatePic;
    pending: boolean;
    onServiceFunction: (value: string | null) => void;
    onAddRater: (name: string) => void;
    onRemoveRater: (raterId: string) => void;
    onRemovePic: () => void;
}

/** One PIC of a template: name, title, editable service function and the raters with their account match. */
export function TemplatePicCard({ pic, pending, onServiceFunction, onAddRater, onRemoveRater, onRemovePic }: TemplatePicCardProps) {
    return (
        <section aria-label={pic.picName} className="grid gap-2 rounded-2xl bg-[hsl(var(--idesk-surface))] p-3 ring-1 ring-[hsl(var(--border)/.7)]">
            <header className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className="break-words text-[13.5px] font-bold">{titleCase(pic.picName)}</p>
                    <p className="text-[12px] text-muted-foreground">{titleCase(pic.jobTitle ?? '')}{!pic.picId && ' · belum cocok dengan PIC master'}</p>
                    <ServiceFunctionEditor key={pic.serviceFunction ?? ''} pic={pic} onSave={(value) => value !== pic.serviceFunction && onServiceFunction(value)} />
                </div>
                <button type="button" aria-label={`Hapus ${pic.picName} dari template`} disabled={pending} onClick={onRemovePic}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--muted))]">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </header>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">{pic.raterCount ? `${pic.raterCount} penilai` : 'Belum ada penilai'}</p>
            {pic.raters.length > 0 && (
                <ul className="grid max-h-56 gap-1 overflow-auto pr-1">
                    {pic.raters.map((rater) => (
                        <li key={rater.id} className="flex items-center gap-2 text-[12.5px]">
                            <span className="min-w-0 flex-1 truncate" title={rater.raterJobTitle ?? undefined}>{titleCase(rater.raterName)}</span>
                            <span title={STATUS[rater.status].hint} className={cn('shrink-0 rounded-md px-1.5 text-[11px] font-semibold', STATUS[rater.status].className)}>{STATUS[rater.status].label}</span>
                            <button type="button" aria-label={`Hapus penilai ${rater.raterName}`} disabled={pending} onClick={() => onRemoveRater(rater.id)}
                                className="rounded p-0.5 text-muted-foreground hover:bg-[hsl(var(--muted))]">
                                <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <AddRaterField onAdd={onAddRater} disabled={pending} />
        </section>
    );
}
