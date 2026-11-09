import { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CSI_COMMENT_MAX, isAnswered, type CsiAnswer, type CsiAnswers } from '../../lib/csiForm';
import type { CsiOpenForm } from '../../types';
import { CSI_CARD } from '../CsiSurveyParts';
import { FlowFooter } from './FlowChrome';
import { QuestionField } from './QuestionField';
import { commentLabel, missingText, RESPOND_COPY } from './respondCopy';
import { SubjectPhoto } from './SubjectPhoto';
import { SubjectRail } from './SubjectRail';

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
    /** Question ids flagged after "Lanjut" with a missing required answer; empty until then. */
    missing: ReadonlySet<string>;
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

function CommentField({ ratee, comment, onComment }: { ratee: Ratee; comment: string; onComment: (text: string) => void }) {
    const commentId = `csi-comment-${ratee.periodRateeId}`;
    return (
        <div className="space-y-2">
            <label htmlFor={commentId} className="text-[13px] font-medium text-muted-foreground">{commentLabel(ratee.displayName)}</label>
            <Textarea id={commentId} value={comment} maxLength={CSI_COMMENT_MAX} rows={3}
                onChange={(event) => onComment(event.target.value)}
                placeholder={RESPOND_COPY.commentPlaceholder} className="rounded-xl bg-card resize-y" />
        </div>
    );
}

/** One subject: sticky photo on the left (about 40% wide, so the form leads), questions on the right. The page is the only scroller. */
export function RateeScreen(props: RateeScreenProps) {
    const { ratees, index, saved, answers, comment, missing, isComplete, onAnswer, onComment, onSelect, onBack, onNext } = props;
    const card = useRef<HTMLElement>(null);
    const ratee = ratees[index];
    return (
        <div className={cn('space-y-4', STICKY_VARS)}>
            <SubjectRail ratees={ratees} current={index} saved={saved} onSelect={onSelect}
                answeredCount={(at) => ratees[at].dimensions.filter((dimension) => isAnswered(dimension, answers)).length}
                questionCount={(at) => ratees[at].dimensions.length} done={(at) => isComplete(ratees[at], at)} />

            <section ref={card} aria-labelledby={`csi-ratee-${ratee.periodRateeId}`} className={cn(CSI_CARD, 'scroll-mt-3 overflow-clip rounded-[22px] @container')}>
                {/* Two columns only where the photo can stick (lg viewport and a container of at least 780 px); stacked otherwise. */}
                <div className="grid grid-cols-1 items-start lg:@min-[780px]:grid-cols-[minmax(0,0.68fr)_minmax(0,1fr)]">
                    <SubjectPhoto ratee={ratee} index={index} total={ratees.length} scrollTarget={card} />
                    <div className="flex flex-col gap-3 p-4 [--flow-gutter:1rem] @min-[780px]:p-[clamp(16px,2.2cqi,30px)]">
                        {ratee.dimensions.map((dimension) => (
                            <QuestionField key={dimension.periodRateeDimensionId} dimension={dimension} rateeName={ratee.displayName}
                                answer={answers[dimension.periodRateeDimensionId]} missing={missing.has(dimension.periodRateeDimensionId)}
                                onChange={(answer) => onAnswer(dimension.periodRateeDimensionId, answer)} />
                        ))}
                        <CommentField ratee={ratee} comment={comment} onComment={onComment} />
                        <FlowFooter note={(
                            <p role="status" className="text-center text-[13px] font-medium text-[hsl(var(--ticket-amber-ink))] text-balance sm:text-right [&:not(:empty)]:mb-2.5">
                                {missing.size > 0 ? missingText(missing.size) : ''}
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
