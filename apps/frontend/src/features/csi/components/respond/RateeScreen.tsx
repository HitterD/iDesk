import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CSI_COMMENT_MAX, type CsiScores } from '../../lib/csiForm';
import type { CsiOpenForm } from '../../types';
import { CSI_CARD } from '../CsiSurveyParts';
import { StarRating } from '../StarRating';
import { FlowFooter, ScreenHeading } from './FlowChrome';
import { RateeAvatar } from './RateeAvatar';
import { RateeChips } from './RateeChips';
import { commentLabel, missingText, positionText, ratingLabel, RESPOND_COPY } from './respondCopy';

type Ratee = CsiOpenForm['ratees'][number];

interface RateeScreenProps {
    ratees: Ratee[];
    index: number;
    scores: CsiScores;
    comment: string;
    /** Dimension ids flagged after "Lanjut" with missing stars; empty until then. */
    missing: ReadonlySet<string>;
    isComplete: (ratee: Ratee) => boolean;
    onScore: (dimensionId: string, score: number) => void;
    onComment: (text: string) => void;
    onSelect: (index: number) => void;
    onBack: () => void;
    onNext: () => void;
}

function DimensionRow({ dimension, ratee, score, missing, onScore }: {
    dimension: Ratee['dimensions'][number]; ratee: Ratee; score: number; missing: boolean; onScore: (score: number) => void;
}) {
    return (
        <li data-missing={missing || undefined}
            className={cn('scroll-mt-24 rounded-xl px-3 py-3.5 transition-shadow duration-150 sm:flex sm:items-center sm:justify-between sm:gap-6',
                missing && 'ring-2 ring-[hsl(var(--ticket-red))] ring-offset-0')}>
            <div className="min-w-0 space-y-0.5">
                <p className={cn('text-[15px] font-medium', missing ? 'text-[hsl(var(--ticket-red-ink))]' : 'text-foreground')}>
                    {dimension.name}
                    {missing && <span className="sr-only">{`, ${RESPOND_COPY.missingStar}`}</span>}
                </p>
                {dimension.description && <p className="text-[13px] leading-snug text-muted-foreground">{dimension.description}</p>}
            </div>
            <div className="mt-1.5 shrink-0 sm:mt-0">
                <StarRating size="lg" value={score} label={ratingLabel(dimension.name, ratee.displayName)} onChange={onScore} />
            </div>
        </li>
    );
}

export function RateeScreen(props: RateeScreenProps) {
    const { ratees, index, scores, comment, missing, isComplete, onScore, onComment, onSelect, onBack, onNext } = props;
    const ratee = ratees[index];
    const isLast = index === ratees.length - 1;
    const commentId = `csi-comment-${ratee.periodRateeId}`;
    return (
        <div className="space-y-5">
            <div className="space-y-2.5">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--idesk-sapphire))]">{positionText(index + 1, ratees.length)}</p>
                <RateeChips ratees={ratees} current={index} isComplete={isComplete} onSelect={onSelect} />
            </div>

            <section aria-labelledby={`csi-ratee-${ratee.periodRateeId}`} className={cn(CSI_CARD, 'p-4 sm:p-7')}>
                <header className="flex items-center gap-4 px-1">
                    <RateeAvatar name={ratee.displayName} avatarUrl={ratee.avatarUrl} />
                    <div className="min-w-0">
                        <ScreenHeading id={`csi-ratee-${ratee.periodRateeId}`} className="truncate text-xl font-semibold tracking-tight">{ratee.displayName}</ScreenHeading>
                        {ratee.jobTitle && <p className="truncate text-[14px] text-muted-foreground">{ratee.jobTitle}</p>}
                    </div>
                </header>
                <ul className="mt-4 space-y-1">
                    {ratee.dimensions.map((dimension) => (
                        <DimensionRow key={dimension.periodRateeDimensionId} dimension={dimension} ratee={ratee}
                            score={scores[dimension.periodRateeDimensionId] ?? 0} missing={missing.has(dimension.periodRateeDimensionId)}
                            onScore={(score) => onScore(dimension.periodRateeDimensionId, score)} />
                    ))}
                </ul>
                <div className="mt-4 space-y-1.5 px-1">
                    <label htmlFor={commentId} className="text-[13px] font-medium text-muted-foreground">{commentLabel(ratee.displayName)}</label>
                    <Textarea id={commentId} value={comment} maxLength={CSI_COMMENT_MAX} rows={3}
                        onChange={(event) => onComment(event.target.value)}
                        placeholder={RESPOND_COPY.commentPlaceholder} className="rounded-xl bg-card resize-y" />
                </div>
            </section>

            <FlowFooter note={(
                <p role="status" className="text-center text-[13px] font-medium text-[hsl(var(--ticket-red-ink))] sm:text-right [&:not(:empty)]:mb-2.5">
                    {missing.size > 0 ? missingText(missing.size) : ''}
                </p>
            )}>
                <Button type="button" variant="soft" size="lg" onClick={onBack}>{RESPOND_COPY.back}</Button>
                <button type="button" className="idesk-cta ct-submit flex-1 justify-center sm:ml-auto sm:flex-none" onClick={onNext}>
                    {isLast ? RESPOND_COPY.toReview : RESPOND_COPY.next}
                </button>
            </FlowFooter>
        </div>
    );
}
