import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CSI_COMMENT_MAX, type CsiAnswer, type CsiAnswers } from '../../lib/csiForm';
import type { CsiOpenForm } from '../../types';
import { CSI_CARD } from '../CsiSurveyParts';
import { FlowFooter, ScreenHeading } from './FlowChrome';
import { QuestionField } from './QuestionField';
import { RateeAvatar } from './RateeAvatar';
import { RateeChips } from './RateeChips';
import { commentLabel, missingText, positionText, RESPOND_COPY } from './respondCopy';

type Ratee = CsiOpenForm['ratees'][number];

interface RateeScreenProps {
    ratees: Ratee[];
    index: number;
    teamLabel: string;
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

function RateeHeader({ ratee, teamLabel }: { ratee: Ratee; teamLabel: string }) {
    const team = ratee.kind === 'TEAM';
    return (
        <header className="flex items-center gap-4">
            {team ? (
                <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[hsl(var(--idesk-sapphire)/.12)] text-[hsl(var(--idesk-sapphire))]">
                    <Users className="h-6 w-6" />
                </span>
            ) : <RateeAvatar name={ratee.displayName} avatarUrl={ratee.avatarUrl} />}
            <div className="min-w-0">
                <ScreenHeading id={`csi-ratee-${ratee.periodRateeId}`} className="break-words text-xl font-semibold tracking-tight">
                    {team ? teamLabel : ratee.displayName}
                </ScreenHeading>
                {team && <p className="text-[14px] text-muted-foreground">{RESPOND_COPY.teamSub}</p>}
                {!team && ratee.jobTitle && <p className="break-words text-[14px] text-muted-foreground">{ratee.jobTitle}</p>}
            </div>
        </header>
    );
}

export function RateeScreen(props: RateeScreenProps) {
    const { ratees, index, teamLabel, answers, comment, missing, isComplete, onAnswer, onComment, onSelect, onBack, onNext } = props;
    const ratee = ratees[index];
    const isLast = index === ratees.length - 1;
    const commentId = `csi-comment-${ratee.periodRateeId}`;
    const name = ratee.kind === 'TEAM' ? teamLabel : ratee.displayName;
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--idesk-sapphire))]">{positionText(index + 1, ratees.length)}</p>
                <RateeChips ratees={ratees} current={index} teamLabel={teamLabel} isComplete={isComplete} onSelect={onSelect} />
            </div>

            <section aria-labelledby={`csi-ratee-${ratee.periodRateeId}`} className={cn(CSI_CARD, 'p-6 sm:p-10')}>
                <RateeHeader ratee={ratee} teamLabel={teamLabel} />
                <div className="mt-8 space-y-8">
                    {ratee.dimensions.map((dimension) => (
                        <QuestionField key={dimension.periodRateeDimensionId} dimension={dimension} rateeName={name}
                            answer={answers[dimension.periodRateeDimensionId]} missing={missing.has(dimension.periodRateeDimensionId)}
                            onChange={(answer) => onAnswer(dimension.periodRateeDimensionId, answer)} />
                    ))}
                    <div className="space-y-2 px-3 sm:px-4">
                        <label htmlFor={commentId} className="text-[14px] font-medium text-muted-foreground">{commentLabel(name)}</label>
                        <Textarea id={commentId} value={comment} maxLength={CSI_COMMENT_MAX} rows={3}
                            onChange={(event) => onComment(event.target.value)}
                            placeholder={RESPOND_COPY.commentPlaceholder} className="rounded-xl bg-card resize-y" />
                    </div>
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
