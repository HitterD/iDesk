import { Star } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { questionTone, scoreTone, starTone, toneClasses } from '../../../lib/csiTone';
import { formatDate, formatFixed2, formatPercent, formatScore } from '../../../lib/format';
import type { CsiReportRatee } from '../../../types';
import { MUTED_TEXT } from '../AdminParts';
import { questionColumns, scorePct } from './reportModel';
import { kindLabel, SubjectPhoto } from './reportParts';
import { ScoreRing } from './ScoreRing';

const STARS_DESC = [5, 4, 3, 2, 1] as const;
const STARS_ASC = [1, 2, 3, 4, 5] as const;
const SECTION_TITLE = 'mb-2.5 mt-5 text-[13px] font-semibold';
const TRACK = 'h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]';

function QuestionBars({ ratee }: { ratee: CsiReportRatee }) {
    const columns = questionColumns([ratee]);
    if (!columns.length) return <p className={MUTED_TEXT}>Tidak ada pertanyaan bernilai.</p>;
    return (
        <ul className="grid gap-2.5" aria-label="Nilai per pertanyaan">
            {columns.map((column) => {
                const tone = toneClasses(questionTone(column.index));
                return (
                    <li key={column.key} className="grid grid-cols-[minmax(110px,180px)_1fr_40px] items-center gap-2.5 text-[13px]">
                        <span title={column.name} className="flex min-w-0 items-center gap-1.5">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.fill)} aria-hidden="true" />
                            <span className="truncate">{column.label}</span>
                        </span>
                        <span className={TRACK}><i className={cn('block h-full rounded-full', tone.fill)} style={{ width: `${scorePct(column.average)}%` }} /></span>
                        <b className="text-right tabular-nums">{formatScore(column.average)}</b>
                    </li>
                );
            })}
        </ul>
    );
}

function StarBreakdown({ counts }: { counts: readonly number[] }) {
    const max = Math.max(0, ...counts);
    return (
        <ul className="grid gap-2" aria-label="Sebaran bintang">
            {STARS_DESC.map((stars) => {
                const count = counts[stars - 1] ?? 0;
                return (
                    <li key={stars} className="grid grid-cols-[72px_1fr_30px] items-center gap-2.5 text-[13px]">
                        <span className="flex" aria-label={`${stars} bintang`}>
                            {STARS_ASC.map((slot) => (
                                <Star key={slot} aria-hidden="true" className={cn('h-3 w-3', slot <= stars ? 'fill-[hsl(var(--ticket-amber))] text-[hsl(var(--ticket-amber))]' : 'text-[hsl(var(--idesk-border))]')} />
                            ))}
                        </span>
                        <span className={TRACK}><i className={cn('block h-full rounded-full', toneClasses(starTone(stars)).fill)} style={{ width: `${max ? (count / max) * 100 : 0}%` }} /></span>
                        <b className="text-right tabular-nums">{count}</b>
                    </li>
                );
            })}
        </ul>
    );
}

/** Drawer for one subject: photo, score ring, per-question bars (question colours), star breakdown, comments. */
export function SubjectDetailSheet({ ratee, siteName, siteCode, onClose }: {
    ratee: CsiReportRatee | null; siteName: string | null; siteCode: string | null; onClose: () => void;
}) {
    return (
        <Sheet open={!!ratee} onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent side="right" className="max-w-lg">
                {ratee && (
                    <>
                        <SheetHeader className="pr-12">
                            <SheetTitle>{ratee.displayName}</SheetTitle>
                            <SheetDescription>{[kindLabel(ratee), ratee.jobTitle, siteName].filter(Boolean).join(' · ')}</SheetDescription>
                        </SheetHeader>
                        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                            <SubjectPhoto name={ratee.displayName} photoUrl={ratee.photoUrl} siteCode={siteCode} className="aspect-video w-full rounded-2xl" />
                            <div className="mt-4 flex items-center gap-3">
                                <ScoreRing pct={scorePct(ratee.average)} tone={scoreTone(ratee.average)} size="sm">
                                    <b className="text-[14px] tabular-nums">{formatFixed2(ratee.average)}</b>
                                </ScoreRing>
                                <span className="grid">
                                    <b className="text-[14px]">{`${ratee.respondentCount} penilai`}</b>
                                    <span className={cn(MUTED_TEXT, 'text-[12px]')}>{`indeks ${formatPercent(ratee.indexPct)}`}</span>
                                </span>
                            </div>
                            <h3 className={SECTION_TITLE}>Per pertanyaan</h3>
                            <QuestionBars ratee={ratee} />
                            <h3 className={SECTION_TITLE}>Sebaran bintang</h3>
                            <StarBreakdown counts={ratee.starDistribution} />
                            <h3 className={SECTION_TITLE}>{`Komentar (${ratee.comments.length})`}</h3>
                            {ratee.comments.length ? (
                                <ul className="grid gap-2">
                                    {ratee.comments.map((comment, index) => (
                                        <li key={`${comment.submittedAt}-${index}`} className="rounded-xl bg-[hsl(var(--muted)/.6)] px-3 py-2.5 text-[13px]">
                                            <p className="whitespace-pre-line break-words">{`“${comment.text}”`}</p>
                                            <p className={cn(MUTED_TEXT, 'mt-1 text-[12px]')}>{`${comment.departmentName} · ${formatDate(comment.submittedAt.slice(0, 10))}`}</p>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className={MUTED_TEXT}>Belum ada komentar.</p>}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
