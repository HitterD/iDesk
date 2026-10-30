import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ADMIN_PANEL } from '../admin/AdminParts';
import { WIZARD_COPY } from './wizardCopy';

interface WizardFooterProps {
    showBack: boolean;
    showNext: boolean;
    /** Unsaved ratee/rater edits, or info edits that cannot be saved yet: navigation waits. */
    blocked: boolean;
    nextDisabled: boolean;
    exitDisabled: boolean;
    pending: boolean;
    onBack: () => void;
    onNext: () => void;
    onExit: () => void;
}

export function WizardFooter(props: WizardFooterProps) {
    const { showBack, showNext, blocked, nextDisabled, exitDisabled, pending } = props;
    return (
        <footer className={cn(ADMIN_PANEL, 'sticky bottom-3 z-10 flex flex-wrap items-center gap-2 px-5 py-3.5 sm:px-6')}>
            {showBack && (
                <Button variant="subtle" onClick={props.onBack} disabled={blocked || pending}>
                    <ArrowLeft aria-hidden="true" />{WIZARD_COPY.back}
                </Button>
            )}
            <span className="flex-1" />
            {blocked && (
                <span role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">{WIZARD_COPY.saveFirst}</span>
            )}
            <Button variant="soft" onClick={props.onExit} disabled={blocked || exitDisabled || pending}>{WIZARD_COPY.saveExit}</Button>
            {showNext && (
                <Button variant="primary" onClick={props.onNext} loading={pending} disabled={blocked || nextDisabled}>
                    {WIZARD_COPY.next}<ArrowRight aria-hidden="true" />
                </Button>
            )}
        </footer>
    );
}
