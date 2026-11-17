import { useState } from 'react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useRemoveCsiPeriodRater } from '../../hooks/useCsi';
import type { CsiScopeParam } from '../../types';

const MASTER_CHECK_ID = 'csi-remove-rater-master';

export interface RemovePeriodRaterTarget {
    userId: string;
    name: string;
}

interface RemovePeriodRaterDialogProps {
    scope: CsiScopeParam;
    periodId: string;
    target: RemovePeriodRaterTarget | null;
    onClose: () => void;
}

/** Confirms removing an unanswered rater from a survey, with an option to remove them from master Daftar penilai too. */
export function RemovePeriodRaterDialog({ scope, periodId, target, onClose }: RemovePeriodRaterDialogProps) {
    const [removeFromMaster, setRemoveFromMaster] = useState(false);
    const remove = useRemoveCsiPeriodRater(scope, periodId);
    const close = () => {
        setRemoveFromMaster(false);
        onClose();
    };
    const handleConfirm = () => {
        if (!target) return;
        remove.mutate(
            { userId: target.userId, removeFromMaster },
            {
                onSuccess: () => {
                    toast.success(removeFromMaster
                        ? `${target.name} dihapus dari survei dan Daftar penilai`
                        : `${target.name} dihapus dari survei`);
                    close();
                },
            },
        );
    };

    return (
        <ConfirmationDialog
            isOpen={target !== null}
            appearance="ticket"
            variant="destructive"
            title="Hapus penilai dari survei?"
            description={target
                ? `${target.name} belum mengisi survei ini dan akan dihapus dari daftar penilai serta pasangan penilaian pada survei ini.`
                : ''}
            confirmText="Hapus penilai"
            cancelText="Batal"
            isLoading={remove.isPending}
            onCancel={close}
            onConfirm={handleConfirm}
        >
            <label htmlFor={MASTER_CHECK_ID} className="mt-2 flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                <Checkbox
                    id={MASTER_CHECK_ID}
                    checked={removeFromMaster}
                    onCheckedChange={(checked) => setRemoveFromMaster(checked === true)}
                />
                <span>Sekalian hapus dari Daftar penilai (Pengaturan)</span>
            </label>
        </ConfirmationDialog>
    );
}
