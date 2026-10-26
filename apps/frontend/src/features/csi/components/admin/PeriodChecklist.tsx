import { useState } from 'react';
import { Pencil, Send, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useDeleteCsiPeriod, usePublishCsiPeriod, useUnpublishCsiPeriod } from '../../hooks/useCsi';
import type { WizardStepKey } from '../../lib/wizard';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { ReadinessList } from '../wizard/ReadinessList';
import { WIZARD_COPY } from '../wizard/wizardCopy';
import { AdminSection, LockedNote } from './AdminParts';

function DeletePeriod({ scope, period, onDeleted }: { scope: CsiScopeParam; period: CsiPeriodDetail; onDeleted: () => void }) {
    const [open, setOpen] = useState(false);
    const remove = useDeleteCsiPeriod(scope);
    return (
        <>
            <Button variant="danger" onClick={() => setOpen(true)} disabled={period.locked}
                title={period.locked ? 'Survei yang sudah memiliki jawaban tidak dapat dihapus' : undefined}>
                <Trash2 aria-hidden="true" />Hapus survei
            </Button>
            <ConfirmationDialog isOpen={open} appearance="ticket" variant="destructive" title="Hapus survei?"
                description={`"${period.title}" beserta penugasannya akan dihapus permanen.`} confirmText="Hapus" cancelText="Batal"
                isLoading={remove.isPending} onCancel={() => setOpen(false)}
                onConfirm={() => remove.mutate(period.id, { onSuccess: () => { setOpen(false); onDeleted(); } })} />
        </>
    );
}

function PublishAction({ scope, period }: { scope: CsiScopeParam; period: CsiPeriodDetail }) {
    const publish = usePublishCsiPeriod(scope, period.id);
    const unpublish = useUnpublishCsiPeriod(scope, period.id);
    if (period.publishStatus === 'DRAFT') {
        return (
            <Button variant="primary" loading={publish.isPending} disabled={!period.readiness.ready}
                onClick={() => publish.mutate(undefined, { onSuccess: () => toast.success(WIZARD_COPY.published) })}>
                <Send aria-hidden="true" />{WIZARD_COPY.publish}
            </Button>
        );
    }
    // Backend rejects unpublish once answers exist (409); hide the action instead of failing.
    if (period.locked) return null;
    return (
        <Button variant="soft" loading={unpublish.isPending}
            onClick={() => unpublish.mutate(undefined, { onSuccess: () => toast.success(WIZARD_COPY.unpublished) })}>
            <Undo2 aria-hidden="true" />{WIZARD_COPY.unpublish}
        </Button>
    );
}

interface PeriodChecklistProps {
    scope: CsiScopeParam;
    period: CsiPeriodDetail;
    onEditStep: (step: WizardStepKey) => void;
    onDeleted: () => void;
}

/** Detail "Kelengkapan" card: readiness, edit shortcuts into the wizard, publish state, delete. */
export function PeriodChecklist({ scope, period, onEditStep, onDeleted }: PeriodChecklistProps) {
    return (
        <AdminSection title={WIZARD_COPY.readinessTitle} description="Syarat agar survei bisa terbit. Ubah membuka langkah wizard terkait."
            actions={(
                <Button variant="soft" onClick={() => onEditStep('info')}>
                    <Pencil aria-hidden="true" />{WIZARD_COPY.editInfo}
                </Button>
            )}>
            <ReadinessList readiness={period.readiness} onEdit={onEditStep} />
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                {period.locked && <LockedNote />}
                <span className="flex-1" />
                <DeletePeriod scope={scope} period={period} onDeleted={onDeleted} />
                <PublishAction scope={scope} period={period} />
            </div>
        </AdminSection>
    );
}
