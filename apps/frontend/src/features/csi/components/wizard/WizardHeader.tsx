import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useDeleteCsiPeriod } from '../../hooks/useCsi';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { PublishPill } from '../admin/AdminParts';
import { WIZARD_COPY } from './wizardCopy';

/** Drafts can be abandoned from inside the wizard; otherwise an unused draft would keep blocking its site+dates. */
function DeleteDraft({ scope, period, onDeleted }: { scope: CsiScopeParam; period: CsiPeriodDetail; onDeleted: () => void }) {
    const [open, setOpen] = useState(false);
    const remove = useDeleteCsiPeriod(scope);
    return (
        <>
            <Button variant="danger" onClick={() => setOpen(true)}><Trash2 aria-hidden="true" />{WIZARD_COPY.deleteDraft}</Button>
            <ConfirmationDialog isOpen={open} appearance="ticket" variant="destructive" title={WIZARD_COPY.deleteDraftTitle}
                description={`"${period.title}" beserta penugasannya akan dihapus permanen.`} confirmText="Hapus" cancelText="Batal"
                isLoading={remove.isPending} onCancel={() => setOpen(false)}
                onConfirm={() => remove.mutate(period.id, { onSuccess: () => { setOpen(false); onDeleted(); } })} />
        </>
    );
}

interface WizardHeaderProps {
    scope: CsiScopeParam;
    period: CsiPeriodDetail | undefined;
    /** "Semua survei": the wizard saves dirty info first, so it is disabled while that cannot happen. */
    onBack: () => void;
    backDisabled: boolean;
    onDeleted: () => void;
}

export function WizardHeader({ scope, period, onBack, backDisabled, onDeleted }: WizardHeaderProps) {
    return (
        <header className="grid gap-3">
            <button type="button" onClick={onBack} disabled={backDisabled} className="idesk-text-link w-fit disabled:cursor-not-allowed disabled:opacity-50"><ArrowLeft aria-hidden="true" />Semua survei</button>
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 text-[20px] font-bold tracking-tight">{period?.title || WIZARD_COPY.create}</h2>
                {period && <PublishPill status={period.publishStatus} />}
                <span className="flex-1" />
                {period && period.publishStatus === 'DRAFT' && !period.locked && <DeleteDraft scope={scope} period={period} onDeleted={onDeleted} />}
            </div>
        </header>
    );
}
