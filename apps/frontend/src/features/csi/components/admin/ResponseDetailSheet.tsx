import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCsiResponseDetail, useResetCsiResponse } from '../../hooks/useCsi';
import { CSI_RESET_REASON_MAX, CSI_RESET_REASON_MIN } from '../../lib/csiAdmin';
import { formatDateTime } from '../../lib/format';
import type { CsiResponseDetail, CsiScopeParam } from '../../types';
import { StarRating } from '../StarRating';
import { FIELD_LABEL, MUTED_TEXT } from './AdminParts';

const REASON_ID = 'csi-reset-reason';

function ResetDialog({ open, name, pending, onCancel, onConfirm }: {
    open: boolean; name: string; pending: boolean; onCancel: () => void; onConfirm: (reason: string) => void;
}) {
    const [reason, setReason] = useState('');
    const trimmed = reason.trim();
    const close = () => { setReason(''); onCancel(); };
    return (
        <ConfirmationDialog isOpen={open} appearance="ticket" variant="destructive" title="Reset jawaban?"
            description={`Jawaban ${name} akan dihapus dan ia dapat mengisi ulang. Tindakan ini tercatat di audit log.`}
            confirmText="Reset jawaban" cancelText="Batal" isLoading={pending}
            confirmDisabled={trimmed.length < CSI_RESET_REASON_MIN} onCancel={close} onConfirm={() => onConfirm(trimmed)}>
            <div className="mt-2 grid gap-1.5">
                <label htmlFor={REASON_ID} className={FIELD_LABEL}>Alasan reset</label>
                <Textarea id={REASON_ID} value={reason} rows={3} maxLength={CSI_RESET_REASON_MAX} onChange={(event) => setReason(event.target.value)}
                    placeholder="Mis. responden salah memilih departemen" aria-describedby={`${REASON_ID}-hint`} />
                <span id={`${REASON_ID}-hint`} className={cn(MUTED_TEXT, 'text-[12px]')}>{`Minimal ${CSI_RESET_REASON_MIN} karakter · ${trimmed.length}/${CSI_RESET_REASON_MAX}`}</span>
            </div>
        </ConfirmationDialog>
    );
}

function DetailBody({ detail }: { detail: CsiResponseDetail }) {
    return (
        <ul className="space-y-3">
            {detail.ratees.map((ratee) => (
                <li key={ratee.periodRateeId} className="rounded-2xl border border-[hsl(var(--idesk-border)/.7)] p-4">
                    <p className="text-[14px] font-semibold">{ratee.displayName}</p>
                    {ratee.jobTitle && <p className={cn(MUTED_TEXT, 'text-[12px]')}>{ratee.jobTitle}</p>}
                    <ul className="mt-3 divide-y divide-[hsl(var(--idesk-border)/.5)]">
                        {ratee.scores.map((item) => (
                            <li key={item.dimension} className="flex items-center justify-between gap-3 py-2">
                                <span className="text-[13.5px]">{item.dimension}</span>
                                <StarRating value={item.score} label={`${item.dimension} untuk ${ratee.displayName}`} size="sm" hideLabel />
                            </li>
                        ))}
                    </ul>
                    {ratee.comment && <p className="mt-3 whitespace-pre-line rounded-xl bg-[hsl(var(--muted)/.6)] px-3 py-2 text-[13px]">{ratee.comment}</p>}
                </li>
            ))}
        </ul>
    );
}

export function ResponseDetailSheet({ scope, periodId, responseId, onClose }: {
    scope: CsiScopeParam; periodId: string; responseId: string | null; onClose: () => void;
}) {
    const { data: detail, isLoading, isError, refetch } = useCsiResponseDetail(scope, periodId, responseId ?? '');
    const reset = useResetCsiResponse(scope, periodId);
    const [confirming, setConfirming] = useState(false);
    const confirm = (reason: string) => {
        if (!responseId) return;
        reset.mutate({ responseId, reason }, { onSuccess: () => { setConfirming(false); onClose(); } });
    };
    return (
        <>
            {/* Hidden while confirming: a modal Radix sheet blocks pointer events outside itself. */}
            <Sheet open={!!responseId && !confirming} onOpenChange={(open) => { if (!open && !confirming) onClose(); }}>
                <SheetContent side="right" className="max-w-lg">
                    <SheetHeader className="pr-12">
                        <SheetTitle>{detail?.fullName ?? 'Detail jawaban'}</SheetTitle>
                        <SheetDescription>{detail ? `${detail.departmentName} · ${formatDateTime(detail.submittedAt)}` : 'Memuat jawaban…'}</SheetDescription>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                        {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--muted))] motion-reduce:animate-none" aria-busy="true" />}
                        {isError && <ErrorState compact message="Gagal memuat jawaban." onRetry={() => refetch()} />}
                        {detail && <DetailBody detail={detail} />}
                    </div>
                    <div className="flex justify-end border-t border-[hsl(var(--idesk-border)/.7)] px-6 py-4">
                        <Button variant="danger" onClick={() => setConfirming(true)} disabled={!detail}>
                            <RotateCcw aria-hidden="true" />Reset jawaban
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
            <ResetDialog open={confirming} name={detail?.fullName ?? ''} pending={reset.isPending}
                onCancel={() => setConfirming(false)} onConfirm={confirm} />
        </>
    );
}
