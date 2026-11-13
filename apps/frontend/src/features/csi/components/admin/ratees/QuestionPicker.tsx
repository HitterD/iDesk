import { useState } from 'react';
import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCreateCsiQuestionSet, useCsiQuestionSets, useDeleteCsiQuestionSet } from '../../../hooks/useCsi';
import { sameIds } from '../../../lib/csiAdmin';
import type { CsiDimension, CsiScopeParam } from '../../../types';
import { MUTED_TEXT } from '../AdminParts';
import { QuestionTypeChip } from '../questions/QuestionTypeChip';
import { TemplateApplyButton } from '../questions/TemplateApplyButton';
import { questionDisplayLabel } from '../report/reportModel';
import { QUESTION_PICKER_COPY as COPY } from './rateeCopy';

const SET_NAME_MAX = 100;

/** Main text of a question in the picker: its report label (short label / bracketed aspect), the full text below. */
export function QuestionLine({ question }: { question: CsiDimension }) {
    const label = questionDisplayLabel(question);
    return (
        <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium leading-snug">{label}</span>
            {label !== question.name && <span className={cn(MUTED_TEXT, 'block text-[12px] leading-snug')}>{question.name}</span>}
        </span>
    );
}

function SaveSetForm({ scope, value, onDone }: { scope: CsiScopeParam; value: readonly string[]; onDone: () => void }) {
    const [name, setName] = useState('');
    const create = useCreateCsiQuestionSet(scope);
    const submit = () => create.mutate({ name: name.trim(), dimensionIds: [...value] }, {
        onSuccess: () => { toast.success(COPY.setSaved); onDone(); },
    });
    return (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); submit(); }}>
            <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={SET_NAME_MAX}
                placeholder={COPY.setNamePlaceholder} aria-label={COPY.setNameLabel} className="h-9 min-w-[200px] flex-1 rounded-xl" />
            <Button type="submit" size="sm" variant="primary" loading={create.isPending} disabled={!name.trim()}>{COPY.saveSet}</Button>
            <Button type="button" size="sm" variant="subtle" onClick={onDone}>{COPY.cancel}</Button>
        </form>
    );
}

interface QuestionPickerProps {
    scope: CsiScopeParam;
    questions: readonly CsiDimension[];
    value: readonly string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}

/**
 * Questions for the people being assigned: one click on a saved set (Pengaturan "Set pertanyaan"),
 * or tick questions one by one; the current ticks can be saved as a new set.
 */
export function QuestionPicker({ scope, questions, value, onChange, disabled }: QuestionPickerProps) {
    const { data: sets = [] } = useCsiQuestionSets(scope);
    const remove = useDeleteCsiQuestionSet(scope);
    const [saving, setSaving] = useState(false);
    const active = new Set(questions.map((question) => question.id));
    const usable = sets.map((set) => ({ ...set, dimensionIds: set.dimensionIds.filter((id) => active.has(id)) })).filter((set) => set.dimensionIds.length);
    const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((item) => item !== id));
    const allOn = questions.length > 0 && questions.every((question) => value.includes(question.id));

    return (
        <div className="grid gap-3">
            <div className="grid gap-1.5">
                <span className={cn(MUTED_TEXT, 'text-[12px]')}>{COPY.setsHint}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                    <TemplateApplyButton scope={scope} questions={questions} value={value} disabled={disabled} onApply={onChange} />
                    {usable.map((set) => {
                        const on = sameIds(set.dimensionIds, value);
                        return (
                            <span key={set.id} className={cn('inline-flex items-center rounded-full border text-[12.5px] font-semibold',
                                on ? 'border-transparent bg-[hsl(var(--idesk-sapphire))] text-white' : 'border-[hsl(var(--idesk-border))] bg-card')}>
                                <button type="button" disabled={disabled} aria-pressed={on} aria-label={COPY.applySet(set.name, set.dimensionIds.length)} onClick={() => onChange([...set.dimensionIds])}
                                    className="inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />{set.name}
                                    <span className="opacity-70">· {set.dimensionIds.length}</span>
                                </button>
                                {!disabled && (
                                    <button type="button" aria-label={COPY.deleteSet(set.name)} onClick={() => remove.mutate(set.id)}
                                        className="mr-1 grid h-5 w-5 place-items-center rounded-full opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                )}
                            </span>
                        );
                    })}
                    {!usable.length && <span className={cn(MUTED_TEXT, 'text-[12.5px]')}>{COPY.noSets}</span>}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <span className={cn(MUTED_TEXT, 'text-[12px]')}>{COPY.selected(value.length, questions.length)}</span>
                <Button variant="subtle" size="sm" className="ml-auto" disabled={disabled || !questions.length}
                    onClick={() => onChange(allOn ? [] : questions.map((question) => question.id))}>
                    {allOn ? COPY.clearAll : COPY.pickAll}
                </Button>
            </div>
            <ul className="m-0 grid max-h-[340px] list-none gap-1 overflow-y-auto rounded-xl border border-[hsl(var(--idesk-border)/.7)] bg-card p-1.5 scrollbar-custom">
                {questions.map((question, index) => {
                    const id = `pick-${question.id}`;
                    return (
                        <li key={question.id}>
                            <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[hsl(var(--muted)/.55)]',
                                value.includes(question.id) && 'bg-[hsl(var(--idesk-sapphire)/.06)]')}>
                                <Checkbox id={id} className="mt-0.5" aria-label={questionDisplayLabel(question)} checked={value.includes(question.id)} disabled={disabled}
                                    onCheckedChange={(state) => toggle(question.id, state === true)} />
                                <span className={cn(MUTED_TEXT, 'w-5 shrink-0 pt-px text-right text-[12px] tabular-nums')}>{index + 1}.</span>
                                <QuestionLine question={question} />
                                <QuestionTypeChip type={question.type} />
                            </label>
                        </li>
                    );
                })}
            </ul>

            {!disabled && (saving
                ? <SaveSetForm scope={scope} value={value} onDone={() => setSaving(false)} />
                : (
                    <Button variant="subtle" size="sm" className="w-fit" disabled={!value.length} onClick={() => setSaving(true)}>
                        <BookmarkPlus aria-hidden="true" />{COPY.saveAsSet}
                    </Button>
                ))}
        </div>
    );
}
