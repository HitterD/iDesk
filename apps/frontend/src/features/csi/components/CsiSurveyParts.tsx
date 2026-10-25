import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { m, useReducedMotion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Clock3, SearchX, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StarRating } from './StarRating';
import { CSI_COMMENT_MAX, rateeAverage, type CsiScores } from '../lib/csiForm';
import { formatAverage } from '../lib/format';
import type { CsiOpenForm } from '../types';

type Ratee = CsiOpenForm['ratees'][number];

/** Shared card surface: generous padding, hairline border, soft shadow; tokens keep dark mode working. */
export const CSI_CARD = 'rounded-2xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/.04)]';
const ENTER_EASE = [0.22, 1, 0.36, 1] as const;
const STAGGER_SECONDS = 0.04;
const MAX_STAGGER_STEPS = 6;

/** Subtle fade + rise; MotionConfig(reducedMotion="user") and useReducedMotion both switch it off. */
export function FadeIn({ index = 0, className, children }: { index?: number; className?: string; children: ReactNode }) {
    const reduce = useReducedMotion();
    return (
        <m.div className={className}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: ENTER_EASE, delay: Math.min(index, MAX_STAGGER_STEPS) * STAGGER_SECONDS }}>
            {children}
        </m.div>
    );
}

export function BackLink({ to, label = 'Kembali ke daftar survei' }: { to: string; label?: string }) {
    return (
        <Link to={to} className="idesk-text-link">
            <ArrowLeft aria-hidden="true" />{label}
        </Link>
    );
}

type StatusTone = 'success' | 'warning' | 'muted';
const STATUS_ICONS = { success: CheckCircle2, warning: Clock3, muted: SearchX } as const;
const STATUS_TINTS: Record<StatusTone, string> = {
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    muted: 'bg-muted text-muted-foreground',
};

/** Full-card end state: thank-you, already submitted, period ended, or not found. */
export function CsiStatusScreen({ tone, title, message, backTo }: { tone: StatusTone; title: string; message?: string; backTo: string }) {
    const Icon = STATUS_ICONS[tone];
    return (
        <FadeIn className={cn(CSI_CARD, 'mx-auto max-w-xl px-6 py-12 sm:px-10 sm:py-16 text-center')}>
            <div role="status" className="flex flex-col items-center">
                <span className={cn('mb-5 grid h-16 w-16 place-items-center rounded-full', STATUS_TINTS[tone])}>
                    <Icon className="h-8 w-8" aria-hidden="true" />
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                {message && <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground whitespace-pre-line">{message}</p>}
                <div className="mt-8"><BackLink to={backTo} /></div>
            </div>
        </FadeIn>
    );
}

export function IdentityCard({ form, departmentId, onDepartmentChange }: {
    form: CsiOpenForm; departmentId: string; onDepartmentChange: (id: string) => void;
}) {
    return (
        <section aria-labelledby="csi-identity-heading" className={cn(CSI_CARD, 'p-5 sm:p-7')}>
            <h2 id="csi-identity-heading" className="text-[15px] font-semibold text-foreground">Identitas Anda</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor="csi-respondent-name" className="text-[13px] font-medium text-muted-foreground">Nama</label>
                    <Input id="csi-respondent-name" value={form.respondent.fullName} readOnly
                        className="h-11 rounded-xl bg-muted/50 text-foreground cursor-default focus-visible:ring-0 focus-visible:ring-offset-0" />
                </div>
                <div className="space-y-1.5">
                    <label id="csi-department-label" htmlFor="csi-department" className="text-[13px] font-medium text-muted-foreground">Departemen</label>
                    <Select value={departmentId || undefined} onValueChange={onDepartmentChange}>
                        <SelectTrigger id="csi-department" aria-labelledby="csi-department-label" className="h-11 bg-card dark:bg-card">
                            <SelectValue placeholder="Pilih departemen" />
                        </SelectTrigger>
                        <SelectContent>
                            {form.departments.map((department) => (
                                <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </section>
    );
}

export function RateeCard({ ratee, scores, comment, onScore, onComment }: {
    ratee: Ratee; scores: CsiScores; comment: string;
    onScore: (dimensionId: string, score: number) => void; onComment: (text: string) => void;
}) {
    const commentId = `csi-comment-${ratee.periodRateeId}`;
    const commentLabel = `Saran untuk ${ratee.displayName} (opsional)`;
    return (
        <section aria-label={ratee.displayName} className={cn(CSI_CARD, 'p-5 sm:p-7')}>
            <header className="flex items-center gap-3.5">
                <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[hsl(var(--idesk-sapphire)/.1)] text-[15px] font-semibold text-[hsl(var(--idesk-sapphire))]">
                    {ratee.displayName.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-semibold tracking-tight text-foreground">{ratee.displayName}</h2>
                    {ratee.jobTitle && <p className="truncate text-[13px] text-muted-foreground">{ratee.jobTitle}</p>}
                </div>
            </header>
            <ul className="mt-5 divide-y divide-border/60">
                {ratee.dimensions.map((dimension) => (
                    <li key={dimension.periodRateeDimensionId} className="flex flex-col gap-1.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                        <span className="text-[14px] font-medium text-foreground">{dimension.name}</span>
                        <StarRating value={scores[dimension.periodRateeDimensionId] ?? 0}
                            label={`${dimension.name} untuk ${ratee.displayName}`}
                            onChange={(score) => onScore(dimension.periodRateeDimensionId, score)} />
                    </li>
                ))}
            </ul>
            <div className="mt-4 space-y-1.5">
                <label htmlFor={commentId} className="text-[13px] font-medium text-muted-foreground">{commentLabel}</label>
                <Textarea id={commentId} value={comment} maxLength={CSI_COMMENT_MAX} rows={3}
                    onChange={(event) => onComment(event.target.value)}
                    placeholder="Tulis saran atau apresiasi…" className="rounded-xl bg-card resize-y" />
            </div>
        </section>
    );
}

/** Sticky under the page top while scrolling; the fill eases with the --dur-3 token (zeroed by reduced motion). */
export function CsiProgress({ rated, total }: { rated: number; total: number }) {
    return (
        <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 pb-2">
            <div className={cn(CSI_CARD, 'flex items-center gap-4 px-4 py-3 backdrop-blur-xl bg-card/90')}>
                <Progress value={rated} max={total || 1} aria-label="Progres penilaian"
                    className="h-2 flex-1 [&>div]:rounded-full [&>div]:bg-[hsl(var(--idesk-sapphire))] [&>div]:transition-[width] [&>div]:duration-[var(--dur-3)] [&>div]:ease-[var(--ease-out)]" />
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-muted-foreground">{`${rated}/${total} penilaian`}</span>
            </div>
        </div>
    );
}

export function ConfirmSheet({ open, onOpenChange, form, scores, submitting, onSubmit }: {
    open: boolean; onOpenChange: (open: boolean) => void; form: CsiOpenForm; scores: CsiScores;
    submitting: boolean; onSubmit: () => void;
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="mx-auto max-w-xl sm:bottom-4 sm:rounded-2xl sm:border">
                <SheetHeader className="pr-12">
                    <SheetTitle className="text-lg">Tinjau penilaian</SheetTitle>
                    <SheetDescription>Rata-rata bintang per orang. Survei hanya bisa dikirim sekali.</SheetDescription>
                </SheetHeader>
                <ul className="mx-6 max-h-[45vh] overflow-y-auto rounded-2xl border border-border/70 divide-y divide-border/60">
                    {form.ratees.map((ratee) => (
                        <li key={ratee.periodRateeId} className="flex items-center justify-between gap-4 px-4 py-3">
                            <span className="min-w-0 truncate text-[14px] font-medium text-foreground">{ratee.displayName}</span>
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold tabular-nums text-foreground">
                                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                                <span>{formatAverage(rateeAverage(ratee, scores))}</span>
                            </span>
                        </li>
                    ))}
                </ul>
                <SheetFooter className="gap-2.5 sm:gap-2.5 sm:space-x-0">
                    <Button type="button" variant="soft" size="lg" onClick={() => onOpenChange(false)} disabled={submitting}>Kembali</Button>
                    <button type="button" className="idesk-cta ct-submit justify-center" onClick={onSubmit} disabled={submitting} aria-busy={submitting || undefined}>
                        {submitting && <span className="ct-spinner idesk-spin" aria-hidden="true" />}
                        Kirim
                    </button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
