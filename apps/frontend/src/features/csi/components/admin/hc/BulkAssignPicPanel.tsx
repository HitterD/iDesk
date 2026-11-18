import { useMemo, useState } from 'react';
import { Check, Copy, Download, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAssignRatersToPics } from '../../../hooks/useCsiHc';
import { isHcDecided } from '../../../lib/hcMode';
import type { CsiHcRater } from '../../../hcTypes';
import type { DraftUser } from '../../../lib/csiAdmin';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../types';
import { MUTED_TEXT, UserMultiPicker } from '../AdminParts';
import { titleCase } from './hcFormat';
import { TemplatePullDialog } from './templates/TemplatePullDialog';

type PicRatee = CsiPeriodDetail['ratees'][number];
type SourceMode = 'copy' | 'manual' | 'template';

const subjectLabel = (subject: PicRatee) =>
    (subject.kind === 'TEAM' ? `${subject.displayName ?? ''} (Tim)` : titleCase(subject.displayName ?? ''));

function raterCountsByRatee(raters: readonly CsiHcRater[]) {
    const counts = new Map<string, { total: number; pending: number; answered: number }>();
    raters.forEach((rater) => {
        rater.periodRateeIds.forEach((rateeId) => {
            const entry = counts.get(rateeId) ?? { total: 0, pending: 0, answered: 0 };
            entry.total += 1;
            if (rater.answered) entry.answered += 1;
            else entry.pending += 1;
            counts.set(rateeId, entry);
        });
    });
    return counts;
}

export function BulkAssignPicPanel({ scope, period, subjects, raters, onClose }: {
    scope: CsiScopeParam;
    period: CsiPeriodDetail;
    subjects: PicRatee[];
    raters: readonly CsiHcRater[];
    onClose: () => void;
}) {
    const assign = useAssignRatersToPics(scope, period.id);
    const counts = useMemo(() => raterCountsByRatee(raters), [raters]);
    const zeroRaterIds = useMemo(() => subjects.filter((s) => !counts.get(s.id)?.total).map((s) => s.id), [subjects, counts]);
    const [targetIds, setTargetIds] = useState<Set<string>>(() => new Set(zeroRaterIds));
    const [mode, setMode] = useState<SourceMode>('copy');
    const [sourceRateeId, setSourceRateeId] = useState<string>(() => subjects.find((s) => (counts.get(s.id)?.total ?? 0) > 0)?.id ?? '');
    const [manualPeople, setManualPeople] = useState<DraftUser[]>([]);
    const [includeAnswered, setIncludeAnswered] = useState(false);
    const [pullOpen, setPullOpen] = useState(false);
    const decided = isHcDecided(scope, period);

    const toggleTarget = (id: string) => setTargetIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (sourceRateeId && next.has(sourceRateeId)) {
            const fallback = subjects.find((s) => !next.has(s.id) && (counts.get(s.id)?.total ?? 0) > 0)?.id ?? '';
            setSourceRateeId(fallback);
        }
        return next;
    });

    const sourceOptions = subjects.filter((s) => (counts.get(s.id)?.total ?? 0) > 0 && !targetIds.has(s.id));
    const sourceStats = sourceRateeId ? counts.get(sourceRateeId) : undefined;
    const manualAnswered = manualPeople.filter((person) => raters.some((r) => r.userId === person.id && r.answered)).length;
    const canSubmit = targetIds.size > 0 && (mode === 'copy' ? Boolean(sourceRateeId) : manualPeople.length > 0);

    const submit = async () => {
        if (!canSubmit) return;
        try {
            const result = await assign.mutateAsync({
                targetRateeIds: [...targetIds],
                ...(mode === 'copy' ? { sourceRateeId } : { raterUserIds: manualPeople.map((person) => person.id) }),
                includeAnswered,
            });
            const notes = [
                `${result.addedPairs} pasangan ditambahkan`,
                result.reopenedRaters > 0 ? `${result.reopenedRaters} penilai dibuka kembali` : null,
                result.skippedAnswered > 0 ? `${result.skippedAnswered} penilai sudah mengisi dilewati` : null,
            ].filter(Boolean);
            toast.success(notes.join(' · '));
            onClose();
        } catch {
            // Error toast handled globally by API interceptor.
        }
    };

    return (
        <div className="grid gap-3 rounded-2xl border border-[hsl(var(--idesk-sapphire)/.4)] bg-[hsl(var(--idesk-surface))] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-[13.5px] font-semibold">Atur / Salin penilai ke PIC</p>
                    <p className={MUTED_TEXT}>Tambahkan penilai sekaligus ke PIC baru atau yang belum lengkap penilainya.</p>
                </div>
                {zeroRaterIds.length > 0 && (
                    <Button variant="soft" size="sm" onClick={() => setTargetIds(new Set(zeroRaterIds))}>
                        {`Pilih yang belum punya penilai (${zeroRaterIds.length})`}
                    </Button>
                )}
            </div>

            <div className="grid gap-1.5">
                <p className="text-[12.5px] font-semibold">1. Pilih PIC tujuan</p>
                <div className="grid max-h-48 gap-1 overflow-auto rounded-xl bg-[hsl(var(--muted)/.35)] p-2 sm:grid-cols-2">
                    {subjects.map((subject) => {
                        const stat = counts.get(subject.id);
                        return (
                            <label key={subject.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[12.5px] hover:bg-[hsl(var(--idesk-surface))]">
                                <input type="checkbox" checked={targetIds.has(subject.id)} onChange={() => toggleTarget(subject.id)} />
                                <span className="min-w-0 flex-1 truncate">{subjectLabel(subject)}</span>
                                <span className={cn('shrink-0 text-[11px]', stat?.total ? 'text-[hsl(var(--idesk-text-secondary))]' : 'font-semibold text-[hsl(var(--ticket-amber-ink))]')}>
                                    {stat?.total ? `${stat.total} penilai` : '0 penilai'}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="grid gap-2">
                <p className="text-[12.5px] font-semibold">2. Sumber penilai</p>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={mode === 'copy' ? 'primary' : 'soft'} onClick={() => setMode('copy')}>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />Salin dari PIC lain
                    </Button>
                    <Button type="button" size="sm" variant={mode === 'manual' ? 'primary' : 'soft'} onClick={() => setMode('manual')}>
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />Pilih penilai manual
                    </Button>
                    {decided && (
                        <Button type="button" size="sm" variant={mode === 'template' ? 'primary' : 'soft'} onClick={() => setMode('template')}>
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />Dari Template lokasi
                        </Button>
                    )}
                </div>

                {mode === 'template' ? (
                    <div className="grid gap-2 rounded-xl bg-[hsl(var(--idesk-sapphire)/.08)] p-3 text-[12.5px]">
                        <p className="text-[hsl(var(--idesk-text-secondary))]">
                            Tarik otomatis daftar penilai yang sudah diatur di <b>Pengaturan → Template lokasi</b> untuk PIC terkait (mode tambah-saja, jawaban yang sudah masuk tetap aman).
                        </p>
                        <div>
                            <Button type="button" size="sm" variant="primary" onClick={() => setPullOpen(true)}>
                                <Download className="h-3.5 w-3.5" aria-hidden="true" />Sinkronkan dari Template Lokasi
                            </Button>
                        </div>
                    </div>
                ) : mode === 'copy' ? (
                    <div className="grid gap-1.5">
                        <Select value={sourceRateeId} onValueChange={setSourceRateeId}>
                            <SelectTrigger className="h-9" aria-label="PIC sumber penilai"><SelectValue placeholder="Pilih PIC sumber..." /></SelectTrigger>
                            <SelectContent>
                                {sourceOptions.map((subject) => {
                                    const stat = counts.get(subject.id);
                                    return (
                                        <SelectItem key={subject.id} value={subject.id}>
                                            {`${subjectLabel(subject)} (${stat?.pending ?? 0} belum · ${stat?.answered ?? 0} sudah)`}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        {sourceStats && (
                            <p className={MUTED_TEXT}>{`${sourceStats.pending} penilai belum mengisi · ${sourceStats.answered} penilai sudah mengisi.`}</p>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-1">
                        <UserMultiPicker scope={scope} label="Pilih penilai" selected={manualPeople} onChange={setManualPeople} />
                        {manualAnswered > 0 && (
                            <p className={MUTED_TEXT}>{`${manualAnswered} dari ${manualPeople.length} penilai terpilih sudah mengisi sebelumnya.`}</p>
                        )}
                    </div>
                )}
            </div>

            {mode !== 'template' && (
                <>
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-[hsl(var(--muted)/.35)] px-3 py-2 text-[12.5px]">
                        <Checkbox checked={includeAnswered} onCheckedChange={(state) => setIncludeAnswered(state === true)} className="mt-0.5" />
                        <span>
                            Sertakan penilai yang sudah terlanjur mengisi
                            <span className="block text-[11.5px] text-[hsl(var(--idesk-text-secondary))]">
                                Nilai sebelumnya tetap tersimpan; hanya PIC tambahan yang belum dinilai yang akan muncul kembali lewat popup.
                            </span>
                        </span>
                    </label>

                    <div className="flex items-center gap-2">
                        <span className={MUTED_TEXT}>{`${targetIds.size} PIC tujuan dipilih`}</span>
                        <span className="flex-1" />
                        <Button variant="subtle" onClick={onClose}>Batal</Button>
                        <Button variant="primary" disabled={!canSubmit || assign.isPending} onClick={() => void submit()}>
                            <Check aria-hidden="true" />{`Terapkan ke ${targetIds.size} PIC`}
                        </Button>
                    </div>
                </>
            )}
            {pullOpen && <TemplatePullDialog scope={scope} period={period} open onOpenChange={setPullOpen} />}
        </div>
    );
}
