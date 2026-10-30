import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCopy, Eraser, Info, Save, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { useApplyCsiAssignmentTemplate, useCsiAssignments, useSaveCsiAssignments, useSaveCsiTemplate } from '../../../hooks/useCsi';
import { CSI_SCOPE_OF } from '../../../lib/csiAdmin';
import { toneClasses } from '../../../lib/csiTone';
import { useServerDraft } from '../../../lib/useServerDraft';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../types';
import { ADMIN_PANEL, LockedNote, MUTED_TEXT } from '../AdminParts';
import { SubjectEditSheet, type SubjectEditTarget } from '../subjects/SubjectEditSheet';
import { MatrixTable, NO_SITE, type MatrixTableProps, type SiteInfo } from './MatrixTable';
import { ALL_SITES, MatrixFilterBar, MatrixStatCards } from './MatrixToolbar';
import {
    colCells, groupBySite, rowCells, sameSiteCells, samePairs, siteCells, stats, toggleCells, toPairs, toPairSet, unpairedRaterCount, withRateeUsers,
    type MatrixData, type PairKey,
} from './matrixModel';

export const OPEN_MODE_NOTE = 'Mode terbuka: semua user aktif di site dapat mengisi dan menilai semua subjek. Ganti ke "Penilai terpilih" untuk memakai matriks ini.';
const SAVED_TOAST = 'Pemetaan penilai disimpan';
const TEMPLATE_SAVED_TOAST = 'Template pemetaan disimpan';
const TEMPLATE_APPLIED_TOAST = 'Pemetaan disalin dari template';
const SAVE_FIRST_HINT = 'Simpan atau batalkan perubahan dulu';

type Toggle = Parameters<MatrixTableProps['onToggle']>;

function cellsFor(data: MatrixData, kind: Toggle[0], id: string): PairKey[] {
    if (kind === 'row') return rowCells(data, id);
    if (kind === 'col') return colCells(data, id);
    if (kind === 'site') return siteCells(data, id);
    return [id as PairKey];
}

/** Local pairs seeded from the server view; re-seeded when the saved pairs or members change. */
function useMatrixDraft(data: MatrixData | null) {
    const saved = useMemo(() => toPairSet(data?.pairs ?? []), [data]);
    const signature = data
        ? [data.raters.map((rater) => rater.periodRaterId), data.ratees.map((ratee) => ratee.periodRateeId), [...saved].sort()].map((ids) => ids.join(',')).join(';')
        : '';
    const [pairs, setPairs] = useServerDraft<Set<PairKey>>(() => new Set(saved), signature);
    return { pairs, setPairs, dirty: !samePairs(pairs, saved) };
}

function siteLookup(period: CsiPeriodDetail) {
    const sites = new Map(period.sites.map((site) => [site.id, { code: site.code, name: site.name ?? site.code ?? NO_SITE.name }]));
    return (siteId: string | null): SiteInfo => (siteId && sites.get(siteId)) || NO_SITE;
}

function MatrixActions({ scope, periodId, data, dirty, onReplace, onSave, saving }: {
    scope: CsiScopeParam; periodId: string; data: MatrixData; dirty: boolean; onReplace: (pairs: Set<PairKey>) => void; onSave: () => void; saving: boolean;
}) {
    const saveTemplate = useSaveCsiTemplate(scope, periodId);
    const applyTemplate = useApplyCsiAssignmentTemplate(scope, periodId);
    // Template actions work on the saved pairs, so they wait until local edits are saved.
    const templateHint = dirty ? SAVE_FIRST_HINT : undefined;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="soft" onClick={() => onReplace(sameSiteCells(data))}><Zap aria-hidden="true" />Isi otomatis: sama site</Button>
            <Button variant="soft" onClick={() => onReplace(new Set())}><Eraser aria-hidden="true" />Kosongkan</Button>
            <Button variant="soft" disabled={dirty} title={templateHint} loading={applyTemplate.isPending}
                onClick={() => applyTemplate.mutate(undefined, { onSuccess: () => toast.success(TEMPLATE_APPLIED_TOAST) })}>
                <ClipboardCopy aria-hidden="true" />Salin dari template
            </Button>
            <Button variant="soft" disabled={dirty} title={templateHint} loading={saveTemplate.isPending}
                onClick={() => saveTemplate.mutate(undefined, { onSuccess: () => toast.success(TEMPLATE_SAVED_TOAST) })}>
                Simpan sebagai template
            </Button>
            <span className="flex-1" />
            {dirty && <span role="status" className={cn('text-[12.5px] font-medium', toneClasses('amber').ink)}>Ada perubahan yang belum disimpan</span>}
            <Button variant="primary" onClick={onSave} disabled={!dirty} loading={saving}><Save aria-hidden="true" />Simpan</Button>
        </div>
    );
}

function OpenModeNote() {
    return (
        <p role="note" className={cn('flex items-start gap-2 rounded-2xl px-4 py-3 text-[13px] font-medium', toneClasses('sky').soft, toneClasses('sky').ink)}>
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{OPEN_MODE_NOTE}
        </p>
    );
}

/** Mapped period with raters left out: they are not in the audience, so they will not see the survey. */
function UnpairedRatersNote({ count }: { count: number }) {
    return (
        <p role="note" className={cn('flex items-start gap-2 rounded-2xl px-4 py-3 text-[13px] font-medium', toneClasses('amber').soft, toneClasses('amber').ink)}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {`${count} penilai belum punya subjek — mereka tidak akan melihat survei ini.`}
        </p>
    );
}

/** Period-ratee override → master-mode sheet shape (`key` = periodRateeId). */
function periodTarget(period: CsiPeriodDetail, data: MatrixData, rateeId: string, siteOf: (id: string | null) => SiteInfo): SubjectEditTarget | null {
    const ratee = data.ratees.find((item) => item.periodRateeId === rateeId);
    if (!ratee) return null;
    const row = period.ratees.find((item) => item.id === rateeId);
    const site = siteOf(ratee.siteId);
    return {
        subject: {
            key: rateeId, kind: ratee.kind, userId: ratee.userId, teamId: row?.teamId ?? null, siteId: ratee.siteId ?? '', name: ratee.name,
            jobTitle: row?.jobTitle ?? null, photoUrl: ratee.photoUrl, tagline: row?.tagline ?? null,
        },
        group: { siteId: ratee.siteId ?? '', siteCode: site.code ?? '', siteName: site.name, team: null, people: [] },
        photoOverride: Boolean(row?.photoUrl),
    };
}

interface AssignmentMatrixProps {
    scope: CsiScopeParam;
    period: CsiPeriodDetail;
    onDirtyChange?: (dirty: boolean) => void;
}

/** Period tab "Penilai": rater × subject matrix grouped per ICT site, edited locally and saved in one PUT. */
export function AssignmentMatrix({ scope, period, onDirtyChange }: AssignmentMatrixProps) {
    const { data: view, isLoading, isError, refetch } = useCsiAssignments(scope, period.id);
    const save = useSaveCsiAssignments(scope, period.id);
    const data = useMemo(() => (view ? withRateeUsers(view, period.ratees) : null), [view, period.ratees]);
    const { pairs, setPairs, dirty } = useMatrixDraft(data);
    const [search, setSearch] = useState('');
    const [site, setSite] = useState<string>(ALL_SITES);
    const [editing, setEditing] = useState<string | null>(null);
    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
    const siteOf = useMemo(() => siteLookup(period), [period]);

    if (isLoading) return <div className={cn(ADMIN_PANEL, 'h-48 animate-pulse motion-reduce:animate-none')} aria-busy="true" aria-label="Memuat matriks penilai" />;
    if (isError || !data) return <ErrorState compact message="Gagal memuat pemetaan penilai." onRetry={() => refetch()} />;

    const open = period.respondentMode === 'OPEN';
    const readOnly = open || period.locked;
    const order = period.sites.map((item) => item.id);
    const term = search.trim().toLowerCase();
    const raters = data.raters.filter((rater) => (site === ALL_SITES || rater.siteId === site)
        && `${rater.fullName} ${rater.department ?? ''}`.toLowerCase().includes(term));
    const overrides = new Set(period.ratees.filter((ratee) => ratee.tagline || ratee.photoUrl).map((ratee) => ratee.id));
    const siteOptions = [{ value: ALL_SITES, label: 'Semua site' },
        ...groupBySite(data.raters, order).flatMap((group) => (group.siteId ? [{ value: group.siteId, label: siteOf(group.siteId).code ?? siteOf(group.siteId).name }] : []))];
    const onToggle = (kind: Toggle[0], id: string) => setPairs((current) => toggleCells(current, cellsFor(data, kind, id)));
    const submit = () => save.mutate(toPairs(data, pairs), { onSuccess: () => toast.success(SAVED_TOAST) });
    const unpaired = open ? 0 : unpairedRaterCount(data, pairs);

    return (
        <div className="grid gap-4">
            {open && <OpenModeNote />}
            {unpaired > 0 && <UnpairedRatersNote count={unpaired} />}
            <MatrixStatCards stats={stats(data, pairs)} />
            <section aria-label="Siapa menilai siapa" className={cn(ADMIN_PANEL, 'grid gap-3 p-4 sm:p-5')}>
                <MatrixFilterBar scope={scope} periodId={period.id} search={search} onSearch={setSearch} site={site} onSite={setSite} siteOptions={siteOptions}
                    raterUserIds={data.raters.map((rater) => rater.userId)} canAdd={!readOnly && !dirty} />
                {period.locked && !open && <LockedNote />}
                {!readOnly && <MatrixActions scope={scope} periodId={period.id} data={data} dirty={dirty} onReplace={setPairs} onSave={submit} saving={save.isPending} />}
                {!readOnly && <p className={cn(MUTED_TEXT, 'text-[12px]')}>Klik nama penilai = satu baris · klik foto subjek = satu kolom · tombol di header site = semua penilai site itu</p>}
                <MatrixTable scopeLabel={CSI_SCOPE_OF[scope]} rateeGroups={groupBySite(data.ratees, order)} raterGroups={groupBySite(raters, order)} pairs={pairs}
                    siteOf={siteOf} readOnly={readOnly} overrides={overrides} onToggle={onToggle} onEditSubject={setEditing} />
            </section>
            <SubjectEditSheet mode="period" periodId={period.id} scope={scope} scopeLabel={CSI_SCOPE_OF[scope]}
                target={editing ? periodTarget(period, data, editing, siteOf) : null} onClose={() => setEditing(null)} />
        </div>
    );
}
