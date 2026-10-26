import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CSI_OPTIONS_MAX, CSI_OPTIONS_MIN, CSI_OPTION_LABEL_MAX, CSI_SCORE_MAX, CSI_SCORE_MIN } from '../../../lib/csiAdmin';
import type { CsiOption } from '../../../types';
import { SortableList } from '../../common/SortableList';
import { OPTION_PRESETS, PRESETS_BY_TYPE, PRESET_LABELS, type OptionPresetKey } from './questionPresets';
import { OPTIONS_COPY } from './questionCopy';

type OptionType = 'SCALE' | 'CHOICE';
/** `origin` = the last saved label, kept per row so Escape restores by identity, not by index. */
interface Row { key: string; label: string; points: number | null; origin: string }
export interface OptionsEditorProps {
    type: OptionType;
    options: readonly CsiOption[];
    /** Receives the whole array; only called with a valid set (2-10 labelled options). */
    onChange: (options: CsiOption[]) => unknown;
    disabled?: boolean;
}

const POINT_CHOICES = Array.from({ length: CSI_SCORE_MAX - CSI_SCORE_MIN + 1 }, (_, index) => CSI_SCORE_MAX - index);
const FIELD = 'h-9 rounded-xl border border-[hsl(var(--idesk-border))] bg-[hsl(var(--idesk-surface))] px-2.5 text-[13.5px] text-[hsl(var(--idesk-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const toOptions = (rows: readonly Row[]): CsiOption[] => rows.map(({ label, points }) => ({ label: label.trim(), points }));
const labelKey = (label: string) => label.trim().toLowerCase();
type LabelProblem = 'empty' | 'duplicate' | null;
function labelProblem(rows: readonly Row[]): LabelProblem {
    if (rows.some((row) => !row.label.trim())) return 'empty';
    return new Set(rows.map((row) => labelKey(row.label))).size < rows.length ? 'duplicate' : null;
}
const sameOptions = (a: readonly CsiOption[], b: readonly CsiOption[]) =>
    a.length === b.length && a.every((option, index) => option.label === b[index].label && option.points === b[index].points);

// Stable React keys for rows (labels repeat and change while typing, indexes shift when reordering).
let keyCounter = 0;
const nextKey = () => `option-${keyCounter++}`;

function useRows(options: readonly CsiOption[]) {
    const [rows, setRows] = useState<Row[]>(() => options.map((option) => ({ ...option, key: nextKey(), origin: option.label })));
    const [seen, setSeen] = useState(options);
    // A new server value (after a save, preset or type switch) replaces the rows; keys survive per index so focus stays.
    if (!sameOptions(seen, options)) {
        setSeen(options);
        const synced = sameOptions(toOptions(rows), options);
        setRows(synced
            ? rows.map((row, index) => ({ ...row, origin: options[index].label }))
            : options.map((option, index) => ({ ...option, key: rows[index]?.key ?? nextKey(), origin: option.label })));
    }
    return { rows, setRows };
}

export function OptionsEditor({ type, options, onChange, disabled }: OptionsEditorProps) {
    const { rows, setRows } = useRows(options);
    const [labelError, setLabelError] = useState<LabelProblem>(null);
    const tooFew = rows.length < CSI_OPTIONS_MIN;
    const normalize = (list: readonly Row[]) => list.map((row) => ({ ...row, points: type === 'CHOICE' ? null : row.points ?? CSI_SCORE_MAX }));

    const save = (next: readonly Row[]) => {
        setRows([...next]);
        const problem = next.length >= CSI_OPTIONS_MIN ? labelProblem(next) : null;
        setLabelError(problem);
        const valid = next.length >= CSI_OPTIONS_MIN && next.length <= CSI_OPTIONS_MAX && !problem;
        if (valid && !sameOptions(toOptions(next), options)) void onChange(toOptions(next));
    };
    const patch = (key: string, change: Partial<Row>) => setRows((current) => current.map((row) => row.key === key ? { ...row, ...change } : row));
    const applyPreset = (preset: OptionPresetKey) => save(OPTION_PRESETS[preset].map((option) => ({ ...option, key: nextKey(), origin: '' })));
    const add = () => setRows((current) => [...current, ...normalize([{
        key: nextKey(), label: '', origin: '', points: Math.max(CSI_SCORE_MAX - current.length, CSI_SCORE_MIN),
    }])]);
    const reorder = (keys: string[]) => save(keys.flatMap((key) => rows.filter((row) => row.key === key)));

    return (
        <div role="group" aria-label={OPTIONS_COPY.group} className="grid gap-3 rounded-2xl bg-[hsl(var(--muted)/.5)] p-4">
            <SortableList items={rows} getId={(row) => row.key} onReorder={reorder} disabled={disabled} label={OPTIONS_COPY.handleNoun}
                className="gap-2"
                renderItem={(row, handle) => (
                    <div className="flex items-center gap-2">
                        {handle}
                        <Input aria-label={OPTIONS_COPY.optionLabel(rows.indexOf(row) + 1)} value={row.label} maxLength={CSI_OPTION_LABEL_MAX}
                            disabled={disabled} className="h-9 min-w-0 flex-1"
                            onChange={(event) => patch(row.key, { label: event.target.value })}
                            onBlur={() => save(rows)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') patch(row.key, { label: row.origin });
                                if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
                            }} />
                        {type === 'SCALE' && (
                            <select aria-label={OPTIONS_COPY.optionPoints(rows.indexOf(row) + 1)} value={row.points ?? CSI_SCORE_MAX}
                                disabled={disabled} className={FIELD}
                                onChange={(event) => save(rows.map((item) => item.key === row.key ? { ...item, points: Number(event.target.value) } : item))}>
                                {POINT_CHOICES.map((points) => <option key={points} value={points}>{points}</option>)}
                            </select>
                        )}
                        <Button type="button" variant="subtle" size="icon" disabled={disabled} aria-label={OPTIONS_COPY.remove(row.label)}
                            onClick={() => save(rows.filter((item) => item.key !== row.key))}>
                            <X aria-hidden="true" />
                        </Button>
                    </div>
                )} />
            {(tooFew || labelError) && (
                <p role="alert" className="text-[12.5px] font-medium text-[hsl(var(--ticket-red-ink,var(--destructive)))]">
                    {tooFew ? OPTIONS_COPY.min : labelError === 'duplicate' ? OPTIONS_COPY.labelDuplicate : OPTIONS_COPY.labelEmpty}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="soft" disabled={disabled || rows.length >= CSI_OPTIONS_MAX} onClick={add}>
                    <Plus aria-hidden="true" />{OPTIONS_COPY.add}
                </Button>
                <span className="ml-auto text-[12px] text-[hsl(var(--idesk-text-secondary))]">{OPTIONS_COPY.presets}</span>
                {PRESETS_BY_TYPE[type].map((preset) => (
                    <Button key={preset} type="button" variant="subtle" disabled={disabled} onClick={() => applyPreset(preset)}>
                        {PRESET_LABELS[preset]}
                    </Button>
                ))}
            </div>
        </div>
    );
}
