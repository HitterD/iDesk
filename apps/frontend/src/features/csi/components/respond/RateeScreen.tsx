import { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CSI_COMMENT_MAX, isAnswered, isCommentFilled, type CsiAnswer, type CsiAnswers } from '../../lib/csiForm';
import { toneClasses } from '../../lib/csiTone';
import type { CsiOpenForm } from '../../types';
import { CSI_CARD } from '../CsiSurveyParts';
import { FlowFooter } from './FlowChrome';
import { QuestionField } from './QuestionField';
import { commentLabel, missingSummary, RESPOND_COPY } from './respondCopy';
import { SubjectPhoto } from './SubjectPhoto';
import { buildSubjectStates, SubjectRail } from './SubjectRail';

type Ratee = CsiOpenForm['ratees'][number];

/**
 * Sticky photo offsets. The topbar (h-14 = 56px in BentoTopbar and ClientTopbar) sits outside the page scroller,
 * so the photo sticks a small gap below the scroller's top and its height leaves room for the topbar.
 */
const STICKY_VARS = '[--csi-chrome:56px] [--csi-stick:12px]';

interface RateeScreenProps {
    ratees: Ratee[];
    index: number;
    /** Drafts are stored (live page): show "Tersimpan otomatis". */
    saved: boolean;
    answers: CsiAnswers;
    comment: string;
    /** Question ids flagged after "Kirim" with a missing required answer; empty until then. */
    missing: ReadonlySet<string>;
    /** True when flagged and the required comment is empty. */
    commentMissing?: boolean;
    isComplete: (ratee: Ratee, index: number) => boolean;
    onAnswer: (dimensionId: string, answer: CsiAnswer) => void;
    onComment: (text: string) => void;
    onSelect: (index: number) => void;
    onBack: () => void;
    onNext: () => void;
}

/** "Lanjut · <next name>"; the name hides when the screen container is narrower than 780 px. */
function NextButton({ next, onNext, step }: { next: Ratee | undefined; onNext: () => void; step: string }) {
    return (
        <button type="button" className="idesk-cta ct-submit min-w-0 max-w-full flex-1 justify-center sm:ml-auto sm:flex-none" onClick={onNext}
            aria-label={next ? `${RESPOND_COPY.next} · ${next.displayName}` : RESPOND_COPY.toReview}>
            {next ? (
                <>
                    {RESPOND_COPY.next}{' '}
                    <span className="max-w-[180px] truncate font-semibold opacity-75 @max-[780px]:hidden">· {next.displayName}</span>
                    <span className="hidden font-semibold opacity-75 tabular-nums @max-[780px]:inline">{step}</span>
                </>
            ) : RESPOND_COPY.toReview}
            <ArrowRight aria-hidden="true" />
        </button>
    );
}

function CommentField({ ratee, comment, missing, onComment }: { ratee: Ratee; comment: string; missing: boolean; onComment: (text: string) => void }) {
    const commentId = `csi-comment-${ratee.periodRateeId}`;
    const filled = isCommentFilled(comment);
    return (
        <div data-missing={missing || undefined}
            className={cn('scroll-mt-24 space-y-2 rounded-[14px] p-3.5 ring-1 ring-border/60 transition-[background-color,box-shadow] duration-300',
                filled ? toneClasses('green').soft : 'bg-muted/40', missing && 'ring-2 ring-[hsl(var(--ticket-red))]')}>
            <label htmlFor={commentId} className={cn('block text-[14px] font-semibold leading-snug', missing ? 'text-[hsl(var(--ticket-red-ink))]' : 'text-foreground')}>
                {commentLabel(ratee.displayName)}
                <span aria-hidden="true" className="ml-1 text-[hsl(var(--ticket-red-ink))]">*</span>
                <span className="sr-only">{RESPOND_COPY.required}</span>
                {missing && <span className="sr-only">{RESPOND_COPY.missingComment}</span>}
            </label>
            <Textarea id={commentId} value={comment} maxLength={CSI_COMMENT_MAX} rows={3} required
                aria-invalid={missing || undefined}
                onChange={(event) => onComment(event.target.value)}
                placeholder={RESPOND_COPY.commentPlaceholder} className="rounded-xl bg-card resize-y" />
        </div>
    );
}

/** One subject: sticky photo on the left (about 40% wide, so the form leads), questions on the right. The page is the only scroller. */
export function RateeScreen(props: RateeScreenProps) {
    const { ratees, index, saved, answers, comment, missing, commentMissing = false, isComplete, onAnswer, onComment, onSelect, onBack, onNext } = props;
    const card = useRef<HTMLElement>(null);
    const ratee = ratees[index];
    const answeredCount = (at: number) => ratees[at].dimensions.filter((dimension) => isAnswered(dimension, answers)).length;
    const questionCount = (at: number) => ratees[at].dimensions.length;
    const done = (at: number) => isComplete(ratees[at], at);
    const subjects = buildSubjectStates(ratees, answeredCount, questionCount, done);
    const footerNote = missingSummary(missing.size, commentMissing);
    return (
        <div className={cn('space-y-4', STICKY_VARS)}>
            <SubjectRail ratees={ratees} current={index} saved={saved} onSelect={onSelect}
                answeredCount={answeredCount} questionCount={questionCount} done={done} />

            <section ref={card} aria-labelledby={`csi-ratee-${ratee.periodRateeId}`} className={cn(CSI_CARD, 'scroll-mt-3 overflow-clip rounded-[22px] @container')}>
                {/* Two columns only where the photo can stick (lg viewport and a container of at least 780 px); stacked otherwise. */}
                <div className="grid grid-cols-1 items-start lg:@min-[780px]:grid-cols-[minmax(0,0.68fr)_minmax(0,1fr)]">
                    <SubjectPhoto ratee={ratee} index={index} total={ratees.length} scrollTarget={card} jump={{ subjects, onSelect }} />
                    <div className="flex flex-col gap-3 p-4 [--flow-gutter:1rem] @min-[780px]:p-[clamp(16px,2.2cqi,30px)]">
                        {ratee.dimensions.map((dimension) => (
                            <QuestionField key={dimension.periodRateeDimensionId} dimension={dimension} rateeName={ratee.displayName}
                                answer={answers[dimension.periodRateeDimensionId]} missing={missing.has(dimension.periodRateeDimensionId)}
                                onChange={(answer) => onAnswer(dimension.periodRateeDimensionId, answer)} />
                        ))}
                        <CommentField ratee={ratee} comment={comment} missing={commentMissing} onComment={onComment} />
                        <FlowFooter note={(
                            <p role="status" className="text-center text-[13px] font-medium text-[hsl(var(--ticket-amber-ink))] text-balance sm:text-right [&:not(:empty)]:mb-2.5">
                                {footerNote}
                            </p>
                        )}>
                            <Button type="button" variant="soft" size="lg" onClick={onBack}>{RESPOND_COPY.back}</Button>
                            <NextButton next={ratees[index + 1]} onNext={onNext} step={`(${index + 2}/${ratees.length})`} />
                        </FlowFooter>
                    </div>
                </div>
            </section>
        </div>
    );
}
