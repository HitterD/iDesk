import { useState } from 'react';
import { ManagerSelector } from '@/features/request-center/components/eform/ManagerSelector';
import type { ApprovalRoute, HardwareSource } from '../flowTypes';
import { FlowDialog } from './FlowDialog';

export interface ReviewChoice {
    route: ApprovalRoute;
    managerId: string;
    gmId: string;
    hardwareSource: HardwareSource | null;
}

const ROUTES: Array<{ value: ApprovalRoute; label: string; hint: string; button: string }> = [
    { value: 'NONE', label: 'Tanpa persetujuan', hint: 'Langsung diproses IT (mis. stok tersedia, akses folder standar).', button: 'Langsung proses' },
    { value: 'MANAGER', label: 'Atasan saja', hint: 'Atasan pemohon menandatangani, lalu IT memproses.', button: 'Kirim ke penyetuju' },
    { value: 'MANAGER_GM', label: 'Atasan + GM', hint: 'Atasan lalu GM menandatangani berurutan.', button: 'Kirim ke penyetuju' },
];

const SOURCES: Array<{ value: HardwareSource; label: string; hint: string }> = [
    { value: 'ANNUAL_BUDGET', label: 'Budget tahunan', hint: 'Sudah ada di anggaran tahun ini.' },
    { value: 'NON_BUDGET', label: 'Non-budget', hint: 'Di luar anggaran; butuh persetujuan.' },
    { value: 'IT_STOCK', label: 'Stok IT', hint: 'Diambil dari stok yang ada, tanpa pembelian.' },
];

/** Can IT send this review? The route decides who must be named; a hardware request also needs the source of its items. */
export function reviewReady(choice: ReviewChoice, isHardware: boolean): boolean {
    if (isHardware && !choice.hardwareSource) return false;
    if (choice.route === 'NONE') return true;
    if (!choice.managerId) return false;
    return choice.route === 'MANAGER' || Boolean(choice.gmId);
}

/** The body of POST /request-flow/:id/review: only the people the route uses, and the source for hardware. */
export function reviewPayload(choice: ReviewChoice, isHardware: boolean, message: string): Record<string, string> {
    const payload: Record<string, string> = { route: choice.route };
    if (choice.route !== 'NONE') payload.managerId = choice.managerId;
    if (choice.route === 'MANAGER_GM') payload.gmId = choice.gmId;
    if (isHardware && choice.hardwareSource) payload.hardwareSource = choice.hardwareSource;
    if (message.trim()) payload.message = message.trim();
    return payload;
}

interface ReviewDialogProps {
    open: boolean;
    onClose: () => void;
    isHardware: boolean;
    /** The manager the requester proposed, if any: the starting point. */
    proposedManagerId?: string | null;
    requesterId?: string;
    onEditItems?: () => void;
    onSubmit: (payload: Record<string, string>) => Promise<unknown>;
}

/** IT's review: where the items come from (hardware), who must approve, and a message for them. */
export function ReviewDialog({ open, onClose, isHardware, proposedManagerId, requesterId, onSubmit, onEditItems }: ReviewDialogProps) {
    const [choice, setChoice] = useState<ReviewChoice>({
        route: proposedManagerId ? 'MANAGER' : 'NONE', managerId: proposedManagerId ?? '', gmId: '', hardwareSource: null,
    });
    const [message, setMessage] = useState('');
    const route = ROUTES.find((r) => r.value === choice.route)!;

    return (
        <FlowDialog
            open={open} onClose={onClose} title="Tinjau permintaan" intro="Tentukan siapa yang harus menyetujui. Anda yang mengatur alurnya."
            submitLabel={route.button} canSubmit={reviewReady(choice, isHardware)} onSubmit={() => onSubmit(reviewPayload(choice, isHardware, message))}
        >
            {onEditItems && <button type="button" className="req-btn" onClick={onEditItems}>Ubah barang</button>}
            {isHardware && (
                <div role="radiogroup" aria-label="Sumber barang" className="req-dialog__choices">
                    <b>Barang berasal dari</b>
                    {SOURCES.map((source) => (
                        <button
                            key={source.value} type="button" role="radio" aria-checked={choice.hardwareSource === source.value}
                            aria-label={source.label} className={choice.hardwareSource === source.value ? 'is-on' : ''}
                            onClick={() => setChoice((c) => ({ ...c, hardwareSource: source.value }))}
                        >
                            <b>{source.label}</b><span>{source.hint}</span>
                        </button>
                    ))}
                </div>
            )}
            <div role="radiogroup" aria-label="Alur persetujuan" className="req-dialog__choices">
                <b>Persetujuan</b>
                {ROUTES.map((r) => (
                    <button
                        key={r.value} type="button" role="radio" aria-checked={choice.route === r.value}
                        aria-label={r.label} className={choice.route === r.value ? 'is-on' : ''}
                        onClick={() => setChoice((c) => ({ ...c, route: r.value }))}
                    >
                        <b>{r.label}</b><span>{r.hint}</span>
                    </button>
                ))}
            </div>
            {choice.route !== 'NONE' && (
                <ManagerSelector
                    idPrefix="review-manager" label="Atasan" currentUserId={requesterId} selectedId={choice.managerId}
                    onSelect={(id) => setChoice((c) => ({ ...c, managerId: id }))}
                />
            )}
            {choice.route === 'MANAGER_GM' && (
                <ManagerSelector
                    idPrefix="review-gm" label="GM" currentUserId={requesterId} selectedId={choice.gmId}
                    onSelect={(id) => setChoice((c) => ({ ...c, gmId: id }))}
                />
            )}
            <label className="req-dialog__field">
                <span>Pesan untuk penyetuju (opsional)</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Pesan" />
            </label>
        </FlowDialog>
    );
}
