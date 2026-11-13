import { AlertCircle, Lock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { missingRequired, otherAnswerCount, rateeAverage, type CsiAnswers } from '../../lib/csiForm';
import { toneClasses } from '../../lib/csiTone';
import { formatAverage } from '../../lib/format';
import type { CsiOpenForm } from '../../types';
import { CSI_CARD } from '../CsiSurveyParts';
import { FlowFooter, ScreenHeading } from './FlowChrome';
import { RateeAvatar } from './RateeAvatar';
import { averageLabel, otherAnswersText, RESPOND_COPY, reviewIncompleteHint } from './respondCopy';

interface ReviewScreenProps {
    form: CsiOpenForm;
    name: string;
    departmentName: string | null;
    answers: CsiAnswers;
    preview: boolean;
    submitting: boolean;
    failure: string | null;
    /** Null when the whole identity is locked (name always is; the department once known). */
    onEditIdentity: (() => void) | null;
    onEditRatee: (index: number) => void;
    onBack: () => void;
    onSubmit: () => void;
}

const ROW = 'flex items-center gap-3.5 px-4 py-3 sm:px-5';
const EDIT_BUTTON = 'shrink-0 px-3';

function RateeRow({ ratee, label, answers, incomplete, onEdit }: {
    ratee: CsiOpenForm['ratees'][number]; label: string; answers: CsiAnswers; incomplete: boolean; onEdit: () => void;
}) {
    const value = rateeAverage(ratee, answers);
    const average = value === null ? RESPOND_COPY.noScore : formatAverage(value);
    const others = otherAnswerCount(ratee, answers);
    const amber = toneClasses('amber');
    return (
        <li aria-label={label} className={ROW}>
            <RateeAvatar name={label} avatarUrl={ratee.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1">
                <span className="block break-words text-[15px] font-medium text-foreground">{label}</span>
                {others > 0 && <span className="block text-[13px] text-muted-foreground">{otherAnswersText(others)}</span>}
            </span>
            {incomplete && (
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', amber.soft, amber.ink)}>
                    {RESPOND_COPY.incompleteBadge}
                </span>
            )}
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[15px] font-semibold tabular-nums text-foreground"
                title={value === null ? undefined : averageLabel(average)}>
                {value !== null && <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />}{average}
            </span>
            <Button type="button" variant="subtle" className={EDIT_BUTTON} onClick={onEdit}>{RESPOND_COPY.edit}</Button>
        </li>
    );
}

function IdentityRow({ label, value, onEdit }: { label: string; value: string; onEdit: (() => void) | null }) {
    return (
        <div className={ROW}>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground">{label}</p>
                <p className="break-words text-[15px] font-medium text-foreground">{value}</p>
            </div>
            {onEdit ? (
                <Button type="button" variant="subtle" className={EDIT_BUTTON} onClick={onEdit}
                    aria-label={`${RESPOND_COPY.edit} ${label.toLowerCase()}`}>{RESPOND_COPY.edit}</Button>
            ) : <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={`${label} terkunci`} />}
        </div>
    );
}

export function ReviewScreen(props: ReviewScreenProps) {
    const { form, name, departmentName, answers, preview, submitting, failure, onEditIdentity, onEditRatee, onBack, onSubmit } = props;
    const incompleteFlags = form.ratees.map((ratee) => missingRequired(ratee, answers).length > 0);
    const incompleteCount = incompleteFlags.filter(Boolean).length;
    const amber = toneClasses('amber');
    return (
        <div className="space-y-5">
            <header className="space-y-1.5">
                <ScreenHeading className="text-2xl font-bold tracking-tight">{RESPOND_COPY.reviewTitle}</ScreenHeading>
                <p className="text-[14px] text-muted-foreground">{RESPOND_COPY.reviewHint}</p>
            </header>

            {incompleteCount > 0 && (
                <p role="status" className={cn('flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium', amber.soft, amber.ink)}>
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{reviewIncompleteHint(incompleteCount)}
                </p>
            )}

            <div className={cn(CSI_CARD, 'divide-y divide-border/60 overflow-hidden')}>
                <IdentityRow label={RESPOND_COPY.name} value={name} onEdit={null} />
                <IdentityRow label={RESPOND_COPY.department} value={departmentName ?? RESPOND_COPY.noScore} onEdit={onEditIdentity} />
            </div>

            <ul className={cn(CSI_CARD, 'divide-y divide-border/60 overflow-hidden')}>
                {form.ratees.map((ratee, index) => (
                    <RateeRow key={ratee.periodRateeId} ratee={ratee} answers={answers} incomplete={incompleteFlags[index]}
                        onEdit={() => onEditRatee(index)} label={ratee.displayName} />
                ))}
            </ul>

            {failure && (
                <p role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-[13px] font-medium text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{failure}
                </p>
            )}

            <FlowFooter>
                <Button type="button" variant="soft" size="lg" onClick={onBack} disabled={submitting}>{RESPOND_COPY.back}</Button>
                <button type="button" className="idesk-cta ct-submit flex-1 justify-center sm:ml-auto sm:flex-none" onClick={onSubmit}
                    disabled={preview || submitting} aria-busy={submitting || undefined}>
                    {submitting && <span className="ct-spinner idesk-spin" aria-hidden="true" />}
                    {RESPOND_COPY.submit}
                </button>
            </FlowFooter>
        </div>
    );
}
