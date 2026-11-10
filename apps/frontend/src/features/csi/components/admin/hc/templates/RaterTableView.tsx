import { Fragment, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConfirmRaters } from '../../../../hooks/useCsiHc';
import type { CsiTemplate } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { RaterAccountPicker } from './RaterAccountPicker';
import { RATER_STATUS } from './RaterRow';
import { groupRaters, type RaterRow } from './raterRows';

const PAGE_SIZE = 50;
const FILTERS = [
    { value: 'issues', label: 'Perlu dicek' }, { value: 'ok', label: 'Cocok otomatis' },
    { value: 'confirmed', label: 'Terkonfirmasi' }, { value: 'all', label: 'Semua' },
] as const;
type StatusFilter = typeof FILTERS[number]['value'];
const hasIssue = (row: RaterRow) => row.status === 'ambiguous' || row.status === 'no-account';

/** Keep disclosure state on each person, so changing filters cannot expand a different row. */
function PersonRow({ scope, templateId, row, pending, onConfirm }: {
    scope: CsiScopeParam; templateId: string; row: RaterRow; pending: boolean; onConfirm: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const listId = useId();
    const status = RATER_STATUS[row.status];
    return (
        <Fragment>
            <tr className="border-b border-[hsl(var(--border))]">
                <th scope="row" className="p-3 text-left font-medium">
                    {row.name}{row.nik && <span className="block text-[12px] font-normal text-muted-foreground">NIK {row.nik}</span>}
                </th>
                <td className="p-3">
                    <RaterAccountPicker scope={scope} templateId={templateId} raterIds={row.raterIds} initialName={row.name}
                        userId={row.userId} confirmed={row.status === 'confirmed'} label={`Akun untuk ${row.name}`}
                        trigger={(
                            <button type="button" title={status.hint} aria-label={`Pilih akun untuk ${row.name} (${status.label})`} disabled={pending}
                                className={cn('rounded-md px-2 py-1 text-[12px] font-semibold hover:brightness-95', status.className)}>{status.label}</button>
                        )} />
                </td>
                <td className="p-3">
                    <button type="button" aria-label={`Menilai ${row.pics.length} PIC: ${row.name}`} aria-expanded={expanded}
                        aria-controls={expanded ? listId : undefined} onClick={() => setExpanded(!expanded)} className="text-left underline underline-offset-4">
                        Menilai {row.pics.length} PIC
                    </button>
                </td>
                <td className="p-3">
                    {row.status === 'ok' && <Button variant="subtle" size="sm" disabled={pending} aria-label={`Konfirmasi ${row.name}`} onClick={onConfirm}>Konfirmasi</Button>}
                </td>
            </tr>
            {expanded && <tr><td colSpan={4} className="bg-[hsl(var(--muted)/.35)] px-5 py-3">
                <ul id={listId} aria-label={`PIC yang dinilai ${row.name}`} className="list-inside list-disc text-[12.5px]">
                    {row.pics.map((pic) => <li key={pic}>{pic}</li>)}
                </ul>
            </td></tr>}
        </Fragment>
    );
}

/** One correction or confirmation updates every assignment belonging to the grouped person. */
export function RaterTableView({ scope, template }: { scope: CsiScopeParam; template: CsiTemplate }) {
    const rows = useMemo(() => groupRaters(template), [template]);
    // Only explicit choices persist: the automatic default follows refreshed issue counts.
    const [selectedFilter, setFilter] = useState<StatusFilter | null>(null);
    const filter = selectedFilter ?? (rows.some(hasIssue) ? 'issues' : 'all');
    const [search, setSearch] = useState('');
    const [visible, setVisible] = useState(PAGE_SIZE);
    const confirm = useConfirmRaters(scope);
    const query = search.trim().toLocaleLowerCase();
    const filtered = rows.filter((row) => (filter === 'all' || (filter === 'issues' ? hasIssue(row) : row.status === filter))
        && (!query || row.name.toLocaleLowerCase().includes(query) || row.nik?.toLocaleLowerCase().includes(query)));
    return (
        <section aria-label="Penilai template" className="grid min-w-0 gap-3">
            <input type="search" aria-label="Cari penilai berdasarkan nama atau NIK" placeholder="Cari nama atau NIK"
                value={search} onChange={(event) => { setSearch(event.target.value); setVisible(PAGE_SIZE); }}
                className="h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 text-[13px]" />
            <div role="group" aria-label="Filter status penilai" className="flex flex-wrap gap-2">
                {FILTERS.map(({ value, label }) => (
                    <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setVisible(PAGE_SIZE); }}
                        className={cn('idesk-btn', filter === value ? 'is-primary' : 'is-soft')}>{label}</button>
                ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                <table aria-label="Daftar per penilai" className="w-full text-[13px]">
                    <thead className="bg-[hsl(var(--muted)/.45)]"><tr>
                        {['Nama', 'Status', 'Menilai', 'Aksi'].map((heading) => <th key={heading} scope="col" className="p-3 text-left">{heading}</th>)}
                    </tr></thead>
                    <tbody>
                        {filtered.slice(0, visible).map((row) => <PersonRow key={row.key} scope={scope} templateId={template.id} row={row}
                            pending={confirm.isPending} onConfirm={() => confirm.mutate({ raterIds: row.raterIds, confirmed: true })} />)}
                        {!filtered.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">
                            <p>Tidak ada penilai yang sesuai.</p>
                            {selectedFilter === 'issues' && <Button variant="subtle" size="sm" onClick={() => { setFilter('all'); setSearch(''); setVisible(PAGE_SIZE); }}>Tampilkan semua</Button>}
                        </td></tr>}
                    </tbody>
                </table>
            </div>
            <p aria-live="polite" className="text-[12px] text-muted-foreground">Menampilkan {Math.min(visible, filtered.length)} dari {filtered.length} penilai</p>
            {visible < filtered.length && <Button variant="soft" onClick={() => setVisible((count) => count + PAGE_SIZE)}>Muat lebih banyak</Button>}
        </section>
    );
}
