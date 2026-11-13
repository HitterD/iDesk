import { useState } from 'react';
import { Grid3x3, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { cn } from '@/lib/utils';
import { useCsiAssignments, useSetCsiPairMode } from '../../hooks/useCsi';
import type { CsiPairMode, CsiPeriodDetail, CsiScopeParam } from '../../types';
import { AdminSection, LockedNote, MUTED_TEXT } from '../admin/AdminParts';
import { AssignmentMatrix } from '../admin/assignment/AssignmentMatrix';

export const PAIRS_COPY = {
    title: 'Siapa menilai siapa',
    description: 'Tentukan penilai untuk setiap tim dan orang yang dinilai. Antar tim boleh dinilai oleh penilai berbeda atau oleh penilai yang sama.',
    allTitle: 'Semua penilai menilai semua',
    allHint: 'Paling sederhana: setiap penilai survei ini mengisi penilaian untuk semua tim dan orang.',
    customTitle: 'Atur per tim / orang',
    customHint: 'Pilih sendiri siapa menilai siapa di tabel. Penilai yang sama boleh menilai beberapa tim.',
    resetDone: 'Semua penilai sekarang menilai semua tim dan orang',
    noRaters: 'Belum ada penilai di survei ini. Isi langkah Penilai dulu.',
    openMode: 'Survei ini terbuka untuk semua user di site, jadi semua menilai semua. Pengaturan ini hanya untuk mode "Hanya penilai terdaftar".',
    confirmTitle: 'Hapus pengaturan per tim / orang?',
    confirmBody: (pairs: number) => `${pairs} pasangan penilai yang sudah diatur akan dihapus, dan semua penilai akan menilai semua tim dan orang.`,
} as const;

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
 * "Siapa menilai siapa" (wizard step and the detail tab): everyone rates everyone (stored as pairMode ALL, never
 * refilled from the template) or the rater x subject matrix. Leaving the matrix asks first when pairs exist.
 */
export function PairsPanel({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange?: (dirty: boolean) => void;
}) {
    const { data } = useCsiAssignments(scope, period.id);
    const setMode = useSetCsiPairMode(scope, period.id);
    const pairs = data?.pairs.length ?? 0;
    const [chosen, setChosen] = useState<CsiPairMode | null>(null);
    const [confirming, setConfirming] = useState(false);
    const mode: CsiPairMode = chosen ?? period.pairMode ?? (pairs > 0 ? 'CUSTOM' : 'ALL');
    const customHint = scope === 'ict'
        ? 'Default: setiap penilai menilai Tim & IT Support di site masing-masing (Sukodono gabung ke Sepanjang). Bisa disesuaikan di tabel.'
        : PAIRS_COPY.customHint;
    const locked = period.locked;
    if (period.respondentMode === 'OPEN') {
        return <AdminSection title={PAIRS_COPY.title}><p className={MUTED_TEXT}>{PAIRS_COPY.openMode}</p></AdminSection>;
    }
    const save = (next: CsiPairMode, after?: () => void) => setMode.mutate(next, { onSuccess: () => { setChosen(next); after?.(); } });
    const pickAll = () => {
        if (mode === 'ALL') return;
        if (pairs > 0) setConfirming(true);
        else save('ALL');
    };

    return (
        <div className="grid gap-4">
            <AdminSection title={PAIRS_COPY.title} description={PAIRS_COPY.description} actions={locked ? <LockedNote /> : null}>
                {!period.raters.length && <p className={cn(MUTED_TEXT, 'mb-3 text-[13px]')}>{PAIRS_COPY.noRaters}</p>}
                <div role="radiogroup" aria-label={PAIRS_COPY.title} className="grid gap-3 md:grid-cols-2">
                    <ModeCard active={mode === 'ALL'} icon={Users} title={PAIRS_COPY.allTitle} hint={PAIRS_COPY.allHint}
                        disabled={locked || setMode.isPending} onSelect={pickAll} />
                    <ModeCard active={mode === 'CUSTOM'} icon={Grid3x3} title={PAIRS_COPY.customTitle} hint={customHint}
                        disabled={locked || setMode.isPending} onSelect={() => mode !== 'CUSTOM' && save('CUSTOM')} />
                </div>
            </AdminSection>
            {mode === 'CUSTOM' && <AssignmentMatrix scope={scope} period={period} onDirtyChange={onDirtyChange} />}
            <ConfirmationDialog isOpen={confirming} appearance="ticket" variant="warning" title={PAIRS_COPY.confirmTitle}
                description={PAIRS_COPY.confirmBody(pairs)} confirmText="Ya, semua menilai semua" cancelText="Batal"
                isLoading={setMode.isPending} onCancel={() => setConfirming(false)}
                onConfirm={() => save('ALL', () => { setConfirming(false); onDirtyChange?.(false); toast.success(PAIRS_COPY.resetDone); })} />
        </div>
    );
}

/** Wizard step wrapper. */
export function StepPairs({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange: (dirty: boolean) => void;
}) {
    return <PairsPanel scope={scope} period={period} onDirtyChange={onDirtyChange} />;
}
