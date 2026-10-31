import { useId } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CSI_ANSWER_TEXT_MAX, type CsiAnswer } from '../../lib/csiForm';
import { starTone, toneClasses } from '../../lib/csiTone';
import type { CsiFormDimension } from '../../types';
import { ChoiceList } from './ChoiceList';
import { StarReaction } from './StarReaction';
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
    if (dimension.type === 'STAR') return <StarReaction value={answer?.score} label={label} onChange={(score) => onChange({ score })} />;
    if (dimension.type === 'TEXT') return <TextAnswer labelledBy={labelledBy} value={answer?.text ?? ''} onChange={(text) => onChange({ text })} />;
    return <ChoiceList label={label} options={dimension.options} value={answer?.optionIndex} variant={dimension.type === 'SCALE' ? 'pills' : 'cards'}
        onChange={(optionIndex) => onChange({ optionIndex })} />;
}

/** Points behind an answer (STAR score or SCALE option points); drives the card colour. CHOICE/TEXT carry none. */
function answerPoints(dimension: CsiFormDimension, answer: CsiAnswer | undefined): number | undefined {
    if (dimension.type === 'STAR') return answer?.score;
    if (dimension.type !== 'SCALE' || answer?.optionIndex === undefined) return undefined;
    return dimension.options[answer.optionIndex]?.points ?? undefined;
}

/** One question rendered by type: title, optional description, then the control below with generous spacing. */
export function QuestionField(props: QuestionFieldProps) {
    const { dimension, answer, missing } = props;
    const titleId = useId();
    const points = answerPoints(dimension, answer);
    return (
        <div data-missing={missing || undefined} data-v={points}
            className={cn('scroll-mt-24 space-y-3 rounded-[14px] p-3.5 ring-1 ring-border/60 transition-[background-color,box-shadow] duration-300',
                points ? toneClasses(starTone(points)).soft : 'bg-muted/40', missing && 'ring-2 ring-[hsl(var(--ticket-red))]')}>
            <div className="space-y-1">
                <p id={titleId} className={cn('text-[15px] font-semibold leading-snug', missing ? 'text-[hsl(var(--ticket-red-ink))]' : 'text-foreground')}>
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
