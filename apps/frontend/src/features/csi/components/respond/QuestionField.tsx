import { useId } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CSI_ANSWER_TEXT_MAX, type CsiAnswer } from '../../lib/csiForm';
import type { CsiFormDimension } from '../../types';
import { StarRating } from '../StarRating';
import { ChoiceList } from './ChoiceList';
import { counterText, ratingLabel, RESPOND_COPY } from './respondCopy';

/** The counter only appears when the respondent is close to the limit. */
const COUNTER_THRESHOLD = 900;
const TEXT_ROWS = 3;

interface QuestionFieldProps {
    dimension: CsiFormDimension;
    rateeName: string;
    answer: CsiAnswer | undefined;
    /** Flagged after "Lanjut" with this required question unanswered. */
    missing: boolean;
    onChange: (answer: CsiAnswer) => void;
}

function TextAnswer({ labelledBy, value, onChange }: { labelledBy: string; value: string; onChange: (text: string) => void }) {
    return (
        <div className="space-y-1.5">
            <Textarea aria-labelledby={labelledBy} value={value} rows={TEXT_ROWS} maxLength={CSI_ANSWER_TEXT_MAX}
                onChange={(event) => onChange(event.target.value)} className="rounded-xl bg-card text-[15px] resize-y" />
            {value.length >= COUNTER_THRESHOLD && (
                <p className="text-right text-[12px] tabular-nums text-muted-foreground">{counterText(value.length, CSI_ANSWER_TEXT_MAX)}</p>
            )}
        </div>
    );
}

function Control({ dimension, rateeName, answer, labelledBy, onChange }: Omit<QuestionFieldProps, 'missing'> & { labelledBy: string }) {
    const label = ratingLabel(dimension.name, rateeName);
    if (dimension.type === 'STAR') return <StarRating size="lg" value={answer?.score ?? 0} label={label} onChange={(score) => onChange({ score })} />;
    if (dimension.type === 'TEXT') return <TextAnswer labelledBy={labelledBy} value={answer?.text ?? ''} onChange={(text) => onChange({ text })} />;
    return <ChoiceList label={label} options={dimension.options} value={answer?.optionIndex} onChange={(optionIndex) => onChange({ optionIndex })} />;
}

/** One question rendered by type: title, optional description, then the control below with generous spacing. */
export function QuestionField(props: QuestionFieldProps) {
    const { dimension, missing } = props;
    const titleId = useId();
    return (
        <div data-missing={missing || undefined}
            className={cn('scroll-mt-24 space-y-4 rounded-xl p-3 transition-shadow duration-150 sm:p-4', missing && 'ring-2 ring-[hsl(var(--ticket-red))]')}>
            <div className="space-y-1">
                <p id={titleId} className={cn('text-[17px] font-semibold leading-snug', missing ? 'text-[hsl(var(--ticket-red-ink))]' : 'text-foreground')}>
                    {dimension.name}
                    {dimension.required && (
                        <>
                            <span aria-hidden="true" className="ml-1 text-[hsl(var(--ticket-red-ink))]">*</span>
                            <span className="sr-only">{RESPOND_COPY.required}</span>
                        </>
                    )}
                    {missing && <span className="sr-only">{RESPOND_COPY.missingAnswer}</span>}
                </p>
                {dimension.description && <p className="text-[14px] leading-snug text-muted-foreground">{dimension.description}</p>}
            </div>
            <Control {...props} labelledBy={titleId} />
        </div>
    );
}
