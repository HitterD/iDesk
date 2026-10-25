import { useMemo, useState } from 'react';
import { useServerDraft } from '../../lib/useServerDraft';
import { ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useCsiDimensions, useSetCsiRatees } from '../../hooks/useCsi';
import {
    draftFromPeriod, mergeRatees, orderDimensions, rateesSignature, toRateesPayload, type DraftUser, type RateeDraft,
} from '../../lib/csiAdmin';
import type { CsiDimension, CsiPeriodDetail, CsiScopeParam } from '../../types';
import { AdminSection, EmptyNote, LockedNote, MUTED_TEXT, UserMultiPicker } from './AdminParts';

interface DimensionChecklistProps {
    idPrefix: string;
    dimensions: readonly CsiDimension[];
    value: readonly string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}

function DimensionChecklist({ idPrefix, dimensions, value, onChange, disabled }: DimensionChecklistProps) {
    const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((item) => item !== id));
    return (
        <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {dimensions.map((dimension) => {
                const id = `${idPrefix}-${dimension.id}`;
                return (
                    <li key={dimension.id} className="flex items-center gap-2">
                        <Checkbox id={id} checked={value.includes(dimension.id)} disabled={disabled}
                            onCheckedChange={(state) => toggle(dimension.id, state === true)} />
                        <label htmlFor={id} className="text-[13.5px] cursor-pointer">{dimension.name}</label>
                    </li>
                );
            })}
        </ul>
    );
}

function RowDimensions({ row, dimensions, names, onChange, disabled }: {
    row: RateeDraft; dimensions: readonly CsiDimension[]; names: ReadonlyMap<string, string>;
    onChange: (ids: string[]) => void; disabled: boolean;
}) {
    const chips = (
        <span className="flex flex-wrap gap-1">
            {row.dimensionIds.map((id) => (
                <span key={id} className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-[12px] font-medium">{names.get(id) ?? 'Dimensi nonaktif'}</span>
            ))}
            {!row.dimensionIds.length && <span className="text-[12px] font-medium text-[hsl(var(--ticket-red-ink))]">Belum ada dimensi</span>}
        </span>
    );
    if (disabled) return chips;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button type="button" aria-label={`Ubah dimensi ${row.displayName}`}
                    className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1 text-left hover:bg-[hsl(var(--muted)/.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {chips}<ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="picker-panel w-[min(92vw,320px)] p-4" aria-label={`Dimensi ${row.displayName}`}>
                <DimensionChecklist idPrefix={`row-${row.userId}`} dimensions={dimensions} value={row.dimensionIds} onChange={onChange} />
            </PopoverContent>
        </Popover>
    );
}

function RateeTable({ draft, dimensions, locked, onChangeRow, onRemove }: {
    draft: readonly RateeDraft[]; dimensions: readonly CsiDimension[]; locked: boolean;
    onChangeRow: (userId: string, ids: string[]) => void; onRemove: (userId: string) => void;
}) {
    const names = useMemo(() => new Map(dimensions.map((dimension) => [dimension.id, dimension.name])), [dimensions]);
    if (!draft.length) return <EmptyNote>Belum ada orang yang dinilai. Pilih user dan dimensi, lalu pasang.</EmptyNote>;
    return (
        <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--idesk-border)/.7)]">
            <table aria-label="Orang yang dinilai" className="w-full min-w-[560px] text-left text-[13.5px]">
                <thead className={cn(MUTED_TEXT, 'text-[12px]')}>
                    <tr className="border-b border-[hsl(var(--idesk-border)/.7)]">
                        <th className="px-4 py-2.5 font-medium">Nama</th>
                        <th className="px-4 py-2.5 font-medium">Dimensi</th>
                        <th className="w-12 px-2 py-2.5"><span className="sr-only">Aksi</span></th>
                    </tr>
                </thead>
                <tbody>
                    {draft.map((row) => (
                        <tr key={row.userId} className="border-b border-[hsl(var(--idesk-border)/.5)] last:border-0 align-top">
                            <td className="px-4 py-3">
                                <span className="block font-medium">{row.displayName}</span>
                                {row.jobTitle && <span className={cn(MUTED_TEXT, 'block text-[12px]')}>{row.jobTitle}</span>}
                            </td>
                            <td className="px-2.5 py-2">
                                <RowDimensions row={row} dimensions={dimensions} names={names} disabled={locked}
                                    onChange={(ids) => onChangeRow(row.userId, ids)} />
                            </td>
                            <td className="px-2 py-2 text-right">
                                {!locked && (
                                    <Button variant="subtle" size="icon" aria-label={`Hapus ${row.displayName}`} onClick={() => onRemove(row.userId)}>
                                        <Trash2 aria-hidden="true" />
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function RateeAssignment({ scope, period }: { scope: CsiScopeParam; period: CsiPeriodDetail }) {
    const { data: dimensions = [] } = useCsiDimensions(scope);
    const save = useSetCsiRatees(scope, period.id);
    const [draft, setDraft] = useServerDraft<RateeDraft[]>(() => draftFromPeriod(period), rateesSignature(period));
    const [pickedUsers, setPickedUsers] = useState<DraftUser[]>([]);
    const [pickedDimensions, setPickedDimensions] = useState<string[]>([]);
    const locked = period.locked;
    const order = useMemo(() => dimensions.map((dimension) => dimension.id), [dimensions]);
    const payload = toRateesPayload(draft, order);
    const dirty = JSON.stringify(payload) !== JSON.stringify(toRateesPayload(draftFromPeriod(period), order));
    const invalid = draft.some((row) => !row.dimensionIds.length);

    const assign = () => {
        setDraft((current) => mergeRatees(current, pickedUsers, orderDimensions(pickedDimensions, order)));
        setPickedUsers([]);
        setPickedDimensions([]);
    };
    const changeRow = (userId: string, ids: string[]) =>
        setDraft((current) => current.map((row) => row.userId === userId ? { ...row, dimensionIds: orderDimensions(ids, order) } : row));
    const removeRow = (userId: string) => setDraft((current) => current.filter((row) => row.userId !== userId));

    return (
        <AdminSection title="Orang yang dinilai" description="Pasang satu set dimensi ke beberapa orang sekaligus, lalu sesuaikan per baris."
            actions={locked ? <LockedNote /> : dirty ? <span role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">Ada perubahan yang belum disimpan</span> : null}>
            <div className="grid gap-5 rounded-2xl bg-[hsl(var(--muted)/.45)] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
                <div className="space-y-1.5">
                    <span className={MUTED_TEXT}>1. Pilih orang</span>
                    <UserMultiPicker scope={scope} label="Pilih orang yang dinilai" selected={pickedUsers} onChange={setPickedUsers} disabled={locked} />
                </div>
                <div className="space-y-2">
                    <span className={MUTED_TEXT}>2. Pilih dimensi</span>
                    {dimensions.length
                        ? <DimensionChecklist idPrefix="assign" dimensions={dimensions} value={pickedDimensions} onChange={setPickedDimensions} disabled={locked} />
                        : <p className={MUTED_TEXT}>Belum ada dimensi aktif. Tambahkan di tab Dimensi.</p>}
                </div>
                <Button variant="soft" className="lg:mt-6" onClick={assign} disabled={locked || !pickedUsers.length || !pickedDimensions.length}>
                    Pasang ke yang dipilih
                </Button>
            </div>
            <div className="mt-5">
                <RateeTable draft={draft} dimensions={dimensions} locked={locked} onChangeRow={changeRow} onRemove={removeRow} />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                {invalid && <span className="text-[12.5px] text-[hsl(var(--ticket-red-ink))]">Setiap orang wajib memiliki minimal satu dimensi.</span>}
                <Button variant="primary" onClick={() => save.mutate(payload)} loading={save.isPending} disabled={locked || !dirty || invalid}>
                    Simpan penugasan
                </Button>
            </div>
        </AdminSection>
    );
}
