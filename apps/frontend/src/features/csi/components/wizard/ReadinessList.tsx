import { AlertTriangle, Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { READINESS_STEP, type WizardStepKey } from '../../lib/wizard';
import type { CsiReadiness } from '../../types';
import { WIZARD_COPY } from './wizardCopy';

/** Checks fixed on the period itself (team, ratee and rater assignment), which the backend freezes once answers exist. */
const PERIOD_BOUND = new Set<CsiReadiness['checks'][number]['key']>(['team', 'ratees', 'dimensions', 'raters']);

/**
 * A published survey can lose readiness later (ratees cleared, last department deactivated);
 * respondents then cannot fill it, so the admin is told rather than left with a "Terbit" pill alone.
 */
function PublishedIncompleteNote() {
    return (
        <p role="status" className="mb-3 flex items-start gap-2 rounded-2xl bg-[hsl(var(--ticket-amber)/.12)] px-4 py-3 text-[13px] font-medium text-[hsl(var(--ticket-amber-ink))]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{WIZARD_COPY.publishedIncomplete}
        </p>
    );
}

/**
 * Publish prerequisites with ✓/✗ and an "Ubah" action that opens the owning wizard step.
 * `locked` disables "Ubah" for period-bound checks; departments are master data and stay editable.
 * `published` adds a warning when the survey is live but no longer ready.
 */
export function ReadinessList({ readiness, onEdit, locked, published }: {
    readiness: CsiReadiness; onEdit: (step: WizardStepKey) => void; locked?: boolean; published?: boolean;
}) {
    return (
        <>
            {published && !readiness.ready && <PublishedIncompleteNote />}
            <ul className="divide-y divide-[hsl(var(--idesk-border)/.55)] rounded-2xl border border-[hsl(var(--idesk-border)/.7)]">
                {readiness.checks.map((check) => (
                    <li key={check.key} className="flex items-center gap-3 px-4 py-3">
                        <span aria-hidden="true" className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full',
                            check.ok ? 'bg-[hsl(var(--ticket-green)/.15)] text-[hsl(var(--ticket-green-ink))]' : 'bg-[hsl(var(--ticket-red)/.12)] text-[hsl(var(--ticket-red-ink))]')}>
                            {check.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </span>
                        <span className={cn('min-w-0 flex-1 text-[13.5px]', !check.ok && 'font-medium')}>
                            <span>{check.label}</span>{' '}
                            <span className="sr-only">{check.ok ? WIZARD_COPY.checkOk : WIZARD_COPY.checkFailed}</span>
                        </span>
                        <Button variant="subtle" disabled={locked && PERIOD_BOUND.has(check.key)} aria-label={`${WIZARD_COPY.edit}: ${check.label}`} onClick={() => onEdit(READINESS_STEP[check.key])}>
                            <Pencil aria-hidden="true" />{WIZARD_COPY.edit}
                        </Button>
                    </li>
                ))}
            </ul>
        </>
    );
}
