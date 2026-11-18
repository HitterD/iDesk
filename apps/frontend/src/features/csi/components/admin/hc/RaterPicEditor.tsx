import { useMemo, useState } from 'react';
import { Check, Copy, Lock, Pencil, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCsiHcRaters, useSetCsiHcRater } from '../../../hooks/useCsiHc';
import { isRaterAdditionOpen, type DraftUser } from '../../../lib/csiAdmin';
import { toneClasses } from '../../../lib/csiTone';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../types';
import { MUTED_TEXT, UserMultiPicker } from '../AdminParts';
import { BulkAssignPicPanel } from './BulkAssignPicPanel';
import { titleCase } from './hcFormat';

/**
 * "Cari nama": search people from the employee master and tick the PICs each one rates. Also the place to adjust the
 * raters created by unit rules or an Excel import, and bulk-assign or copy raters onto newly added PICs.
 */
type PicRatee = CsiPeriodDetail['ratees'][number];
const TEAM_GROUP = 'Tim layanan';
const EMPTY_SET: ReadonlySet<string> = new Set();
const subjectLabel = (subject: PicRatee) => (subject.kind === 'TEAM' ? `${subject.displayName ?? ''} (Tim)` : titleCase(subject.displayName ?? ''));
const subjectGroup = (subject: PicRatee) =>
    subject.kind === 'TEAM' ? TEAM_GROUP : (subject.serviceCode || subject.bagian ? `${subject.serviceCode ?? '-'} · ${titleCase(subject.bagian ?? '-')}` : 'Subjek lain');

function PicChecklist({ pics, selected, lockedIds = EMPTY_SET, onToggle, onToggleMany }: {
    pics: PicRatee[]; selected: ReadonlySet<string>; lockedIds?: ReadonlySet<string>;
    onToggle: (id: string) => void; onToggleMany: (ids: string[], on: boolean) => void;
}) {
    const [query, setQuery] = useState('');
    const needle = query.trim().toLowerCase();
    const visible = pics.filter((pic) => !needle || (pic.displayName ?? '').toLowerCase().includes(needle) || (pic.bagian ?? '').toLowerCase().includes(needle) || (pic.kind === 'TEAM' && 'tim layanan'.includes(needle)));
    const groups = useMemo(() => {
        const map = new Map<string, PicRatee[]>();
        visible.forEach((pic) => {
            const key = subjectGroup(pic);
            map.set(key, [...(map.get(key) ?? []), pic]);
        });
        return [...map.entries()].sort(([a], [b]) => (a === TEAM_GROUP ? -1 : b === TEAM_GROUP ? 1 : a.localeCompare(b)));
    }, [visible]);
    return (
        <div className="grid gap-2">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" aria-hidden="true" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari PIC atau bagian" aria-label="Cari PIC"
                    className="h-9 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] pl-9 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="grid max-h-[340px] gap-2 overflow-auto pr-1 md:grid-cols-2">
                {groups.map(([group, rows]) => {
                    const mutableIds = rows.map((row) => row.id).filter((id) => !lockedIds.has(id));
                    const all = mutableIds.length > 0 && mutableIds.every((id) => selected.has(id));
                    return (
                        <div key={group} className="rounded-xl bg-[hsl(var(--idesk-surface))] p-2">
                            <button type="button" disabled={!mutableIds.length} onClick={() => onToggleMany(mutableIds, !all)}
                                className="mb-1 w-full text-left text-[11.5px] font-bold uppercase tracking-wide text-[hsl(var(--idesk-text-secondary))]">
                                {`${group} · ${rows.length}`}
                                {mutableIds.length > 0 && <span className="ml-1 normal-case text-[hsl(var(--idesk-sapphire))]">{all ? '(batal semua)' : '(pilih semua)'}</span>}
                            </button>
                            {rows.map((pic) => {
                                const isLocked = lockedIds.has(pic.id);
                                return (
                                    <label key={pic.id} className={cn('flex items-start gap-2 rounded-lg px-1.5 py-1',
                                        isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-[hsl(var(--muted)/.6)]')}>
                                        <input type="checkbox" className="mt-0.5" disabled={isLocked} checked={selected.has(pic.id)} onChange={() => onToggle(pic.id)} />
                                        <span className="min-w-0 flex-1 text-[13px] leading-snug">{subjectLabel(pic)}</span>
                                        {isLocked && <Lock className="mt-0.5 h-3 w-3 shrink-0 opacity-50" aria-label="Sudah dinilai" />}
                                    </label>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function RaterPicEditor({ scope, period, pics, ratees = pics }: { scope: CsiScopeParam; period: CsiPeriodDetail; pics: PicRatee[]; ratees?: PicRatee[] }) {
    const { data: raters = [], isLoading } = useCsiHcRaters(scope, period.id);
    const save = useSetCsiHcRater(scope, period.id);
    const [people, setPeople] = useState<DraftUser[]>([]);
    const [editing, setEditing] = useState<{ userIds: string[]; label: string; lockedIds: ReadonlySet<string> } | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [query, setQuery] = useState('');
    const addOnlyLocked = period.locked && isRaterAdditionOpen(period);
    const fullyLocked = period.locked && !addOnlyLocked;
    const subjects = ratees;
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const subjectName = new Map(subjects.map((subject) => [subject.id, subjectLabel(subject)]));
    const open = (userIds: string[], label: string, current: string[] = [], lockedIds: ReadonlySet<string> = EMPTY_SET) => {
        setEditing({ userIds, label, lockedIds });
        setSelected(new Set(current));
    };
    const toggle = (id: string) => {
        if (editing?.lockedIds.has(id)) return;
        setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };
    const toggleMany = (ids: string[], on: boolean) => setSelected((previous) => {
        const next = new Set(previous);
        ids.forEach((id) => {
            if (on) next.add(id);
            else if (!editing?.lockedIds.has(id)) next.delete(id);
        });
        return next;
    });
    const commit = async () => {
        if (!editing) return;
        try {
            for (const userId of editing.userIds) await save.mutateAsync({ userId, periodRateeIds: [...selected] });
            toast.success(`${editing.userIds.length} penilai disimpan`);
            setEditing(null);
            setPeople([]);
        } catch {
            // Axios interceptor displays the server error toast; keep the editor open so selections are not lost.
        }
    };
    const needle = query.trim().toLowerCase();
    const shown = raters.filter((rater) => !needle || [rater.fullName, rater.nik, rater.division, rater.department, rater.bagian].some((value) => (value ?? '').toLowerCase().includes(needle)));
    const registeredIds = new Set(raters.map((rater) => rater.userId));
    const pairedRateeIds = new Set(raters.flatMap((rater) => rater.periodRateeIds));
    const unpairedCount = subjects.filter((subject) => !pairedRateeIds.has(subject.id)).length;
    const mustPickOne = addOnlyLocked && selected.size === 0;
    return (
        <div className="grid gap-4">
            {!fullyLocked && (
                <div className="grid gap-2 rounded-2xl bg-[hsl(var(--muted)/.45)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold">1. Cari penilai dari master karyawan (nama, email atau NIK)</p>
                        {subjects.length > 0 && (
                            <Button variant={unpairedCount > 0 ? 'primary' : 'soft'} size="sm" onClick={() => setBulkOpen((v) => !v)}>
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                {unpairedCount > 0 ? `Atur penilai PIC baru (${unpairedCount} belum punya penilai)` : 'Atur / Salin penilai ke PIC'}
                            </Button>
                        )}
                    </div>
                    <UserMultiPicker scope={scope} label="Cari penilai" selected={people} onChange={setPeople} excludeIds={addOnlyLocked ? registeredIds : undefined} />
                    <div><Button variant="primary" disabled={!people.length} onClick={() => open(people.map((person) => person.id), `${people.length} penilai baru`)}>2. Pilih PIC yang dinilai</Button></div>
                </div>
            )}
            {!fullyLocked && bulkOpen && (
                <BulkAssignPicPanel scope={scope} period={period} subjects={subjects} raters={raters} onClose={() => setBulkOpen(false)} />
            )}
            {editing && (
                <div className="grid gap-3 rounded-2xl border border-[hsl(var(--idesk-sapphire)/.4)] p-3">
                    <div>
                        <p className="text-[13px] font-semibold">{`PIC yang dinilai oleh ${editing.label}`}</p>
                        {editing.lockedIds.size > 0 && (
                            <p className={MUTED_TEXT}>PIC bertanda gembok sudah dinilai. Centang PIC tambahan untuk membukakan penilaian susulan.</p>
                        )}
                    </div>
                    <PicChecklist pics={subjects} selected={selected} lockedIds={editing.lockedIds} onToggle={toggle} onToggleMany={toggleMany} />
                    <div className="flex items-center gap-2">
                        <span className={MUTED_TEXT}>{mustPickOne ? 'Pilih minimal 1 PIC saat survei sudah punya jawaban' : `${selected.size} PIC dipilih`}</span>
                        <span className="flex-1" />
                        <Button variant="subtle" onClick={() => setEditing(null)}>Batal</Button>
                        <Button variant="primary" disabled={save.isPending || mustPickOne} onClick={() => void commit()}><Check aria-hidden="true" />Simpan</Button>
                    </div>
                </div>
            )}
            <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold">{`Penilai survei ini · ${raters.length} orang`}</p>
                    <span className="flex-1" />
                    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari penilai, NIK, divisi" aria-label="Cari penilai"
                        className="h-9 w-64 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" aria-busy="true" />}
                <ul className="grid max-h-[420px] gap-1 overflow-auto">
                    {shown.map((rater) => {
                        const ratedIds = new Set(rater.ratedRateeIds ?? (rater.answered ? rater.periodRateeIds : []));
                        const pendingAdditional = rater.answered ? rater.periodRateeIds.filter((id) => !ratedIds.has(id)).length : 0;
                        return (
                            <li key={rater.userId} className={cn('grid items-center gap-2 rounded-xl px-3 py-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto]', 'bg-[hsl(var(--idesk-surface))] ring-1 ring-[hsl(var(--border)/.6)]')}>
                                <span className="min-w-0">
                                    <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
                                        <span>{rater.fullName}</span>
                                        {rater.answered && (
                                            <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold', toneClasses('neutral').soft, MUTED_TEXT)}>
                                                <Lock className="h-2.5 w-2.5" aria-hidden="true" />Sudah mengisi
                                            </span>
                                        )}
                                        {pendingAdditional > 0 && (
                                            <span className="inline-flex items-center rounded-full bg-[hsl(var(--ticket-amber)/.14)] px-1.5 py-px text-[10.5px] font-semibold text-[hsl(var(--ticket-amber-ink))]">
                                                {`+${pendingAdditional} PIC belum diisi`}
                                            </span>
                                        )}
                                    </span>
                                    <span className="block text-[11.5px] text-[hsl(var(--idesk-text-secondary))]">{[rater.nik, titleCase(rater.division ?? ''), titleCase(rater.department ?? ''), rater.siteCode].filter(Boolean).join(' · ')}</span>
                                </span>
                                <span className="min-w-0 text-[12px] leading-snug text-[hsl(var(--idesk-text-secondary))]">
                                    {`${rater.periodRateeIds.length} ${rater.periodRateeIds.some((id) => subjectById.get(id)?.kind === 'TEAM') ? 'subjek' : 'PIC'}: `}{rater.periodRateeIds.map((id) => subjectName.get(id) ?? '?').join(', ')}
                                </span>
                                {!fullyLocked && (
                                    <span className="flex gap-1">
                                        <Button variant="subtle" size="icon" disabled={save.isPending} aria-label={`Ubah PIC untuk ${rater.fullName}`}
                                            onClick={() => open([rater.userId], rater.fullName, rater.periodRateeIds, rater.answered ? ratedIds : EMPTY_SET)}><Pencil aria-hidden="true" /></Button>
                                        {!addOnlyLocked && !rater.answered && (
                                            <Button variant="subtle" size="icon" disabled={save.isPending} aria-label={`Hapus ${rater.fullName}`} onClick={() => save.mutate({ userId: rater.userId, periodRateeIds: [] })}><Trash2 aria-hidden="true" /></Button>
                                        )}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                    {!isLoading && !shown.length && <li className={cn(MUTED_TEXT, 'px-3 py-4')}>Belum ada penilai.</li>}
                </ul>
            </div>
        </div>
    );
}
