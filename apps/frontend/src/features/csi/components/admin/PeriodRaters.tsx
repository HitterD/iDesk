import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useCsiRaters, useSetCsiRaters } from '../../hooks/useCsi';
import { ratersSignature, sameIds } from '../../lib/csiAdmin';
import { useServerDraft } from '../../lib/useServerDraft';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { AdminSection, EmptyNote, LockedNote, MUTED_TEXT } from './AdminParts';

/** LISTED periods only: choose which registered raters may fill this period. */
export function PeriodRaters({ scope, period }: { scope: CsiScopeParam; period: CsiPeriodDetail }) {
    const { data: master = [], isLoading } = useCsiRaters(scope);
    const save = useSetCsiRaters(scope, period.id);
    const saved = period.raters.map((rater) => rater.userId);
    const [selected, setSelected] = useServerDraft<string[]>(() => saved, ratersSignature(period));
    const locked = period.locked;
    const dirty = !sameIds(selected, saved);
    const allIds = master.map((rater) => rater.userId);
    const allChecked = allIds.length > 0 && allIds.every((id) => selected.includes(id));
    const toggle = (id: string, on: boolean) => setSelected((current) => on ? [...current, id] : current.filter((item) => item !== id));

    return (
        <AdminSection title="Penilai periode" description="Hanya penilai yang dicentang yang dapat mengisi survei periode ini."
            actions={locked ? <LockedNote /> : dirty ? <span role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">Ada perubahan yang belum disimpan</span> : null}>
            {!isLoading && !master.length ? (
                <EmptyNote>Belum ada penilai terdaftar. Tambahkan di tab Penilai.</EmptyNote>
            ) : (
                <div className="rounded-2xl border border-[hsl(var(--idesk-border)/.7)]">
                    <div className="flex items-center gap-2.5 border-b border-[hsl(var(--idesk-border)/.7)] px-4 py-2.5">
                        <Checkbox id="raters-all" checked={allChecked} disabled={locked || !allIds.length}
                            onCheckedChange={(state) => setSelected(state === true ? allIds : [])} />
                        <label htmlFor="raters-all" className="text-[13px] font-medium cursor-pointer">Pilih semua</label>
                        <span className={cn(MUTED_TEXT, 'ml-auto tabular-nums')}>{`${selected.length} dari ${allIds.length} dipilih`}</span>
                    </div>
                    <ul className="max-h-80 divide-y divide-[hsl(var(--idesk-border)/.5)] overflow-y-auto">
                        {master.map((rater) => {
                            const id = `rater-${rater.userId}`;
                            return (
                                <li key={rater.id} className="flex items-center gap-2.5 px-4 py-2.5">
                                    <Checkbox id={id} checked={selected.includes(rater.userId)} disabled={locked}
                                        onCheckedChange={(state) => toggle(rater.userId, state === true)} />
                                    <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                                        <span className="block text-[13.5px] font-medium">{rater.user.fullName}</span>
                                        <span className={cn(MUTED_TEXT, 'block text-[12px]')}>{[rater.user.jobTitle, rater.user.site?.code].filter(Boolean).join(' · ') || rater.user.email}</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            <div className="mt-4 flex justify-end">
                <Button variant="primary" onClick={() => save.mutate({ userIds: selected })} loading={save.isPending} disabled={locked || !dirty}>
                    Simpan penilai
                </Button>
            </div>
        </AdminSection>
    );
}
