import { BriefcaseBusiness, Star } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { questionTone, scoreTone, scoreWord, starTone, toneClasses, type CsiScoreBands } from '../../../lib/csiTone';
import { formatFixed2, formatPercent, formatScore } from '../../../lib/format';
import type { CsiReportRatee } from '../../../types';
import { MUTED_TEXT } from '../AdminParts';
import { titleCase } from '../hc/hcFormat';
import { questionColumns, scorePct } from './reportModel';
import { kindLabel, SiteBadge, SubjectPhoto } from './reportParts';
import { ScoreRing } from './ScoreRing';

const STARS_DESC = [5, 4, 3, 2, 1] as const;
const STARS_ASC = [1, 2, 3, 4, 5] as const;
const SECTION_CARD = 'rounded-2xl border border-border/60 bg-card p-4';
const SECTION_TITLE = 'mb-3 text-[13px] font-semibold';
const TRACK = 'h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]';

const hashComment = (text: string) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
};
const scrambleComments = (comments: CsiReportRatee['comments']) =>
    comments.map((comment) => comment.text).sort((a, b) => hashComment(a) - hashComment(b) || a.localeCompare(b, 'id'));

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

/** Drawer for one subject: proportional photo card, score summary, per-question bars, star breakdown, comments. */
export function SubjectDetailSheet({ ratee, siteName, siteCode, bands, onClose }: {
    ratee: CsiReportRatee | null; siteName: string | null; siteCode: string | null; bands: CsiScoreBands; onClose: () => void;
}) {
    const scoreClass = ratee ? toneClasses(scoreTone(ratee.average, bands)) : null;
    const meta = ratee
        ? [kindLabel(ratee), ratee.jobTitle ? titleCase(ratee.jobTitle) : null, ratee.bagian ? titleCase(ratee.bagian) : null, siteName]
            .filter(Boolean)
            .join(' · ')
        : '';
    return (
        <Sheet open={!!ratee} onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent side="right" className="max-w-xl">
                {ratee && (
                    <>
                        <SheetHeader className="pr-12">
                            <SheetTitle>{ratee.displayName}</SheetTitle>
                            <SheetDescription>{meta}</SheetDescription>
                        </SheetHeader>
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
                            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                                <SubjectPhoto name={ratee.displayName} photoUrl={ratee.photoUrl} siteCode={siteCode}
                                    fit="contain" className="aspect-[4/3] max-h-[340px] w-full" />
                                {(siteCode || ratee.serviceCode || ratee.serviceFunction) && (
                                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 bg-[hsl(var(--muted)/.35)] px-3.5 py-2.5">
                                        <SiteBadge code={siteCode} />
                                        {ratee.serviceCode && (
                                            <span className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-bold text-foreground">{ratee.serviceCode}</span>
                                        )}
                                        {ratee.serviceFunction && (
                                            <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-[11.5px] font-medium text-foreground">
                                                <BriefcaseBusiness className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                                                <span className="break-words">{ratee.serviceFunction}</span>
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3.5 rounded-2xl bg-[hsl(var(--muted)/.45)] p-3.5">
                                <ScoreRing pct={scorePct(ratee.average)} tone={scoreTone(ratee.average, bands)} size="sm">
                                    <b className="text-[14px] tabular-nums">{formatFixed2(ratee.average)}</b>
                                </ScoreRing>
                                <span className="grid min-w-0 flex-1">
                                    <b className="text-[14px]">{`${ratee.respondentCount} penilai`}</b>
                                    <span className={cn(MUTED_TEXT, 'text-[12px]')}>{`indeks ${formatPercent(ratee.indexPct)}`}</span>
                                </span>
                                {ratee.average !== null && scoreClass && (
                                    <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', scoreClass.soft, scoreClass.ink)}>
                                        {scoreWord(ratee.average, bands)}
                                    </span>
                                )}
                            </div>

                            <section className={SECTION_CARD}>
                                <h3 className={SECTION_TITLE}>Per pertanyaan</h3>
                                <QuestionBars ratee={ratee} />
                            </section>

                            <section className={SECTION_CARD}>
                                <h3 className={SECTION_TITLE}>Sebaran bintang</h3>
                                <StarBreakdown counts={ratee.starDistribution} />
                            </section>

                            <section className={SECTION_CARD}>
                                <h3 className={SECTION_TITLE}>{`Komentar (${ratee.comments.length})`}</h3>
                                {ratee.comments.length ? (
                                    <ul className="grid gap-2">
                                        {scrambleComments(ratee.comments).map((text, index) => (
                                            <li key={`${index}:${text.slice(0, 24)}`} className="rounded-xl bg-[hsl(var(--muted)/.55)] px-3 py-2.5 text-[13px]">
                                                <p className="whitespace-pre-line break-words">{`“${text}”`}</p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className={MUTED_TEXT}>Belum ada komentar.</p>}
                            </section>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
