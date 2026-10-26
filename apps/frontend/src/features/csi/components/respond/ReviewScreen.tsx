import { AlertCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { rateeAverage, type CsiScores } from '../../lib/csiForm';
import { formatAverage } from '../../lib/format';
import type { CsiOpenForm } from '../../types';
import { CSI_CARD } from '../CsiSurveyParts';
import { FlowFooter, ScreenHeading } from './FlowChrome';
import { RateeAvatar } from './RateeAvatar';
import { averageLabel, RESPOND_COPY } from './respondCopy';

interface ReviewScreenProps {
    form: CsiOpenForm;
    departmentName: string | null;
    scores: CsiScores;
    preview: boolean;
    submitting: boolean;
    failure: string | null;
    onEditDepartment: () => void;
    onEditRatee: (index: number) => void;
    onBack: () => void;
    onSubmit: () => void;
}

const ROW = 'flex items-center gap-3.5 px-4 py-3 sm:px-5';
const EDIT_BUTTON = 'shrink-0 px-3';

/** One row per ratee: avatar, name, star average (1 decimal, id-ID) and "Ubah". */
function ReviewRatees({ ratees, scores, onEdit }: { ratees: CsiOpenForm['ratees']; scores: CsiScores; onEdit: (index: number) => void }) {
    return (
        <ul className={cn(CSI_CARD, 'divide-y divide-border/60 overflow-hidden')}>
            {ratees.map((ratee, index) => {
                const average = formatAverage(rateeAverage(ratee, scores));
                return (
                    <li key={ratee.periodRateeId} aria-label={ratee.displayName} className={ROW}>
                        <RateeAvatar name={ratee.displayName} avatarUrl={ratee.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">{ratee.displayName}</span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-[15px] font-semibold tabular-nums text-foreground"
                            title={averageLabel(average)}>
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />{average}
                        </span>
                        <Button type="button" variant="subtle" className={EDIT_BUTTON} onClick={() => onEdit(index)}>{RESPOND_COPY.edit}</Button>
                    </li>
                );
            })}
        </ul>
    );
}

export function ReviewScreen(props: ReviewScreenProps) {
    const { form, departmentName, scores, preview, submitting, failure, onEditDepartment, onEditRatee, onBack, onSubmit } = props;
    return (
        <div className="space-y-5">
            <header className="space-y-1.5">
                <ScreenHeading className="text-2xl font-bold tracking-tight">{RESPOND_COPY.reviewTitle}</ScreenHeading>
                <p className="text-[14px] text-muted-foreground">{RESPOND_COPY.reviewHint}</p>
            </header>

            <div className={cn(CSI_CARD, ROW)}>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-muted-foreground">{RESPOND_COPY.department}</p>
                    <p className="truncate text-[15px] font-medium text-foreground">{departmentName ?? '—'}</p>
                </div>
                <Button type="button" variant="subtle" className={EDIT_BUTTON} onClick={onEditDepartment}
                    aria-label={`${RESPOND_COPY.edit} ${RESPOND_COPY.department.toLowerCase()}`}>{RESPOND_COPY.edit}</Button>
            </div>

            <ReviewRatees ratees={form.ratees} scores={scores} onEdit={onEditRatee} />

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
