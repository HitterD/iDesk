import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TicketPill } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import { CSI_DESCRIPTION_MAX, CSI_QUESTION_MAX } from '../../../lib/csiAdmin';
import type { CsiDimension, CsiOption, CsiQuestionType, UpdateCsiDimension } from '../../../types';
import { SaveStatusText } from '../../common/SaveStatusText';
import { OptionsEditor } from './OptionsEditor';
import { QUESTION_COPY } from './questionCopy';
import { optionsForType } from './questionPresets';
import { TypePicker } from './TypePicker';
import { useInlineField, useSaveStatus } from './useInlineField';

export interface QuestionCardProps {
    question: CsiDimension;
    /** The drag handle node from SortableList. */
    handle: ReactNode;
    /** Rejects on failure; the card shows the error inline and keeps the edit. */
    onSave: (id: string, payload: UpdateCsiDimension) => Promise<unknown>;
    /** Focus and select the title once on mount (a question just created). */
    autoFocusTitle?: boolean;
}

const LABEL = 'text-[12.5px] font-medium text-[hsl(var(--idesk-text-secondary))]';
const FIELD_BARE = 'rounded-xl border-transparent bg-transparent px-3 hover:bg-[hsl(var(--muted)/.6)] focus-visible:bg-[hsl(var(--idesk-surface))]';
const hasOptions = (type: CsiQuestionType): type is 'SCALE' | 'CHOICE' => type === 'SCALE' || type === 'CHOICE';

export function QuestionCard({ question, handle, onSave, autoFocusTitle }: QuestionCardProps) {
    const status = useSaveStatus();
    const titleRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (!autoFocusTitle) return;
        titleRef.current?.focus();
        titleRef.current?.select();
    }, [autoFocusTitle]);

    const save = (payload: UpdateCsiDimension) => status.run(() => onSave(question.id, payload));
    const title = useInlineField({
        value: question.name, onCommit: (name) => save({ name }), onInvalid: status.fail,
        validate: (draft) => draft ? null : QUESTION_COPY.titleEmpty,
    });
    const description = useInlineField({
        value: question.description ?? '', multiline: true, onCommit: (text) => save({ description: text || null }),
    });
    const changeType = (type: CsiQuestionType) => save({ type, options: optionsForType(type, question.options) });
    const changeOptions = (options: CsiOption[]) => save({ options });

    return (
        <article aria-label={question.name} className={cn(
            'grid gap-4 rounded-2xl bg-[hsl(var(--idesk-surface))] p-5 text-[hsl(var(--idesk-text))] shadow-[var(--dash-shadow-1)] sm:p-6',
            !question.isActive && 'opacity-70',
        )}>
            <div className="flex items-start gap-2">
                {handle}
                <div className="grid min-w-0 flex-1 gap-1">
                    <label className="sr-only" htmlFor={`question-title-${question.id}`}>{QUESTION_COPY.titleLabel}</label>
                    <Input id={`question-title-${question.id}`} ref={titleRef} {...title.inputProps} maxLength={CSI_QUESTION_MAX}
                        placeholder={QUESTION_COPY.titlePlaceholder} aria-label={QUESTION_COPY.titleLabel}
                        className={cn('h-10 text-[15px] font-semibold', FIELD_BARE)} />
                    <Textarea {...description.inputProps} rows={1} maxLength={CSI_DESCRIPTION_MAX} aria-label={QUESTION_COPY.descriptionLabel}
                        placeholder={QUESTION_COPY.descriptionPlaceholder}
                        className={cn('min-h-9 resize-none text-[13px]', FIELD_BARE)} />
                </div>
                {!question.isActive && <TicketPill tone="neutral">{QUESTION_COPY.inactive}</TicketPill>}
            </div>
            <TypePicker value={question.type} onChange={changeType} />
            {hasOptions(question.type) && <OptionsEditor type={question.type} options={question.options} onChange={changeOptions} />}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="flex items-center gap-2.5">
                    <Switch checked={question.required} onCheckedChange={(required) => void save({ required })} aria-label={QUESTION_COPY.required} />
                    <span className={LABEL}>{QUESTION_COPY.required}</span>
                </label>
                <SaveStatusText status={status.status} error={status.error} />
                <span className="flex-1" />
                <Button type="button" variant={question.isActive ? 'danger' : 'soft'} onClick={() => void save({ isActive: !question.isActive })}>
                    {question.isActive ? QUESTION_COPY.deactivate : QUESTION_COPY.activate}
                </Button>
            </div>
        </article>
    );
}
