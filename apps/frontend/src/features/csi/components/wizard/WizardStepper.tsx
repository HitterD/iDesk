import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS, type WizardStepKey } from '../../lib/wizard';
import { WIZARD_COPY } from './wizardCopy';

const LABELS = new Map(WIZARD_STEPS.map((step) => [step.key, step.label]));

interface WizardStepperProps {
    steps: readonly WizardStepKey[];
    current: WizardStepKey;
    isComplete: (key: WizardStepKey) => boolean;
    /** False before the period exists or while unsaved changes block navigation. */
    canNavigate: boolean;
    onSelect: (key: WizardStepKey) => void;
}

/** Ordered, clickable step list; the current step carries `aria-current="step"`. */
export function WizardStepper({ steps, current, isComplete, canNavigate, onSelect }: WizardStepperProps) {
    return (
        <nav aria-label={WIZARD_COPY.stepperLabel} className="overflow-x-auto">
            <ol className="flex min-w-max gap-1.5 lg:min-w-0 lg:flex-col">
                {steps.map((key, index) => {
                    const active = key === current;
                    const done = !active && isComplete(key);
                    return (
                        <li key={key}>
                            <button type="button" aria-current={active ? 'step' : undefined} disabled={!active && !canNavigate}
                                onClick={() => { if (!active) onSelect(key); }}
                                className={cn(
                                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium transition-colors duration-200 motion-reduce:transition-none',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                                    active ? 'bg-[hsl(var(--idesk-sapphire)/.1)] text-[hsl(var(--idesk-sapphire))]' : 'hover:bg-[hsl(var(--muted)/.6)]',
                                )}>
                                <span aria-hidden="true" className={cn(
                                    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums',
                                    active && 'bg-[hsl(var(--idesk-sapphire))] text-white',
                                    done && 'bg-[hsl(var(--ticket-green)/.15)] text-[hsl(var(--ticket-green-ink))]',
                                    !active && !done && 'bg-[hsl(var(--muted))] text-[hsl(var(--idesk-text-secondary))]',
                                )}>
                                    {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                                </span>
                                <span className="whitespace-nowrap">{LABELS.get(key)}</span>
                                {done && <span className="sr-only">{`, ${WIZARD_COPY.stepDone}`}</span>}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
