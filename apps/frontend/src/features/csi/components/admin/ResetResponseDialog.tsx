import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useResetCsiResponse } from '../../hooks/useCsi';
import { CSI_RESET_REASON_MAX, CSI_RESET_REASON_MIN } from '../../lib/csiAdmin';
import type { CsiScopeParam } from '../../types';
import { FIELD_LABEL, MUTED_TEXT } from './AdminParts';

const REASON_ID = 'csi-reset-reason';

export interface ResetResponseTarget {
    responseId: string;
    name: string;
}

interface ResetResponseDialogProps {
    scope: CsiScopeParam;
    periodId: string;
    target: ResetResponseTarget | null;
    onClose: () => void;
}

/** Confirms resetting one respondent's submission by reason alone without exposing any scores or comments. */
export function ResetResponseDialog({ scope, periodId, target, onClose }: ResetResponseDialogProps) {
    const [reason, setReason] = useState('');
    const reset = useResetCsiResponse(scope, periodId);
    const trimmed = reason.trim();
    const close = () => {
        setReason('');
        onClose();
    };
    const handleConfirm = () => {
        if (!target) return;
        reset.mutate(
            { responseId: target.responseId, reason: trimmed },
            {
                onSuccess: () => {
                    toast.success(`Jawaban ${target.name} direset`);
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
            title="Reset jawaban?"
            description={target ? `Jawaban ${target.name} akan dihapus dan ia dapat mengisi ulang. Tindakan ini tercatat di audit log tanpa detail nilai.` : ''}
            confirmText="Reset jawaban"
            cancelText="Batal"
            isLoading={reset.isPending}
            confirmDisabled={trimmed.length < CSI_RESET_REASON_MIN}
            onCancel={close}
            onConfirm={handleConfirm}
        >
            <div className="mt-2 grid gap-1.5">
                <label htmlFor={REASON_ID} className={FIELD_LABEL}>Alasan reset</label>
                <Textarea
                    id={REASON_ID}
                    value={reason}
                    rows={3}
                    maxLength={CSI_RESET_REASON_MAX}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Mis. responden salah memilih departemen"
                    aria-describedby={`${REASON_ID}-hint`}
                />
                <span id={`${REASON_ID}-hint`} className={cn(MUTED_TEXT, 'text-[12px]')}>
                    {`Minimal ${CSI_RESET_REASON_MIN} karakter · ${trimmed.length}/${CSI_RESET_REASON_MAX}`}
                </span>
            </div>
        </ConfirmationDialog>
    );
}
