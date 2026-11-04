import { useId, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { errorMessage } from '../../lib/csiForm';
import { toneClasses } from '../../lib/csiTone';
import type { ConfirmCsiPeriodAction } from '../../types';
import { FIELD_LABEL } from './AdminParts';

export const CSI_CONFIRM_REASON_MIN = 5;
export const CSI_CONFIRM_REASON_MAX = 500;
const collapse = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

interface ConfirmByTitleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    /** The survey title the admin must retype. */
    expectedTitle: string;
    /** What happens, in plain words (counts, who is affected). */
    impact: ReactNode;
    confirmText: string;
    pending: boolean;
    error: unknown;
    onConfirm: (payload: ConfirmCsiPeriodAction) => void;
}

/**
 * Double confirmation for actions that stop or delete a survey: the impact is spelled out, the title must be retyped
 * and a reason given (it goes to the audit log). The button stays disabled until both are right.
 */
export function ConfirmByTitleDialog({ open, onOpenChange, title, expectedTitle, impact, confirmText, pending, error, onConfirm }: ConfirmByTitleDialogProps) {
    const [typed, setTyped] = useState('');
    const [reason, setReason] = useState('');
    const ids = { title: useId(), reason: useId() };
    const titleOk = collapse(typed) === collapse(expectedTitle);
    const reasonOk = reason.trim().length >= CSI_CONFIRM_REASON_MIN;
    const red = toneClasses('red');
    const close = (next: boolean) => { if (!next) { setTyped(''); setReason(''); } onOpenChange(next); };
    const failure = error ? errorMessage(error) ?? 'Gagal. Silakan coba lagi.' : null;
    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><AlertTriangle className={cn('h-5 w-5', red.ink)} aria-hidden="true" />{title}</DialogTitle>
                    <DialogDescription asChild><div className="text-[13.5px] leading-relaxed">{impact}</div></DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                    <label htmlFor={ids.title} className="grid gap-1.5">
                        <span className={FIELD_LABEL}>Ketik ulang judul survei untuk konfirmasi: <b className="text-[hsl(var(--idesk-text))]">{expectedTitle}</b></span>
                        <Input id={ids.title} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" aria-invalid={typed !== '' && !titleOk ? true : undefined} />
                        {typed !== '' && !titleOk && <span className={cn('text-[12px]', red.ink)}>Judul belum sama.</span>}
                    </label>
                    <label htmlFor={ids.reason} className="grid gap-1.5">
                        <span className={FIELD_LABEL}>{`Alasan (minimal ${CSI_CONFIRM_REASON_MIN} karakter, tercatat di Audit Log)`}</span>
                        <Textarea id={ids.reason} rows={2} maxLength={CSI_CONFIRM_REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} />
                    </label>
                    {failure && <p role="alert" className={cn('rounded-lg px-3 py-2 text-[13px] font-medium', red.soft, red.ink)}>{failure}</p>}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="subtle" onClick={() => close(false)} disabled={pending}>Batal</Button>
                    <Button variant="danger" loading={pending} disabled={!titleOk || !reasonOk}
                        onClick={() => onConfirm({ confirmTitle: typed, reason: reason.trim() })}>{confirmText}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
