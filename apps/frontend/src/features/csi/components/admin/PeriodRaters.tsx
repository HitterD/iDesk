import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCsiRaters, useSetCsiRaters } from '../../hooks/useCsi';
import { ratersSignature, sameIds } from '../../lib/csiAdmin';
import { toneClasses } from '../../lib/csiTone';
import { siteHandlerMapOf } from '../../lib/siteHandlers';
import { useServerDraft } from '../../lib/useServerDraft';
import type { CsiPeriodDetail, CsiRater, CsiScopeParam } from '../../types';
import { AdminSection, EmptyNote, LockedNote, MUTED_TEXT } from './AdminParts';

const FILTER_ALL = 'ALL';
const FILTER_OUTSIDE = 'OUTSIDE';

/** LISTED periods only: choose which registered raters may fill this period, grouped & searchable by site. */
export function PeriodRaters({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange?: (dirty: boolean) => void;
}) {
    const { data: master = [], isLoading } = useCsiRaters(scope);
    const save = useSetCsiRaters(scope, period.id);
    const saved = period.raters.map((rater) => rater.userId);
    const [selected, setSelected] = useServerDraft<string[]>(() => saved, ratersSignature(period));
    const [search, setSearch] = useState('');
    const [siteFilter, setSiteFilter] = useState<string>(FILTER_ALL);
    const locked = period.locked;
    const dirty = !sameIds(selected, saved);
    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

    const periodSiteIds = useMemo(() => new Set(period.sites.map((site) => site.id)), [period.sites]);
    const siteIdByCode = useMemo(() => new Map(period.sites.flatMap((site) => (site.code ? [[site.code, site.id] as const] : []))), [period.sites]);
    const siteCodeById = useMemo(() => new Map(period.sites.map((site) => [site.id, site.code ?? site.name ?? ''])), [period.sites]);
    const handlers = useMemo(() => siteHandlerMapOf(scope, period.sites), [scope, period.sites]);

    const resolveRaterSiteId = (rater: CsiRater): string | null =>
        rater.user.siteId ?? rater.user.site?.id ?? (rater.user.site?.code ? siteIdByCode.get(rater.user.site.code) ?? null : null);

    const rows = useMemo(() => master.map((rater) => {
        const siteId = resolveRaterSiteId(rater);
        const inPeriod = siteId !== null && periodSiteIds.has(siteId);
        const handlerId = siteId ? handlers[siteId] : undefined;
        return {
            rater, siteId, inPeriod,
            handlerCode: handlerId ? siteCodeById.get(handlerId) ?? null : null,
            searchText: `${rater.user.fullName} ${rater.user.jobTitle ?? ''} ${rater.user.email} ${rater.user.site?.code ?? ''} ${rater.user.site?.name ?? ''}`.toLowerCase(),
        };
    }), [master, periodSiteIds, handlers, siteCodeById, siteIdByCode]);

    const countBySite = useMemo(() => {
        const counts = new Map<string, number>();
        let outside = 0;
        for (const row of rows) {
            if (row.inPeriod && row.siteId) counts.set(row.siteId, (counts.get(row.siteId) ?? 0) + 1);
            else outside += 1;
        }
        return { counts, outside };
    }, [rows]);

    const term = search.trim().toLowerCase();
    const visible = useMemo(() => rows.filter((row) => {
        if (siteFilter === FILTER_OUTSIDE && row.inPeriod) return false;
        if (siteFilter !== FILTER_ALL && siteFilter !== FILTER_OUTSIDE && row.siteId !== siteFilter) return false;
        return !term || row.searchText.includes(term);
    }), [rows, siteFilter, term]);

    const visibleIds = visible.map((row) => row.rater.userId);
    const selectedSet = new Set(selected);
    const inPeriodIds = rows.filter((row) => row.inPeriod).map((row) => row.rater.userId);
    const visibleChecked = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
    const toggle = (id: string, on: boolean) => setSelected((current) => (on ? (current.includes(id) ? current : [...current, id]) : current.filter((item) => item !== id)));
    const toggleVisible = (on: boolean) => setSelected((current) => {
        const next = new Set(current);
        visibleIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
        return [...next];
    });

    return (
        <AdminSection title="Penilai survei ini" description="Centang siapa saja dari Daftar penilai yang mengisi survei ini."
            actions={locked ? <LockedNote /> : dirty ? <span role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">Ada perubahan yang belum disimpan</span> : null}>
            {!isLoading && !master.length ? (
                <EmptyNote>Daftar penilai masih kosong. Buka "Tambah orang ke Daftar penilai" di bawah.</EmptyNote>
            ) : (
                <div className="grid gap-3">
                    {master.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative min-w-[200px] flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--idesk-text-secondary))]" aria-hidden="true" />
                                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, jabatan, atau site…"
                                    aria-label="Cari penilai" className="h-9 rounded-xl pl-9" />
                            </div>
                            {!locked && countBySite.outside > 0 && inPeriodIds.length > 0 && (
                                <Button type="button" size="sm" variant="subtle" onClick={() => setSelected(inPeriodIds)}>
                                    {`Pilih sesuai site survei (${inPeriodIds.length})`}
                                </Button>
                            )}
                        </div>
                    )}
                    {period.sites.length > 0 && master.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter penilai berdasarkan site">
                            {[{ id: FILTER_ALL, label: `Semua (${master.length})` },
                                ...period.sites.map((site) => ({
                                    id: site.id,
                                    label: `${site.code ?? site.name ?? ''} (${countBySite.counts.get(site.id) ?? 0})`,
                                })),
                                ...(countBySite.outside > 0 ? [{ id: FILTER_OUTSIDE, label: `Di luar site survei (${countBySite.outside})` }] : []),
                            ].map((pill) => {
                                const active = siteFilter === pill.id;
                                return (
                                    <button key={pill.id} type="button" aria-pressed={active} onClick={() => setSiteFilter(pill.id)}
                                        className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            active ? 'border-transparent bg-[hsl(var(--idesk-sapphire))] text-white' : 'border-[hsl(var(--idesk-border))] bg-card hover:bg-[hsl(var(--muted)/.5)]')}>
                                        {pill.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className="rounded-2xl border border-[hsl(var(--idesk-border)/.7)]">
                        <div className="flex items-center gap-2.5 border-b border-[hsl(var(--idesk-border)/.7)] px-4 py-2.5">
                            <Checkbox id="raters-all" checked={visibleChecked} disabled={locked || !visibleIds.length}
                                onCheckedChange={(state) => toggleVisible(state === true)} />
                            <label htmlFor="raters-all" className="cursor-pointer text-[13px] font-medium">
                                {siteFilter === FILTER_ALL && !term ? 'Pilih semua' : `Pilih semua yang tampil (${visibleIds.length})`}
                            </label>
                            <span className={cn(MUTED_TEXT, 'ml-auto tabular-nums')}>{`${selected.length} dari ${master.length} dipilih`}</span>
                        </div>
                        <ul className="max-h-80 divide-y divide-[hsl(var(--idesk-border)/.5)] overflow-y-auto">
                            {visible.length ? visible.map(({ rater, siteId, inPeriod, handlerCode }) => {
                                const id = `rater-${rater.userId}`;
                                const outsideSite = !inPeriod && period.sites.length > 0 && Boolean(rater.user.site?.code || siteId);
                                return (
                                    <li key={rater.id} className="flex items-center gap-2.5 px-4 py-2.5">
                                        <Checkbox id={id} checked={selectedSet.has(rater.userId)} disabled={locked}
                                            onCheckedChange={(state) => toggle(rater.userId, state === true)} />
                                        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                                            <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium">
                                                <span>{rater.user.fullName}</span>
                                                {handlerCode && (
                                                    <span className={cn('rounded-full px-2 py-px text-[11px] font-semibold', toneClasses('sky').soft, toneClasses('sky').ink)}>
                                                        {`Gabung ${handlerCode}`}
                                                    </span>
                                                )}
                                                {outsideSite && (
                                                    <span className={cn('rounded-full px-2 py-px text-[11px] font-semibold', toneClasses('amber').soft, toneClasses('amber').ink)}>
                                                        Di luar site survei
                                                    </span>
                                                )}
                                            </span>
                                            <span className={cn(MUTED_TEXT, 'block text-[12px]')}>{[rater.user.jobTitle, rater.user.site?.code].filter(Boolean).join(' · ') || rater.user.email}</span>
                                        </label>
                                    </li>
                                );
                            }) : (
                                <li className={cn(MUTED_TEXT, 'px-4 py-6 text-center text-[13px]')}>Tidak ada penilai yang cocok.</li>
                            )}
                        </ul>
                    </div>
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
