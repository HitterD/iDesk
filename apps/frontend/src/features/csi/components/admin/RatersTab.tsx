import { useMemo, useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { useCsiRaters, useRemoveCsiRaters } from '../../hooks/useCsi';
import { CSI_MODE_LABELS } from '../../lib/csiAdmin';
import { siteTone, toneClasses } from '../../lib/csiTone';
import type { CsiRater, CsiScopeParam } from '../../types';
import { ADMIN_PANEL, AdminSection, EmptyNote, MUTED_TEXT } from './AdminParts';
import { AddRatersPanel } from './raters/AddRatersPanel';

const NO_SITE = 'Tanpa site';
type SiteGroup = { code: string | null; name: string; raters: CsiRater[] };

function groupBySite(raters: readonly CsiRater[]): SiteGroup[] {
    const groups = new Map<string, SiteGroup>();
    raters.forEach((rater) => {
        const code = rater.user.site?.code ?? null;
        const key = code ?? '';
        const group = groups.get(key) ?? { code, name: rater.user.site?.name ?? NO_SITE, raters: [] };
        groups.set(key, { ...group, raters: [...group.raters, rater] });
    });
    return [...groups.values()].sort((a, b) => (a.code ?? '￿').localeCompare(b.code ?? '￿'));
}

function SiteSection({ group, selected, onToggle, onToggleAll, onRemove }: {
    group: SiteGroup; selected: ReadonlySet<string>; onToggle: (id: string, on: boolean) => void;
    onToggleAll: (ids: string[], on: boolean) => void; onRemove: (rater: CsiRater) => void;
}) {
    const ids = group.raters.map((rater) => rater.id);
    const allOn = ids.every((id) => selected.has(id));
    return (
        <section aria-label={`Penilai ${group.name}`} className="overflow-hidden rounded-xl border border-[hsl(var(--idesk-border)/.7)]">
            <header className="flex items-center gap-2 bg-[hsl(var(--muted)/.45)] px-3.5 py-2">
                {group.code && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white', toneClasses(siteTone(group.code)).fill)}>{group.code}</span>}
                <span className="text-[13px] font-semibold">{`${group.name} · ${group.raters.length} penilai`}</span>
                <label className={cn(MUTED_TEXT, 'ml-auto inline-flex cursor-pointer items-center gap-2 text-[12.5px]')}>
                    <Checkbox checked={allOn} onCheckedChange={(state) => onToggleAll(ids, state === true)} aria-label={`Pilih semua penilai ${group.name}`} />
                    Pilih semua
                </label>
            </header>
            <ul className="divide-y divide-[hsl(var(--idesk-border)/.55)]">
                {group.raters.map((rater) => (
                    <li key={rater.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <Checkbox checked={selected.has(rater.id)} onCheckedChange={(state) => onToggle(rater.id, state === true)} aria-label={`Pilih ${rater.user.fullName}`} />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium">{rater.user.fullName}</span>
                            <span className={cn(MUTED_TEXT, 'block truncate text-[12px]')}>{[rater.user.jobTitle, rater.user.email].filter(Boolean).join(' · ')}</span>
                        </span>
                        <Button variant="subtle" size="icon" aria-label={`Hapus ${rater.user.fullName}`} onClick={() => onRemove(rater)}>
                            <X aria-hidden="true" />
                        </Button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** Registered raters of the scope: three ways to add, a searchable per-site list and bulk removal. */
export function RatersTab({ scope }: { scope: CsiScopeParam }) {
    const { data: raters, isLoading, isError, refetch } = useCsiRaters(scope);
    const remove = useRemoveCsiRaters(scope);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [confirm, setConfirm] = useState<string[] | null>(null);
    const registered = useMemo(() => new Set((raters ?? []).map((rater) => rater.userId)), [raters]);
    const term = search.trim().toLowerCase();
    const visible = (raters ?? []).filter((rater) => `${rater.user.fullName} ${rater.user.email} ${rater.user.jobTitle ?? ''}`.toLowerCase().includes(term));
    const groups = groupBySite(visible);
    const summary = groupBySite(raters ?? []);
    const toggle = (id: string, on: boolean) => setSelected((current) => { const next = new Set(current); if (on) next.add(id); else next.delete(id); return next; });
    const toggleAll = (ids: string[], on: boolean) => setSelected((current) => { const next = new Set(current); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); return next; });
    const names = (ids: string[]) => (raters ?? []).filter((rater) => ids.includes(rater.id)).map((rater) => rater.user.fullName);

    return (
        <div className="grid gap-4">
            <AdminSection title="Tambah penilai" description={`Orang yang boleh mengisi survei dengan mode "${CSI_MODE_LABELS.LISTED}". Daftar ini dipakai ulang di setiap survei.`}>
                <AddRatersPanel scope={scope} registered={registered} />
            </AdminSection>
            <section aria-label="Daftar penilai" className={cn(ADMIN_PANEL, 'grid gap-3 p-4 sm:p-5')}>
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[14px] font-semibold">{`Penilai terdaftar · ${raters?.length ?? 0}`}</h2>
                    {summary.map((group) => <span key={group.code ?? 'none'} className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-[12px] font-semibold">{`${group.code ?? NO_SITE} ${group.raters.length}`}</span>)}
                    <label className="ml-auto flex h-9 min-w-[min(240px,100%)] items-center gap-2 rounded-xl bg-[hsl(var(--muted)/.6)] px-3 focus-within:ring-2 focus-within:ring-ring">
                        <Search className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                        <input type="search" aria-label="Cari di daftar penilai" placeholder="Cari di daftar…" value={search}
                            onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
                    </label>
                    <Button variant="soft" disabled={!selected.size} onClick={() => setConfirm([...selected])}>
                        <Trash2 aria-hidden="true" />{`Hapus ${selected.size} terpilih`}
                    </Button>
                </div>
                {isLoading && <div className="h-32 animate-pulse rounded-xl bg-[hsl(var(--muted)/.5)] motion-reduce:animate-none" aria-busy="true" />}
                {isError && <ErrorState compact onRetry={() => refetch()} />}
                {raters && !raters.length && <EmptyNote>Belum ada penilai. Tambahkan per kelompok di atas, cara paling cepat.</EmptyNote>}
                {raters && raters.length > 0 && !visible.length && <EmptyNote>Tidak ada penilai yang cocok dengan pencarian.</EmptyNote>}
                {groups.map((group) => (
                    <SiteSection key={group.code ?? 'none'} group={group} selected={selected} onToggle={toggle} onToggleAll={toggleAll}
                        onRemove={(rater) => setConfirm([rater.id])} />
                ))}
            </section>
            <ConfirmationDialog isOpen={!!confirm} appearance="ticket" variant="destructive"
                title={confirm && confirm.length > 1 ? `Hapus ${confirm.length} penilai?` : 'Hapus penilai?'}
                description={`${confirm ? names(confirm).slice(0, 3).join(', ') : ''}${confirm && confirm.length > 3 ? ', …' : ''} dihapus dari daftar penilai. Survei yang sudah memasangnya tidak berubah.`}
                confirmText="Hapus" cancelText="Batal" isLoading={remove.isPending} onCancel={() => setConfirm(null)}
                onConfirm={() => confirm && remove.mutate(confirm, { onSuccess: () => { setConfirm(null); setSelected(new Set()); } })} />
        </div>
    );
}
