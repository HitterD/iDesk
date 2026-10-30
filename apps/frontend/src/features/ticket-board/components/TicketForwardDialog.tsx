import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './ticket-detail/TicketActionDialog';
import React, { useState, useEffect } from 'react';
import { Check, Forward, X } from 'lucide-react';
import { ActionSelect } from './ticket-detail/ActionControls';

export type ForwardTargetTeam = 'OPS_SUPPORT' | 'ORACLE_DEV' | 'MOBILE_DEV' | 'WEB_DEV';
export interface ForwardTicketInfo {
    id: string;
    ticketNumber?: string;
    title?: string;
    handlingTeam?: ForwardTargetTeam | string;
}
interface TicketForwardDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: ForwardTicketInfo | null;
    onConfirm: (targetTeam: ForwardTargetTeam, reason: string) => Promise<void> | void;
    isLoading?: boolean;
}
const TEAM_OPTIONS: { value: ForwardTargetTeam; label: string; desc: string }[] = [
    { value: 'OPS_SUPPORT', label: 'IT Support / Ops Support', desc: 'Infrastruktur, jaringan, perangkat, dan operasional.' },
    { value: 'ORACLE_DEV', label: 'Oracle / K2 Developer', desc: 'Oracle, K2 ERP, dan database.' },
    { value: 'WEB_DEV', label: 'Web Developer Team', desc: 'Web, portal, dan integrasi.' },
    { value: 'MOBILE_DEV', label: 'Mobile Developer Team', desc: 'Aplikasi iOS dan Android.' },
];
const REASON_PRESETS = [
    { value: 'web_issue', label: 'Terkait aplikasi Web / Portal / Frontend', forTeam: 'WEB_DEV' },
    { value: 'mobile_issue', label: 'Terkait aplikasi Mobile (iOS / Android)', forTeam: 'MOBILE_DEV' },
    { value: 'oracle_issue', label: 'Terkait aplikasi Oracle / K2', forTeam: 'ORACLE_DEV' },
    { value: 'infra_issue', label: 'Masalah infrastruktur / perangkat / IT Support', forTeam: 'OPS_SUPPORT' },
    { value: 'needs_dev', label: 'Butuh kode / akses developer' },
    { value: 'misrouted', label: 'Salah routing awal' },
    { value: 'other', label: 'Lainnya' },
];
const NOTE_MAX_LENGTH = 500;
const getTeamName = (team?: string) => TEAM_OPTIONS.find((option) => option.value === team)?.label || 'IT Support / Ops Support';
const getTeamPreset = (team: ForwardTargetTeam) => REASON_PRESETS.find((preset) => preset.forTeam === team)!.value;

export const TicketForwardDialog: React.FC<TicketForwardDialogProps> = ({ isOpen, onClose, ticket, onConfirm, isLoading = false }) => {
    const [selectedTeam, setSelectedTeam] = useState<ForwardTargetTeam>('ORACLE_DEV');
    const [selectedPreset, setSelectedPreset] = useState('oracle_issue');
    const [customReason, setCustomReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!isOpen || !ticket) return;
        const defaultTeam = ticket.handlingTeam === 'ORACLE_DEV' ? 'WEB_DEV' : ticket.handlingTeam === 'WEB_DEV' ? 'MOBILE_DEV' : 'ORACLE_DEV';
        setSelectedTeam(defaultTeam);
        setSelectedPreset(getTeamPreset(defaultTeam));
        setCustomReason('');
        setError(null);
    }, [isOpen, ticket]);
    if (!ticket) return null;
    const currentTeam = ticket.handlingTeam || 'OPS_SUPPORT';
    const handleConfirm = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (isLoading) return;
        if (selectedTeam === currentTeam) { setError('Pilih tim tujuan yang berbeda dari tim saat ini.'); return; }
        if (selectedPreset === 'other' && !customReason.trim()) {
            setError('Mohon tuliskan alasan pengalihan pada kolom catatan.');
            return;
        }
        const presetLabel = REASON_PRESETS.find((preset) => preset.value === selectedPreset)?.label || selectedPreset;
        const finalReason = selectedPreset === 'other' ? customReason.trim() : `${presetLabel}${customReason.trim() ? `: ${customReason.trim()}` : ''}`;
        try {
            setError(null);
            await onConfirm(selectedTeam, finalReason);
        } catch (cause: any) {
            setError(cause?.response?.data?.message || cause?.message || 'Gagal meneruskan tiket');
        }
    };
    return (
        <TicketActionDialog open={isOpen} onClose={onClose} title="Teruskan tiket" busy={isLoading}>
            <form className="ticket-action-inner ticket-action-simple" onSubmit={handleConfirm} onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void handleConfirm(); }
            }}>
                <header className="ticket-action-header">
                    <div><h2>Teruskan tiket</h2><p>#{ticket.ticketNumber || ticket.id.slice(0, 8)} · {ticket.title || 'Support Request'}</p></div>
                    <Button variant="subtle" size="icon" type="button" aria-label="Tutup dialog" onClick={onClose} disabled={isLoading}><X /></Button>
                </header>
                <div className="ticket-action-body">
                    <p className="ticket-action-current">Tim saat ini: <strong>{getTeamName(currentTeam)}</strong></p>
                    <fieldset className="ticket-action-teams" disabled={isLoading}>
                        <legend>Tim tujuan <span>(wajib)</span></legend>
                        <div className="ticket-action-teamlist">
                            {TEAM_OPTIONS.map((option) => {
                                const isCurrent = option.value === currentTeam;
                                return <label className="ticket-action-team" key={option.value}>
                                    <input type="radio" name="forward-team" value={option.value} checked={selectedTeam === option.value} disabled={isCurrent}
                                        onChange={() => { setSelectedTeam(option.value); setSelectedPreset(getTeamPreset(option.value)); setError(null); }} />
                                    <span><b>{option.label}</b><small>{isCurrent ? 'Tim saat ini · tidak dapat dipilih' : option.desc}</small></span>
                                    {isCurrent ? <em className="ticket-action-team-now">Saat ini</em> : <Check className="ticket-action-team-check" aria-hidden="true" />}
                                </label>;
                            })}
                        </div>
                    </fieldset>
                    <div className="ticket-action-field">
                        <label htmlFor="ticket-forward-reason">Alasan <span>(wajib)</span></label>
                        <ActionSelect id="ticket-forward-reason" options={REASON_PRESETS} value={selectedPreset} disabled={isLoading}
                            onValueChange={(value) => { setSelectedPreset(value); setError(null); }} />
                    </div>
                    <div className="ticket-action-field">
                        <label htmlFor="ticket-forward-note">Catatan tambahan <span>{selectedPreset === 'other' ? '(wajib untuk Lainnya)' : '(opsional)'}</span></label>
                        <textarea id="ticket-forward-note" value={customReason} maxLength={NOTE_MAX_LENGTH} disabled={isLoading} rows={3}
                            aria-invalid={Boolean(error)} aria-describedby={error ? 'ticket-forward-error' : undefined}
                            onChange={(event) => { setCustomReason(event.target.value.slice(0, NOTE_MAX_LENGTH)); setError(null); }}
                            placeholder="Tambahkan konteks untuk tim tujuan…" />
                        {error && <p id="ticket-forward-error" role="alert">{error}</p>}
                    </div>
                </div>
                <footer className="ticket-action-footer"><div>
                    <Button variant="soft" type="button" onClick={onClose} disabled={isLoading}>Batal</Button>
                    <Button variant="primary" className="ticket-action-forward" type="submit" loading={isLoading}
                        disabled={isLoading || (selectedPreset === 'other' && !customReason.trim())}>
                        <Forward />{isLoading ? 'Meneruskan…' : 'Teruskan tiket'}
                    </Button>
                </div></footer>
            </form>
        </TicketActionDialog>
    );
};
