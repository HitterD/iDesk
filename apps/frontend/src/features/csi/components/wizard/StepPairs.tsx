import { useState } from 'react';
import { Grid3x3, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCsiAssignments, useSaveCsiAssignments } from '../../hooks/useCsi';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { AdminSection, LockedNote, MUTED_TEXT } from '../admin/AdminParts';
import { AssignmentMatrix } from '../admin/assignment/AssignmentMatrix';

export const PAIRS_COPY = {
    title: 'Siapa menilai siapa',
    description: 'Tentukan penilai untuk setiap tim dan orang yang dinilai. Antar tim boleh dinilai oleh penilai berbeda atau oleh penilai yang sama.',
    allTitle: 'Semua penilai menilai semua subjek',
    allHint: 'Paling sederhana: setiap penilai periode ini mengisi penilaian untuk semua tim dan orang.',
    customTitle: 'Atur per tim / orang',
    customHint: 'Pilih sendiri siapa menilai siapa di matriks. Penilai yang sama boleh menilai beberapa tim.',
    resetAll: 'Kembali ke "semua menilai semua"',
    resetDone: 'Semua penilai kembali menilai semua subjek',
    noRaters: 'Belum ada penilai di periode ini. Isi langkah Penilai dulu.',
} as const;

type Mode = 'all' | 'custom';

function ModeCard({ active, icon: Icon, title, hint, onSelect, disabled }: {
    active: boolean; icon: typeof Users; title: string; hint: string; onSelect: () => void; disabled?: boolean;
}) {
    return (
        <button type="button" role="radio" aria-checked={active} disabled={disabled} onClick={onSelect}
            className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                active ? 'border-[hsl(var(--idesk-sapphire))] bg-[hsl(var(--idesk-sapphire)/.07)]' : 'border-[hsl(var(--idesk-border)/.8)] bg-card hover:bg-[hsl(var(--muted)/.45)]')}>
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', active ? 'bg-[hsl(var(--idesk-sapphire))] text-white' : 'bg-[hsl(var(--muted))]')}>
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
                <span className="block text-[14px] font-semibold">{title}</span>
                <span className={cn(MUTED_TEXT, 'mt-0.5 block text-[12.5px] leading-snug')}>{hint}</span>
            </span>
        </button>
    );
}

/**
 * Wizard step (LISTED periods): either everyone rates everyone (no pairs saved) or a hand-picked
 * rater × subject matrix, so e.g. ICT Jakarta and ICT Karawang can be rated by different people.
 */
export function StepPairs({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange: (dirty: boolean) => void;
}) {
    const { data } = useCsiAssignments(scope, period.id);
    const save = useSaveCsiAssignments(scope, period.id);
    const mapped = (data?.pairs.length ?? 0) > 0;
    const [chosen, setChosen] = useState<Mode | null>(null);
    const mode: Mode = chosen ?? (mapped ? 'custom' : 'all');
    const locked = period.locked;
    const pickAll = () => {
        setChosen('all');
        onDirtyChange(false);
        if (mapped) save.mutate([], { onSuccess: () => toast.success(PAIRS_COPY.resetDone) });
    };

    return (
        <div className="grid gap-4">
            <AdminSection title={PAIRS_COPY.title} description={PAIRS_COPY.description} actions={locked ? <LockedNote /> : null}>
                {!period.raters.length && <p className={cn(MUTED_TEXT, 'mb-3 text-[13px]')}>{PAIRS_COPY.noRaters}</p>}
                <div role="radiogroup" aria-label={PAIRS_COPY.title} className="grid gap-3 md:grid-cols-2">
                    <ModeCard active={mode === 'all'} icon={Users} title={PAIRS_COPY.allTitle} hint={PAIRS_COPY.allHint}
                        disabled={locked || save.isPending} onSelect={pickAll} />
                    <ModeCard active={mode === 'custom'} icon={Grid3x3} title={PAIRS_COPY.customTitle} hint={PAIRS_COPY.customHint}
                        disabled={locked} onSelect={() => setChosen('custom')} />
                </div>
                {mode === 'all' && mapped && !locked && (
                    <Button variant="soft" size="sm" className="mt-3" loading={save.isPending} onClick={pickAll}>{PAIRS_COPY.resetAll}</Button>
                )}
            </AdminSection>
            {mode === 'custom' && <AssignmentMatrix scope={scope} period={period} onDirtyChange={onDirtyChange} />}
        </div>
    );
}
