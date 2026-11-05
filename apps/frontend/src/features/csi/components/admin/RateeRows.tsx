import { useMemo } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { RateeDraft } from '../../lib/csiAdmin';
import type { CsiDimension } from '../../types';
import { SortableList } from '../common/SortableList';
import { RATEE_COPY } from '../wizard/wizardCopy';
import { EmptyNote, MUTED_TEXT } from './AdminParts';
import { QuestionTypeChip } from './questions/QuestionTypeChip';
import { QuestionLine } from './ratees/QuestionPicker';
import { questionDisplayLabel } from './report/reportModel';

interface QuestionChecklistProps {
    idPrefix: string;
    questions: readonly CsiDimension[];
    value: readonly string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}

/** Active questions of every type, each with its type chip. */
export function QuestionChecklist({ idPrefix, questions, value, onChange, disabled }: QuestionChecklistProps) {
    const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((item) => item !== id));
    return (
        <ul className="m-0 grid list-none gap-2 p-0">
            {questions.map((question) => {
                const id = `${idPrefix}-${question.id}`;
                return (
                    <li key={question.id} className="flex items-center gap-2">
                        <Checkbox id={id} aria-label={questionDisplayLabel(question)} checked={value.includes(question.id)} disabled={disabled}
                            onCheckedChange={(state) => toggle(question.id, state === true)} />
                        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer"><QuestionLine question={question} /></label>
                        <QuestionTypeChip type={question.type} />
                    </li>
                );
            })}
        </ul>
    );
}

function RowQuestions({ row, questions, names, onChange, disabled }: {
    row: RateeDraft; questions: readonly CsiDimension[]; names: ReadonlyMap<string, string>;
    onChange: (ids: string[]) => void; disabled: boolean;
}) {
    const chips = (
        <span className="flex flex-wrap gap-1">
            {row.dimensionIds.map((id) => (
                <span key={id} className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-[12px] font-medium">{names.get(id) ?? RATEE_COPY.inactiveQuestion}</span>
            ))}
            {!row.dimensionIds.length && <span className="text-[12px] font-medium text-[hsl(var(--ticket-red-ink))]">{RATEE_COPY.noQuestions}</span>}
        </span>
    );
    if (disabled) return chips;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button type="button" aria-label={RATEE_COPY.editQuestions(row.displayName)}
                    className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1 text-left hover:bg-[hsl(var(--muted)/.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {chips}<ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="picker-panel w-[min(92vw,360px)] p-4" aria-label={RATEE_COPY.questionsOf(row.displayName)}>
                <QuestionChecklist idPrefix={`row-${row.userId}`} questions={questions} value={row.dimensionIds} onChange={onChange} />
            </PopoverContent>
        </Popover>
    );
}

interface RateeRowsProps {
    draft: readonly RateeDraft[];
    questions: readonly CsiDimension[];
    locked: boolean;
    onChangeRow: (userId: string, ids: string[]) => void;
    onRemove: (userId: string) => void;
    onReorder: (userIds: string[]) => void;
}

/** One draggable row per PERSON ratee; the dragged order is the order that gets saved and shown to respondents. */
export function RateeRows({ draft, questions, locked, onChangeRow, onRemove, onReorder }: RateeRowsProps) {
    const names = useMemo(() => new Map(questions.map((question) => [question.id, questionDisplayLabel(question)])), [questions]);
    if (!draft.length) return <EmptyNote>{RATEE_COPY.empty}</EmptyNote>;
    return (
        <section aria-label={RATEE_COPY.listLabel} className="rounded-2xl border border-[hsl(var(--idesk-border)/.7)] p-2">
            <SortableList items={draft} getId={(row) => row.userId} onReorder={onReorder} disabled={locked} label={RATEE_COPY.handleNoun} className="gap-1"
                renderItem={(row, handle) => (
                    <div className="flex items-start gap-2 rounded-xl px-1 py-2">
                        {handle}
                        <div className="w-44 shrink-0 pt-1.5">
                            <span className="block text-[13.5px] font-medium">{row.displayName}</span>
                            {row.jobTitle && <span className={cn(MUTED_TEXT, 'block text-[12px]')}>{row.jobTitle}</span>}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <RowQuestions row={row} questions={questions} names={names} disabled={locked}
                                onChange={(ids) => onChangeRow(row.userId, ids)} />
                        </div>
                        {!locked && (
                            <Button variant="subtle" size="icon" aria-label={`Hapus ${row.displayName}`} onClick={() => onRemove(row.userId)}>
                                <Trash2 aria-hidden="true" />
                            </Button>
                        )}
                    </div>
                )} />
        </section>
    );
}
