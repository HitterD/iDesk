import { useMemo, useState } from 'react';
import { Check, Search, UserRoundCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CsiFormRatee } from '../../types';
import { CSI_CARD } from '../CsiSurveyParts';
import { FlowFooter, ScreenHeading } from './FlowChrome';
import { RateeAvatar } from './RateeAvatar';
import { titleCase } from '../admin/hc/hcFormat';

/**
 * HC "pilih PIC": the respondent opens a layanan (HCC / HCD / HCS), sees its PICs grouped per bagian and ticks the
 * people who served them (at least one). Only the ticked PICs are rated on the next screens.
 */
const PIC_COPY = {
    title: 'Siapa yang pernah melayani Anda?',
    hint: 'Pilih layanan, lalu centang PIC yang pernah melayani Anda. Anda hanya menilai PIC yang dipilih (minimal 1).',
    search: 'Cari nama atau jabatan',
    next: 'Lanjut menilai',
    none: 'Tidak ada PIC yang cocok dengan pencarian.',
    otherBagian: 'Lainnya',
} as const;
const picked = (count: number) => (count ? `${count} PIC dipilih` : 'Belum ada PIC dipilih');

type Service = { code: string; name: string; ratees: CsiFormRatee[] };


function servicesOf(ratees: CsiFormRatee[]): Service[] {
    const map = new Map<string, Service>();
    ratees.forEach((ratee) => {
        const code = ratee.serviceCode ?? '-';
        const entry = map.get(code) ?? { code, name: ratee.serviceName ?? code, ratees: [] };
        entry.ratees.push(ratee);
        map.set(code, entry);
    });
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function groupByBagian(ratees: CsiFormRatee[]) {
    const map = new Map<string, CsiFormRatee[]>();
    ratees.forEach((ratee) => map.set(ratee.bagian ?? PIC_COPY.otherBagian, [...(map.get(ratee.bagian ?? PIC_COPY.otherBagian) ?? []), ratee]));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function PicRow({ ratee, checked, onToggle }: { ratee: CsiFormRatee; checked: boolean; onToggle: () => void }) {
    return (
        <li>
            <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                checked ? 'bg-[hsl(var(--idesk-sapphire)/.09)] ring-1 ring-[hsl(var(--idesk-sapphire)/.35)]' : 'hover:bg-muted')}>
                <input type="checkbox" className="peer sr-only" checked={checked} onChange={onToggle} />
                <span aria-hidden="true" className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                    checked ? 'border-[hsl(var(--idesk-sapphire))] bg-[hsl(var(--idesk-sapphire))] text-white' : 'border-border bg-card')}>
                    {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <RateeAvatar name={ratee.displayName} avatarUrl={ratee.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-foreground">{titleCase(ratee.displayName)}</span>
                    {ratee.jobTitle && <span className="block truncate text-[12.5px] text-muted-foreground">{titleCase(ratee.jobTitle)}</span>}
                </span>
            </label>
        </li>
    );
}

export function PicPicker({ ratees, selected, onChange, onNext }: {
    ratees: CsiFormRatee[]; selected: ReadonlySet<string>; onChange: (ids: Set<string>) => void; onNext: () => void;
}) {
    const services = useMemo(() => servicesOf(ratees), [ratees]);
    const [active, setActive] = useState(services[0]?.code ?? '');
    const [query, setQuery] = useState('');
    const service = services.find((row) => row.code === active) ?? services[0];
    const needle = query.trim().toLowerCase();
    const visible = (service?.ratees ?? []).filter((ratee) =>
        !needle || ratee.displayName.toLowerCase().includes(needle) || (ratee.jobTitle ?? '').toLowerCase().includes(needle));
    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        onChange(next);
    };
    const countIn = (row: Service) => row.ratees.filter((ratee) => selected.has(ratee.periodRateeId)).length;
    return (
        <div className="space-y-5">
            <header className="space-y-2">
                <ScreenHeading className="text-2xl font-bold tracking-tight sm:text-[26px]">{PIC_COPY.title}</ScreenHeading>
                <p className="text-[15px] text-muted-foreground">{PIC_COPY.hint}</p>
            </header>
            <div role="tablist" aria-label="Layanan" className="grid gap-2 sm:grid-cols-3">
                {services.map((row) => (
                    <button key={row.code} type="button" role="tab" aria-selected={row.code === service?.code} onClick={() => setActive(row.code)}
                        className={cn(CSI_CARD, 'flex items-center gap-3 p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            row.code === service?.code ? 'border-[hsl(var(--idesk-sapphire))] bg-[hsl(var(--idesk-sapphire)/.06)]' : 'hover:bg-muted/60')}>
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--idesk-sapphire)/.12)] text-[13px] font-extrabold text-[hsl(var(--idesk-sapphire))]">{row.code}</span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-semibold">{row.name}</span>
                            <span className="block text-[12.5px] text-muted-foreground">{`${row.ratees.length} PIC${countIn(row) ? ` · ${countIn(row)} dipilih` : ''}`}</span>
                        </span>
                    </button>
                ))}
            </div>
            <section className={cn(CSI_CARD, 'p-4 sm:p-6')}>
                <div className="relative mb-4">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={PIC_COPY.search} aria-label={PIC_COPY.search}
                        className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                {!visible.length && <p className="py-6 text-center text-[14px] text-muted-foreground">{PIC_COPY.none}</p>}
                <div className="grid gap-5">
                    {groupByBagian(visible).map(([bagian, people]) => (
                        <div key={bagian}>
                            <h3 className="mb-1.5 px-1 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{`${titleCase(bagian)} · ${people.length}`}</h3>
                            <ul className="grid gap-1 sm:grid-cols-2">
                                {people.map((ratee) => (
                                    <PicRow key={ratee.periodRateeId} ratee={ratee} checked={selected.has(ratee.periodRateeId)} onToggle={() => toggle(ratee.periodRateeId)} />
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>
            <FlowFooter note={<span className="inline-flex items-center gap-1.5"><UserRoundCheck className="h-4 w-4" aria-hidden="true" />{picked(selected.size)}</span>}>
                <button type="button" className="idesk-cta ct-submit w-full justify-center sm:ml-auto sm:w-auto" disabled={!selected.size} onClick={onNext}>
                    {PIC_COPY.next}
                </button>
            </FlowFooter>
        </div>
    );
}
