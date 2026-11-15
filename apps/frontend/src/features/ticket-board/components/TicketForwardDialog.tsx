import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './ticket-detail/TicketActionDialog';
import React, { useContext, useState, useEffect, useMemo } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { Check, Forward, X } from 'lucide-react';
import { ActionSelect } from './ticket-detail/ActionControls';
import { useActiveSites, isSelfHandledSite, type Site } from '@/components/site/useActiveSites';

export type ForwardTargetTeam = 'OPS_SUPPORT' | 'ORACLE_DEV' | 'MOBILE_DEV' | 'WEB_DEV';
export interface ForwardTicketInfo {
    id: string;
    ticketNumber?: string;
    title?: string;
    handlingTeam?: ForwardTargetTeam | string;
    siteId?: string | null;
    site?: { id?: string; code: string; name: string } | null;
}
interface TicketForwardDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: ForwardTicketInfo | null;
    onConfirm: (targetTeam: ForwardTargetTeam, reason: string, targetSiteId?: string) => Promise<void> | void;
    isLoading?: boolean;
    /** Optional site list (keeps isolated tests without QueryClient working cleanly). */
    sites?: Site[];
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

const ActiveSitesLoader: React.FC<{ onLoaded: (sites: Site[]) => void }> = ({ onLoaded }) => {
    const { data = [] } = useActiveSites();
    useEffect(() => {
        onLoaded(data);
    }, [data, onLoaded]);
    return null;
};

export const TicketForwardDialog: React.FC<TicketForwardDialogProps> = ({ isOpen, onClose, ticket, onConfirm, isLoading = false, sites }) => {
    const queryClient = useContext(QueryClientContext);
    const [fetchedSites, setFetchedSites] = useState<Site[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<ForwardTargetTeam>('ORACLE_DEV');
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [selectedPreset, setSelectedPreset] = useState('oracle_issue');
    const [customReason, setCustomReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const effectiveSites = sites ?? fetchedSites;
    const currentTeam = ticket?.handlingTeam || 'OPS_SUPPORT';
    const currentSiteId = ticket?.siteId ?? ticket?.site?.id ?? null;

    const selfHandledSites = useMemo(
        () => effectiveSites.filter(isSelfHandledSite),
        [effectiveSites],
    );
    const opsTargetSites = useMemo(
        () => (currentTeam === 'OPS_SUPPORT'
            ? selfHandledSites.filter((site) => site.id !== currentSiteId)
            : selfHandledSites),
        [currentTeam, selfHandledSites, currentSiteId],
    );
    const currentSiteCode = ticket?.site?.code || effectiveSites.find((site) => site.id === currentSiteId)?.code;

    useEffect(() => {
        if (!isOpen || !ticket) return;
        const defaultTeam = ticket.handlingTeam === 'ORACLE_DEV' ? 'WEB_DEV' : ticket.handlingTeam === 'WEB_DEV' ? 'MOBILE_DEV' : 'ORACLE_DEV';
        setSelectedTeam(defaultTeam);
        setSelectedPreset(getTeamPreset(defaultTeam));
        setSelectedSiteId('');
        setCustomReason('');
        setError(null);
    }, [isOpen, ticket]);

    useEffect(() => {
        if (selectedTeam !== 'OPS_SUPPORT') return;
        if (opsTargetSites.length === 0) {
            setSelectedSiteId('');
            return;
        }
        if (opsTargetSites.some((site) => site.id === selectedSiteId)) return;
        const preferred = currentTeam !== 'OPS_SUPPORT' && currentSiteId && opsTargetSites.some((site) => site.id === currentSiteId)
            ? currentSiteId
            : opsTargetSites[0].id;
        setSelectedSiteId(preferred);
    }, [selectedTeam, opsTargetSites, selectedSiteId, currentTeam, currentSiteId]);

    if (!ticket) return null;

    const isOpsSameSiteBlocked = selectedTeam === 'OPS_SUPPORT' && currentTeam === 'OPS_SUPPORT' && (!selectedSiteId || selectedSiteId === currentSiteId);
    const handleConfirm = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (isLoading) return;
        if (selectedTeam === currentTeam && selectedTeam !== 'OPS_SUPPORT') {
            setError('Pilih tim tujuan yang berbeda dari tim saat ini.');
            return;
        }
        if (isOpsSameSiteBlocked || (selectedTeam === 'OPS_SUPPORT' && selfHandledSites.length > 0 && !selectedSiteId)) {
            setError('Pilih site tujuan IT Support yang valid.');
            return;
        }
        if (selectedPreset === 'other' && !customReason.trim()) {
            setError('Mohon tuliskan alasan pengalihan pada kolom catatan.');
            return;
        }
        const presetLabel = REASON_PRESETS.find((preset) => preset.value === selectedPreset)?.label || selectedPreset;
        const finalReason = selectedPreset === 'other' ? customReason.trim() : `${presetLabel}${customReason.trim() ? `: ${customReason.trim()}` : ''}`;
        try {
            setError(null);
            if (selectedTeam === 'OPS_SUPPORT' && selectedSiteId) {
                await onConfirm(selectedTeam, finalReason, selectedSiteId);
            } else {
                await onConfirm(selectedTeam, finalReason);
            }
        } catch (cause: any) {
            setError(cause?.response?.data?.message || cause?.message || 'Gagal meneruskan tiket');
        }
    };

    const siteSelectOptions = opsTargetSites.map((site) => ({
        value: site.id,
        label: currentTeam !== 'OPS_SUPPORT' && site.id === currentSiteId
            ? `${site.code} — ${site.name} (Site saat ini)`
            : `${site.code} — ${site.name}`,
    }));

    return (
        <TicketActionDialog open={isOpen} onClose={onClose} title="Teruskan tiket" busy={isLoading}>
            {isOpen && !sites && queryClient && <ActiveSitesLoader onLoaded={setFetchedSites} />}
            <form className="ticket-action-inner ticket-action-simple" onSubmit={handleConfirm} onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void handleConfirm(); }
            }}>
                <header className="ticket-action-header">
                    <div><h2>Teruskan tiket</h2><p>#{ticket.ticketNumber || ticket.id.slice(0, 8)} · {ticket.title || 'Support Request'}</p></div>
                    <Button variant="subtle" size="icon" type="button" aria-label="Tutup dialog" onClick={onClose} disabled={isLoading}><X /></Button>
                </header>
                <div className="ticket-action-body">
                    <p className="ticket-action-current">
                        Tim saat ini: <strong>{getTeamName(currentTeam)}{currentSiteCode ? ` (${currentSiteCode})` : ''}</strong>
                    </p>
                    <fieldset className="ticket-action-teams" disabled={isLoading}>
                        <legend>Tim tujuan <span>(wajib)</span></legend>
                        <div className="ticket-action-teamlist">
                            {TEAM_OPTIONS.map((option) => {
                                const isCurrentTeam = option.value === currentTeam;
                                const canForwardOpsSite = option.value === 'OPS_SUPPORT' && isCurrentTeam && opsTargetSites.length > 0;
                                const isDisabled = isCurrentTeam && !canForwardOpsSite;
                                const descText = canForwardOpsSite
                                    ? `Teruskan ke IT Support site lain${currentSiteCode ? ` (saat ini: ${currentSiteCode})` : ''}.`
                                    : isCurrentTeam
                                        ? 'Tim saat ini · tidak dapat dipilih'
                                        : option.desc;
                                return <label className="ticket-action-team" key={option.value}>
                                    <input type="radio" name="forward-team" value={option.value} checked={selectedTeam === option.value} disabled={isDisabled}
                                        onChange={() => {
                                            setSelectedTeam(option.value);
                                            setSelectedPreset(option.value === 'OPS_SUPPORT' && currentTeam === 'OPS_SUPPORT' ? 'misrouted' : getTeamPreset(option.value));
                                            setError(null);
                                        }} />
                                    <span><b>{option.label}</b><small>{descText}</small></span>
                                    {isDisabled ? <em className="ticket-action-team-now">Saat ini</em> : <Check className="ticket-action-team-check" aria-hidden="true" />}
                                </label>;
                            })}
                        </div>
                    </fieldset>
                    {selectedTeam === 'OPS_SUPPORT' && opsTargetSites.length > 0 && (
                        <div className="ticket-action-field">
                            <label htmlFor="ticket-forward-site">Site tujuan <span>(wajib)</span></label>
                            <ActionSelect id="ticket-forward-site" options={siteSelectOptions} value={selectedSiteId} disabled={isLoading}
                                onValueChange={(value) => { setSelectedSiteId(value); setError(null); }} />
                        </div>
                    )}
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
                            placeholder="Tambahkan konteks untuk tim atau site tujuan…" />
                        {error && <p id="ticket-forward-error" role="alert">{error}</p>}
                    </div>
                </div>
                <footer className="ticket-action-footer"><div>
                    <Button variant="soft" type="button" onClick={onClose} disabled={isLoading}>Batal</Button>
                    <Button variant="primary" className="ticket-action-forward" type="submit" loading={isLoading}
                        disabled={isLoading || (selectedPreset === 'other' && !customReason.trim()) || (selectedTeam === 'OPS_SUPPORT' && opsTargetSites.length > 0 && !selectedSiteId)}>
                        <Forward />{isLoading ? 'Meneruskan…' : 'Teruskan tiket'}
                    </Button>
                </div></footer>
            </form>
        </TicketActionDialog>
    );
};
