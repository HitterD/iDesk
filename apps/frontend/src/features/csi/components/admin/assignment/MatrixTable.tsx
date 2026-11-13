import { Check, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { siteTone, toneClasses } from '../../../lib/csiTone';
import { SubjectAvatar } from '../../respond/RateeAvatar';
import { MUTED_TEXT } from '../AdminParts';
import { isCross, isSelf, pairKey, type MatrixData, type PairKey, type SiteGroup } from './matrixModel';

type Rater = MatrixData['raters'][number];
type Ratee = MatrixData['ratees'][number];
export interface SiteInfo { code: string | null; name: string }

export const SELF_TITLE = 'Tidak bisa menilai diri sendiri';
export const NO_SITE: SiteInfo = { code: null, name: 'Tanpa site' };
const STICKY_HEAD = 'sticky z-[2] bg-[hsl(var(--idesk-surface))] text-[11.5px] font-semibold align-bottom';
const GROUP_START = 'border-l-2 border-l-[hsl(var(--idesk-border))]';
const CELL_BASE = 'mx-auto grid h-[26px] w-[26px] place-items-center rounded-lg transition-[background-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none';

export interface MatrixTableProps {
    /** "ICT" / "HC", prefixed to the subject site headers ("ICT Sepanjang"). */
    scopeLabel: string;
    rateeGroups: SiteGroup<Ratee>[];
    raterGroups: SiteGroup<Rater>[];
    pairs: ReadonlySet<PairKey>;
    siteHandlers?: Record<string, string>;
    siteOf: (siteId: string | null) => SiteInfo;
    readOnly: boolean;
    overrides: ReadonlySet<string>;
    onToggle: (cells: 'row' | 'col' | 'site' | 'cell', id: string) => void;
    onEditSubject: (rateeId: string) => void;
}

function SiteHeader({ scopeLabel, group, site, count, readOnly, onSite }: {
    scopeLabel: string; group: SiteGroup<Ratee>; site: SiteInfo; count: number; readOnly: boolean; onSite: () => void;
}) {
    const tone = toneClasses(siteTone(site.code));
    return (
        <th colSpan={count} scope="colgroup" className={cn(STICKY_HEAD, 'top-0 h-[46px] px-2.5 py-1.5 text-left', tone.soft, GROUP_START)}>
            <div className="flex items-center gap-2 whitespace-nowrap">
                {site.code && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white', tone.fill)}>{site.code}</span>}
                <b className="text-[12.5px]">{`${scopeLabel} ${site.name}`}</b>
                <span className={cn(MUTED_TEXT, 'text-[11.5px]')}>{`${count} subjek`}</span>
                {!readOnly && group.siteId && site.code && (
                    <button type="button" onClick={onSite} title={`Centang semua penilai ${site.code} untuk semua subjek ${site.code}`}
                        className="ml-auto inline-flex h-6 items-center gap-1 rounded-lg bg-[hsl(var(--idesk-surface))] px-2 text-[11.5px] font-semibold shadow-[0_0_0_1px_hsl(var(--idesk-border))] hover:shadow-[0_0_0_1.5px_hsl(var(--idesk-sapphire))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Check className="h-3 w-3" aria-hidden="true" />{`Penilai ${site.code}`}
                    </button>
                )}
            </div>
        </th>
    );
}

function SubjectHeader({ ratee, site, first, readOnly, override, onCol, onEdit }: {
    ratee: Ratee; site: SiteInfo; first: boolean; readOnly: boolean; override: boolean; onCol: () => void; onEdit: () => void;
}) {
    const label = ratee.kind === 'TEAM' ? 'Tim' : ratee.name.split(/[ ,]/)[0];
    return (
        <th scope="col" className={cn(STICKY_HEAD, 'top-[46px] min-w-[82px] px-1.5 py-2 text-center', first && GROUP_START)}>
            <button type="button" onClick={onCol} disabled={readOnly} aria-label={`Pilih kolom ${ratee.name}`} title={`${ratee.name} — klik untuk satu kolom`}
                className="mx-auto grid justify-items-center gap-1 rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default">
                <SubjectAvatar ratee={{ displayName: ratee.name, photoUrl: ratee.photoUrl, avatarUrl: null, siteCode: site.code }} className="h-[30px] w-[30px] text-[12px]" />
                <span className="block max-w-[84px] truncate leading-tight">{label}</span>
            </button>
            <div className="mt-1 flex items-center justify-center gap-1">
                {override && <span className={cn('rounded-full px-1.5 py-px text-[11px] font-semibold', toneClasses('sky').soft, toneClasses('sky').ink)}>Khusus periode</span>}
                <button type="button" onClick={onEdit} aria-label={`Ubah tampilan ${ratee.name} untuk periode ini`} title="Ubah tampilan untuk periode ini"
                    className="grid h-6 w-6 place-items-center rounded-md text-[hsl(var(--idesk-text-secondary))] hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                </button>
            </div>
        </th>
    );
}

function MatrixCell({ rater, ratee, on, cross, readOnly, onToggle }: { rater: Rater; ratee: Ratee; on: boolean; cross: boolean; readOnly: boolean; onToggle: () => void }) {
    if (isSelf(rater, ratee)) {
        return <div title={SELF_TITLE} className={cn(CELL_BASE, 'cursor-not-allowed', toneClasses('neutral').soft, MUTED_TEXT)}>–</div>;
    }
    const tone = cross ? 'amber' : 'green';
    return (
        <button type="button" role="checkbox" aria-checked={on} aria-label={`${rater.fullName} menilai ${ratee.name}`} disabled={readOnly} onClick={onToggle}
            className={cn(CELL_BASE, on ? cn(toneClasses(tone).fill, 'text-white') : 'shadow-[0_0_0_1.5px_hsl(var(--idesk-border))]',
                !readOnly && 'hover:scale-110 motion-reduce:hover:scale-100', readOnly && 'cursor-default opacity-70')}>
            {on && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
        </button>
    );
}

function RaterRow({ rater, columns, pairs, siteHandlers, readOnly, onToggle }: {
    rater: Rater; columns: Array<{ ratee: Ratee; first: boolean }>; pairs: ReadonlySet<PairKey>; siteHandlers?: Record<string, string>; readOnly: boolean;
    onToggle: MatrixTableProps['onToggle'];
}) {
    const count = columns.filter(({ ratee }) => pairs.has(pairKey(rater.periodRaterId, ratee.periodRateeId))).length;
    return (
        <tr className="group">
            <th scope="row" className="sticky left-0 z-[1] min-w-[min(230px,46vw)] border-b border-[hsl(var(--idesk-border)/.6)] bg-[hsl(var(--idesk-surface))] px-2.5 py-2 text-left font-medium group-hover:bg-[hsl(var(--muted))]">
                <button type="button" onClick={() => onToggle('row', rater.periodRaterId)} disabled={readOnly} aria-label={`Pilih baris ${rater.fullName}`}
                    title="Klik untuk satu baris" className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default">
                    <span className="block text-[13px]">{rater.fullName}</span>
                    <span className={cn(MUTED_TEXT, 'block text-[11.5px]')}>{rater.department ?? '—'}</span>
                </button>
            </th>
            {columns.map(({ ratee, first }) => {
                const key = pairKey(rater.periodRaterId, ratee.periodRateeId);
                const cross = isCross(rater, ratee, siteHandlers);
                return (
                    <td key={ratee.periodRateeId} className={cn('border-b border-[hsl(var(--idesk-border)/.6)] px-2 py-2 group-hover:bg-[hsl(var(--muted))]',
                        first && GROUP_START, cross && toneClasses('amber').soft)}>
                        <MatrixCell rater={rater} ratee={ratee} on={pairs.has(key)} cross={cross} readOnly={readOnly} onToggle={() => onToggle('cell', key)} />
                    </td>
                );
            })}
            <td className="border-b border-[hsl(var(--idesk-border)/.6)] px-2.5 text-center font-bold tabular-nums">{count}</td>
        </tr>
    );
}

/** Rater × subject grid: columns grouped per ICT site, rows per rater site; header and name column sticky. */
export function MatrixTable({ scopeLabel, rateeGroups, raterGroups, pairs, siteHandlers, siteOf, readOnly, overrides, onToggle, onEditSubject }: MatrixTableProps) {
    const columns = rateeGroups.flatMap((group) => group.items.map((ratee, index) => ({ ratee, first: index === 0 })));
    const span = columns.length + 2;
    return (
        <div className="max-h-[600px] overflow-auto rounded-[14px] shadow-[0_0_0_1px_hsl(var(--idesk-border)/.7)]">
            <table className="w-full border-separate border-spacing-0 text-[13px]">
                <thead>
                    <tr>
                        <th rowSpan={2} scope="col" className={cn(STICKY_HEAD, 'left-0 top-0 z-[4] px-2.5 text-left')}>Penilai</th>
                        {rateeGroups.map((group) => (
                            <SiteHeader key={group.siteId ?? 'none'} scopeLabel={scopeLabel} group={group} site={siteOf(group.siteId)} count={group.items.length} readOnly={readOnly}
                                onSite={() => group.siteId && onToggle('site', group.siteId)} />
                        ))}
                        <th rowSpan={2} scope="col" className={cn(STICKY_HEAD, 'top-0 px-2.5')}>Jumlah</th>
                    </tr>
                    <tr>
                        {columns.map(({ ratee, first }) => (
                            <SubjectHeader key={ratee.periodRateeId} ratee={ratee} site={siteOf(ratee.siteId)} first={first} readOnly={readOnly}
                                override={overrides.has(ratee.periodRateeId)} onCol={() => onToggle('col', ratee.periodRateeId)} onEdit={() => onEditSubject(ratee.periodRateeId)} />
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {raterGroups.length ? raterGroups.flatMap((group) => {
                        const site = group.siteId ? siteOf(group.siteId) : NO_SITE;
                        const tone = toneClasses(siteTone(site.code));
                        return [
                            <tr key={`g-${group.siteId ?? 'none'}`}>
                                <td colSpan={span} className={cn('p-0', tone.soft)}>
                                    <div className={cn('sticky left-0 inline-flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[.04em]', tone.ink)}>
                                        {`Penilai dari ${site.name} · ${group.items.length} orang`}
                                    </div>
                                </td>
                            </tr>,
                            ...group.items.map((rater) => (
                                <RaterRow key={rater.periodRaterId} rater={rater} columns={columns} pairs={pairs} siteHandlers={siteHandlers} readOnly={readOnly} onToggle={onToggle} />
                            )),
                        ];
                    }) : (
                        <tr><td colSpan={span} className={cn(MUTED_TEXT, 'px-4 py-8 text-center')}>Tidak ada penilai yang cocok.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
