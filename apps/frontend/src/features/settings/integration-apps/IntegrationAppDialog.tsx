import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PERMISSIONS, useApiModules, type AppPermission, type IntegrationApp, type IntegrationAppInput } from './api';

const CLIENT_ID_PATTERN = /^[a-z][a-z0-9-]{1,19}$/;
const RESERVED = ['ipop', 'web', 'email', 'telegram', 'api', 'idesk'];
const DEFAULT_PERMISSIONS: AppPermission[] = ['tickets:create', 'tickets:read', 'messages:read', 'messages:write'];

interface IntegrationAppDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Editing an existing app; undefined to add one. */
    app?: IntegrationApp;
    saving: boolean;
    onSubmit: (input: IntegrationAppInput) => void;
}

/** Add or edit a connected app: who it is, which modules it may file into, what it may do, where events go. */
export const IntegrationAppDialog: React.FC<IntegrationAppDialogProps> = ({ open, onOpenChange, app, saving, onSubmit }) => {
    const { data: modules = [] } = useApiModules();
    const [name, setName] = useState('');
    const [clientId, setClientId] = useState('');
    const [description, setDescription] = useState('');
    const [picked, setPicked] = useState<string[]>([]);
    const [permissions, setPermissions] = useState<AppPermission[]>(DEFAULT_PERMISSIONS);
    const [webhookUrl, setWebhookUrl] = useState('');

    useEffect(() => {
        if (!open) return;
        setName(app?.name ?? '');
        setClientId(app?.clientId ?? '');
        setDescription(app?.description ?? '');
        setPicked(app?.modules ?? []);
        setPermissions(app?.permissions ?? DEFAULT_PERMISSIONS);
        setWebhookUrl(app?.webhookUrl ?? '');
    }, [open, app]);

    const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    const clientIdError = !app && clientId && (!CLIENT_ID_PATTERN.test(clientId) ? '2–20 huruf kecil, angka atau "-", diawali huruf'
        : RESERVED.includes(clientId) ? 'Nama ini dipakai sistem' : '');
    const webhookError = webhookUrl && !/^https?:\/\/\S+$/.test(webhookUrl.trim()) ? 'Harus diawali http:// atau https://' : '';
    const valid = name.trim().length >= 2 && (app || (clientId && !clientIdError)) && picked.length > 0 && permissions.length > 0 && !webhookError;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({
            ...(app ? {} : { clientId }),
            name: name.trim(),
            description: description.trim() || null,
            modules: picked,
            permissions,
            webhookUrl: webhookUrl.trim() || null,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="iapp-dialog flex flex-col max-w-[600px] max-h-[90vh] min-h-0 overflow-hidden p-0 gap-0">
                <form onSubmit={submit} className="flex flex-col min-h-0">
                    <header className="iapp-dhead">
                        <DialogTitle className="iapp-dtitle">{app ? `Ubah ${app.name}` : 'Tambah aplikasi'}</DialogTitle>
                        <DialogDescription className="iapp-dsub">
                            Aplikasi ini bisa membuat dan memantau tiket lewat API, hanya di modul dan fitur yang Anda centang.
                        </DialogDescription>
                    </header>

                    <div className="iapp-dbody">
                        <div className="iapp-grid">
                            <label className="iapp-field">
                                <span>Nama aplikasi</span>
                                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. EBBK" maxLength={100} autoFocus />
                            </label>
                            <label className="iapp-field">
                                <span>Client ID</span>
                                <input value={clientId} onChange={(e) => setClientId(e.target.value.toLowerCase())} placeholder="mis. ebbk"
                                    maxLength={20} disabled={Boolean(app)} aria-invalid={Boolean(clientIdError)} className="font-mono" />
                                <small className={cn(clientIdError && 'is-error')}>
                                    {clientIdError || (app ? 'Tidak bisa diubah' : 'Dikirim di header x-idesk-client-id; juga label sumber tiket')}
                                </small>
                            </label>
                        </div>

                        <label className="iapp-field">
                            <span>Keterangan <em>(opsional)</em></span>
                            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="mis. Tiket Web Developer dari aplikasi E-BBK" maxLength={300} />
                        </label>

                        <fieldset className="iapp-field">
                            <legend>Modul yang boleh dipakai</legend>
                            <div className="iapp-chips">
                                {modules.map((m) => (
                                    <button key={m.slug} type="button" role="checkbox" aria-checked={picked.includes(m.slug)}
                                        className={cn('iapp-chip', picked.includes(m.slug) && 'is-on')} onClick={() => setPicked(toggle(picked, m.slug))}>
                                        {picked.includes(m.slug) && <Check aria-hidden="true" />}{m.name}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset className="iapp-field">
                            <legend>Fitur yang diizinkan</legend>
                            <div className="iapp-perms">
                                {PERMISSIONS.map((p) => (
                                    <label key={p.value} className={cn('iapp-perm', permissions.includes(p.value) && 'is-on')}>
                                        <input type="checkbox" checked={permissions.includes(p.value)} onChange={() => setPermissions(toggle(permissions, p.value))} />
                                        <span><b>{p.label}</b><small>{p.hint}</small></span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <label className="iapp-field">
                            <span>URL webhook <em>(opsional)</em></span>
                            <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://ebbk.santos.co.id/api/idesk/webhook"
                                aria-invalid={Boolean(webhookError)} className="font-mono" />
                            <small className={cn(webhookError && 'is-error')}>
                                {webhookError || 'iDesk mengirim perubahan status, PIC dan chat ke URL ini (bertanda tangan). Kosongkan bila tidak perlu.'}
                            </small>
                        </label>
                    </div>

                    <footer className="iapp-dfoot">
                        <Button type="button" variant="soft" onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button type="submit" variant="primary" disabled={!valid} loading={saving}>{app ? 'Simpan' : 'Tambah & buat secret'}</Button>
                    </footer>
                </form>
            </DialogContent>
        </Dialog>
    );
};
