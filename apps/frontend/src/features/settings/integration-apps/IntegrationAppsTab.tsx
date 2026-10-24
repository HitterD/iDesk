import React, { useState } from 'react';
import { ChevronDown, KeyRound, Loader2, Pencil, Plug, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/dateFormat';
import {
    PERMISSION_LABEL, apiBaseUrl, useApiModules, useIntegrationAppMutations, useIntegrationApps,
    type IntegrationApp, type IntegrationAppInput, type IssuedSecret,
} from './api';
import { IntegrationAppDialog } from './IntegrationAppDialog';
import { SecretDialog } from './SecretDialog';
import { QuickStart } from './QuickStart';
import './integration-apps.css';

type Confirm = { kind: 'rotate' | 'delete'; app: IntegrationApp } | null;

/** Settings > Integrasi aplikasi: office apps (EBBK, ...) that file and follow tickets through the API. */
export const IntegrationAppsTab: React.FC = () => {
    const { data: apps = [], isLoading } = useIntegrationApps();
    const { data: modules = [] } = useApiModules();
    const { create, update, rotate, remove } = useIntegrationAppMutations();
    const [editing, setEditing] = useState<IntegrationApp | 'new' | null>(null);
    const [issued, setIssued] = useState<IssuedSecret | null>(null);
    const [confirm, setConfirm] = useState<Confirm>(null);
    const [openGuide, setOpenGuide] = useState<string | null>(null);
    const moduleName = (slug: string) => modules.find((m) => m.slug === slug)?.name ?? slug;

    const save = (input: IntegrationAppInput) => {
        if (editing === 'new') {
            create.mutate(input, { onSuccess: (result) => { setEditing(null); setIssued(result); } });
        } else if (editing) {
            update.mutate({ id: editing.id, ...input }, { onSuccess: () => { setEditing(null); toast.success('Perubahan disimpan'); } });
        }
    };

    const runConfirm = () => {
        if (!confirm) return;
        if (confirm.kind === 'rotate') rotate.mutate(confirm.app.id, { onSuccess: (result) => { setConfirm(null); setIssued(result); } });
        else remove.mutate(confirm.app.id, { onSuccess: () => { setConfirm(null); toast.success(`${confirm.app.name} dihapus`); } });
    };

    return (
        <div className="iapp">
            <header className="iapp-head">
                <div>
                    <h2>Integrasi aplikasi</h2>
                    <p>Aplikasi kantor lain (mis. EBBK) bisa membuat tiket atas nama NIK HRIS dan memantau progresnya lewat API, sama seperti iPop.</p>
                </div>
                <Button variant="primary" onClick={() => setEditing('new')}><Plus aria-hidden="true" />Tambah aplikasi</Button>
            </header>

            <div className="iapp-base">
                <span>Base URL</span><code>{apiBaseUrl()}</code>
            </div>

            {isLoading ? (
                <div className="iapp-empty"><Loader2 className="idesk-spin" aria-label="Memuat" /></div>
            ) : apps.length === 0 ? (
                <div className="iapp-empty">
                    <span className="iapp-empty-ico"><Plug aria-hidden="true" /></span>
                    <b>Belum ada aplikasi terhubung</b>
                    <p>Tambahkan aplikasi, pilih modul & fitur yang boleh dipakai, lalu berikan Client ID dan secret ke developernya.</p>
                    <Button variant="soft" onClick={() => setEditing('new')}><Plus aria-hidden="true" />Tambah aplikasi</Button>
                </div>
            ) : (
                <ul className="iapp-list">
                    {apps.map((app) => (
                        <li key={app.id} className={cn('iapp-card', !app.isActive && 'is-off')}>
                            <div className="iapp-card-top">
                                <span className="iapp-avatar" aria-hidden="true">{app.name.slice(0, 2).toUpperCase()}</span>
                                <div className="iapp-title">
                                    <b>{app.name}</b>
                                    <small><code>{app.clientId}</code> · secret ••••{app.secretHint} · {app.lastUsedAt ? `dipakai ${formatRelativeTime(app.lastUsedAt)}` : 'belum pernah dipakai'}</small>
                                </div>
                                <span className={cn('iapp-status', app.isActive ? 'is-on' : 'is-off')}>{app.isActive ? 'Aktif' : 'Nonaktif'}</span>
                            </div>
                            {app.description && <p className="iapp-desc">{app.description}</p>}
                            <dl className="iapp-facts">
                                <div><dt>Modul</dt><dd>{app.modules.map((m) => <span key={m} className="iapp-tag">{moduleName(m)}</span>)}</dd></div>
                                <div><dt>Fitur</dt><dd>{app.permissions.map((p) => <span key={p} className="iapp-tag is-soft">{PERMISSION_LABEL[p] ?? p}</span>)}</dd></div>
                                <div><dt>Webhook</dt><dd>{app.webhookUrl ? <code className="iapp-url">{app.webhookUrl}</code> : <span className="iapp-muted">Tidak dipakai</span>}</dd></div>
                            </dl>
                            <div className="iapp-actions">
                                <Button variant="subtle" onClick={() => setOpenGuide(openGuide === app.id ? null : app.id)} aria-expanded={openGuide === app.id}>
                                    Panduan cepat<ChevronDown aria-hidden="true" className={cn('iapp-chev', openGuide === app.id && 'is-open')} />
                                </Button>
                                <span className="iapp-spacer" />
                                <Button variant="subtle" onClick={() => setEditing(app)}><Pencil aria-hidden="true" />Ubah</Button>
                                <Button variant="subtle" onClick={() => setConfirm({ kind: 'rotate', app })}><KeyRound aria-hidden="true" />Secret baru</Button>
                                <Button variant="subtle" loading={update.isPending && update.variables?.id === app.id}
                                    onClick={() => update.mutate({ id: app.id, isActive: !app.isActive })}>
                                    <Power aria-hidden="true" />{app.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                </Button>
                                <Button variant="danger" size="icon" onClick={() => setConfirm({ kind: 'delete', app })} aria-label={`Hapus ${app.name}`}>
                                    <Trash2 aria-hidden="true" />
                                </Button>
                            </div>
                            {confirm?.app.id === app.id && (
                                <div className="iapp-confirm" role="alertdialog" aria-label="Konfirmasi">
                                    <span>{confirm.kind === 'rotate'
                                        ? `Buat secret baru? Secret lama langsung tidak berlaku sampai ${app.name} memakai yang baru.`
                                        : `Hapus ${app.name}? Aplikasi tidak bisa memanggil API lagi. Tiket yang sudah dibuat tetap ada.`}</span>
                                    <Button variant="soft" onClick={() => setConfirm(null)}>Batal</Button>
                                    <Button variant="danger-solid" onClick={runConfirm} loading={rotate.isPending || remove.isPending}>
                                        {confirm.kind === 'rotate' ? 'Ya, buat baru' : 'Ya, hapus'}
                                    </Button>
                                </div>
                            )}
                            {openGuide === app.id && <QuickStart app={app} />}
                        </li>
                    ))}
                </ul>
            )}

            <IntegrationAppDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}
                app={editing && editing !== 'new' ? editing : undefined} saving={create.isPending || update.isPending} onSubmit={save} />
            <SecretDialog issued={issued} onClose={() => setIssued(null)} />
        </div>
    );
};

export default IntegrationAppsTab;
