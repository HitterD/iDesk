import { ClipboardList, Hand } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { targetRespondentsInvalid, type PeriodFormState } from '../../../lib/periodForm';
import { FIELD_LABEL, LockedNote, MUTED_TEXT } from '../AdminParts';

type SetField = <K extends keyof PeriodFormState>(key: K, value: PeriodFormState[K]) => void;

const OPTIONS = [
    {
        picks: false, icon: ClipboardList, title: 'Ditentukan HC (disarankan)',
        hint: 'HC mengatur siapa menilai PIC mana: per unit (divisi/departemen/bagian), per orang, atau lewat impor Excel. Partisipasi = penilai yang ditetapkan.',
    },
    {
        picks: true, icon: Hand, title: 'Responden memilih PIC sendiri',
        hint: 'Semua karyawan di site boleh mengisi dan mencentang PIC yang pernah melayaninya. Partisipasi dihitung dari target responden di bawah.',
    },
] as const;

/** HC only: who decides which PICs a respondent rates. "HC decides" is the default; respondent picking is opt-in. */
export function HcRaterModeField({ form, set, locked }: { form: PeriodFormState; set: SetField; locked: boolean }) {
    const choose = (picks: boolean) => {
        set('respondentPicks', picks);
        // Respondent picking is open to everyone at the site; HC-decided raters are a listed audience.
        set('respondentMode', picks ? 'OPEN' : 'LISTED');
    };
    const badTarget = targetRespondentsInvalid(form);
    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-3">
                <span className={FIELD_LABEL}>Siapa menilai PIC mana</span>
                {locked && <LockedNote />}
            </div>
            <div role="radiogroup" aria-label="Siapa menilai PIC mana" className="grid gap-3 md:grid-cols-2">
                {OPTIONS.map((option) => {
                    const active = form.respondentPicks === option.picks;
                    const Icon = option.icon;
                    return (
                        <button key={String(option.picks)} type="button" role="radio" aria-checked={active} disabled={locked} onClick={() => choose(option.picks)}
                            className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                                active ? 'border-[hsl(var(--idesk-sapphire))] bg-[hsl(var(--idesk-sapphire)/.07)]' : 'border-[hsl(var(--idesk-border)/.8)] bg-card hover:bg-[hsl(var(--muted)/.45)]')}>
                            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', active ? 'bg-[hsl(var(--idesk-sapphire))] text-white' : 'bg-[hsl(var(--muted))]')}>
                                <Icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[14px] font-semibold">{option.title}</span>
                                <span className={cn(MUTED_TEXT, 'mt-0.5 block text-[12.5px] leading-snug')}>{option.hint}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
            {form.respondentPicks && (
                <label className="grid max-w-xs gap-1.5">
                    <span className={FIELD_LABEL}>Target jumlah responden</span>
                    <Input type="number" inputMode="numeric" min={1} step={1} value={form.targetRespondents} placeholder="mis. 50"
                        aria-invalid={badTarget || undefined} onChange={(event) => set('targetRespondents', event.target.value)} />
                    <span className={cn(MUTED_TEXT, 'text-[12px]')}>Dipakai sebagai basis "sudah mengisi" (mis. 32/50). Maksimal tampil 100%.</span>
                    {badTarget && <span role="alert" className="text-[12.5px] text-[hsl(var(--ticket-red-ink))]">Isi bilangan bulat minimal 1.</span>}
                </label>
            )}
        </div>
    );
}
