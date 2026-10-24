import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EFORM_TYPES } from '@/features/request-center/components/eform/eform-vocabulary';
import { VPN_NEEDS, type EFormType } from './eformFlow';
import { useProposeEForm } from './useTicketEForm';
import type { ProposeEFormPayload } from './api';
import '../ticket-hardware/ticket-hardware.css';
import './ticket-eform.css';

const MIN_REASON = 5;

interface ProposeEFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ticketId: string;
    ticketNumber?: string;
    requesterName?: string;
    /** Starting text for the reason; the ticket title usually says what is needed. */
    defaultReason?: string;
}

/** One optional, type-specific detail IT may already know; the requester can still change it before signing. */
function TypeDetail({ type, value, onChange }: { type: EFormType; value: string; onChange: (value: string) => void }) {
    if (type === 'VPN') {
        return (
            <div className="tef-detail">
            <span className="thw-label" id="tef-vpn">Kebutuhan VPN <span>opsional</span></span>
            <div className="tef-needs" role="radiogroup" aria-labelledby="tef-vpn">
                {VPN_NEEDS.map((need) => (
                    <button key={need} type="button" role="radio" aria-checked={value === need}
                        className={cn('thw-flow', value === need && 'is-selected')} onClick={() => onChange(value === need ? '' : need)}>
                        <b>{need}</b>
                    </button>
                ))}
            </div>
            </div>
        );
    }
    const field: Record<Exclude<EFormType, 'VPN'>, { label: string; placeholder: string; multiline?: boolean }> = {
        WEBSITE: { label: 'Website yang perlu dibuka', placeholder: 'Satu per baris, mis. app.vendor.com', multiline: true },
        NETWORK: { label: 'Kebutuhan jaringan', placeholder: 'Mis. akses ke server produksi dari ruang QC', multiline: true },
        FLASHDISK: { label: 'Hostname PC', placeholder: 'Mis. SPJ-FIN-0231' },
        EMAIL: { label: 'Usulan alamat email', placeholder: 'Mis. budi.santoso (tanpa @kapalapi.co.id)' },
        SYNOLOGY_NAS: { label: 'Folder yang dibutuhkan', placeholder: 'Mis. SPJ: /Finance/Laporan 2026' },
    };
    const { label, placeholder, multiline } = field[type];
    return (
        <label className="tef-detail">
            <span className="thw-label">{label} <span>opsional</span></span>
            {multiline
                ? <textarea className="thw-reason" rows={2} maxLength={1000} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
                : <input className="tef-input" maxLength={300} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
        </label>
    );
}

function payloadFor(type: EFormType, note: string, detail: string): ProposeEFormPayload {
    const value = detail.trim();
    const base: ProposeEFormPayload = { formType: type, note: note.trim() };
    if (!value) return base;
    switch (type) {
        case 'VPN': return { ...base, details: { kebutuhanAkses: value } };
        case 'WEBSITE': return { ...base, requestedWebsites: value };
        case 'NETWORK': return { ...base, networkPurpose: value };
        case 'FLASHDISK': return { ...base, details: { hostname: value } };
        case 'EMAIL': return { ...base, details: { proposedEmail: value.replace(/@.*$/, '') } };
        case 'SYNOLOGY_NAS': return { ...base, details: { folderPath: value } };
    }
}

/** IT picks the access and fills what it knows; the requester completes, picks the approver and signs from the chat. */
export const ProposeEFormDialog: React.FC<ProposeEFormDialogProps> = ({
    open, onOpenChange, ticketId, ticketNumber, requesterName, defaultReason = '',
}) => {
    const [type, setType] = useState<EFormType>('VPN');
    const [detail, setDetail] = useState('');
    const [reason, setReason] = useState(defaultReason);
    const propose = useProposeEForm(ticketId);
    const canSend = reason.trim().length >= MIN_REASON && !propose.isPending;

    const close = () => {
        onOpenChange(false);
        setType('VPN');
        setDetail('');
        setReason(defaultReason);
    };
    const pickType = (next: EFormType) => { setType(next); setDetail(''); };
    const send = () => { if (canSend) propose.mutate(payloadFor(type, reason, detail), { onSuccess: close }); };

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
            <DialogContent className="thw-dialog flex flex-col max-w-[640px] max-h-[90vh] min-h-0 overflow-hidden p-0 gap-0">
                <header className="thw-head">
                    <DialogTitle className="thw-title">Usulkan akses E-Form</DialogTitle>
                    <DialogDescription className="thw-sub">
                        {requesterName ? <>Untuk <b>{requesterName}</b></> : 'Untuk pemohon tiket'}
                        {ticketNumber ? ` · tiket #${ticketNumber}` : ''}. Pemohon melengkapi, memilih atasan dan menandatangani dari chat.
                    </DialogDescription>
                </header>

                <div className="thw-body">
                    <section className="thw-sec" aria-labelledby="tef-type">
                        <h3 id="tef-type" className="thw-label">Jenis akses</h3>
                        <div className="tef-types" role="radiogroup" aria-labelledby="tef-type">
                            {EFORM_TYPES.map((option) => {
                                const Icon = option.icon;
                                return (
                                    <button key={option.id} type="button" role="radio" aria-checked={type === option.id}
                                        className={cn('thw-flow tef-type', type === option.id && 'is-selected')} onClick={() => pickType(option.id)}>
                                        <Icon aria-hidden="true" />
                                        <b>{option.label}</b>
                                        <small>{option.description}</small>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="thw-sec">
                        <TypeDetail type={type} value={detail} onChange={setDetail} />
                    </section>

                    <section className="thw-sec">
                        <label className="thw-label" htmlFor="tef-reason">Alasan untuk pemohon</label>
                        <textarea id="tef-reason" className="thw-reason" rows={3} maxLength={1000} value={reason}
                            onChange={(e) => setReason(e.target.value)} placeholder="Mis. Untuk WFH mulai minggu depan, perlu remote ke PC kantor." />
                    </section>
                </div>

                <footer className="thw-foot">
                    <span className="thw-summary">Pemohon menerima kartu di chat untuk menandatangani</span>
                    <Button type="button" variant="soft" onClick={close}>Batal</Button>
                    <Button type="button" variant="primary" onClick={send} disabled={!canSend} loading={propose.isPending}>
                        <Send aria-hidden="true" />Kirim ke pemohon
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};
