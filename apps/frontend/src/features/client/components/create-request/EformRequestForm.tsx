import { useState } from 'react';
import { ManagerSelector } from '@/features/request-center/components/eform/ManagerSelector';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { PeriodPicker } from './PeriodPicker';
import { TermsGate } from './TermsGate';
import { EformTypeFields } from './EformTypeFields';
import { draftKey, useRequestDraft } from './useRequestDraft';
import { efMissing, emptyEform, toEformPayload, type EformForm, type EformKind } from './eformRules';

export const EFORM_KINDS: Array<{ group: string; kinds: Array<{ kind: EformKind; label: string }> }> = [
    { group: 'Konektivitas & perangkat', kinds: [{ kind: 'VPN', label: 'VPN' }, { kind: 'WEBSITE', label: 'Website' }, { kind: 'NETWORK', label: 'Network' }, { kind: 'FLASHDISK', label: 'Flashdisk' }] },
    { group: 'Akun & penyimpanan', kinds: [{ kind: 'EMAIL', label: 'Email' }, { kind: 'SYNOLOGY_NAS', label: 'Synology NAS' }] },
];
const LABEL: Record<EformKind, string> = { VPN: 'VPN', WEBSITE: 'Website', NETWORK: 'Network', FLASHDISK: 'Flashdisk', EMAIL: 'Email', SYNOLOGY_NAS: 'Synology NAS' };
const REASONS: Partial<Record<EformKind, string[]>> = {
    VPN: ['Bekerja dari rumah', 'Dinas luar kota', 'Akses sistem kantor dari luar'],
    WEBSITE: ['Riset pekerjaan', 'Akses portal pemasok'],
    FLASHDISK: ['Pindah data laporan', 'Backup data kerja'],
};

export interface RenewSource { kind: EformKind; to: string; need?: string; reason?: string }

interface EformRequestFormProps {
    userId: string;
    userName: string;
    userDepartment: string;
    /** Today as YYYY-MM-DD (WIB): the default start. */
    today: string;
    /** Set when renewing an access: the form starts from the old one, the new period starts where the old one ends. */
    renew?: RenewSource;
    onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
    onCancel: () => void;
}

/** The E-Form request form: one numbered path (kind, details, period, purpose, terms and signature). */
export function EformRequestForm({ userId, userName, userDepartment, today, renew, onSubmit, onCancel }: EformRequestFormProps) {
    const start = renew?.to || today;
    const initial: EformForm = {
        ...emptyEform(renew?.kind ?? 'VPN', start), dept: userDepartment,
        ...(renew ? { need: renew.need ?? '', reason: renew.reason ?? '' } : {}),
    };
    const [form, setForm, clearDraft] = useRequestDraft<EformForm>(draftKey(userId, 'eform'), initial);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const patch = (change: Partial<EformForm>) => { setError(''); setForm({ ...form, ...change }); };

    const chooseKind = (kind: EformKind) => patch({ ...emptyEform(kind, form.from), dept: form.dept, reason: form.reason, terms: false, signature: form.signature, managerId: form.managerId });
    const submit = async () => {
        const missing = efMissing(form);
        if (missing) { setError(missing); return; }
        setBusy(true);
        try {
            await onSubmit(toEformPayload(form, userName));
            clearDraft();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal mengirim permintaan. Coba lagi.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="req-form">
            {renew && <div className="req-banner">Mode perpanjangan — isian disalin dari akses sebelumnya. Periksa tanggal lalu kirim.</div>}

            <section className="req-fsec"><h3><span>1</span>Akses apa yang dibutuhkan?</h3>
                {EFORM_KINDS.map(({ group, kinds }) => (
                    <div key={group}><small>{group}</small>
                        <div className="req-kindgrid">
                            {kinds.map(({ kind, label }) => (
                                <button key={kind} type="button" className={form.kind === kind ? 'is-on' : ''} aria-pressed={form.kind === kind} onClick={() => chooseKind(kind)}>{label}</button>
                            ))}
                        </div>
                    </div>
                ))}
            </section>

            <section className="req-fsec"><h3><span>2</span>Detail akses {LABEL[form.kind]}</h3>
                <EformTypeFields form={form} patch={patch} />
            </section>

            <section className="req-fsec"><h3><span>3</span>Berapa lama?</h3>
                <small>{['VPN', 'NETWORK', 'FLASHDISK'].includes(form.kind) ? 'Maksimal 12 bulan. Bisa diperpanjang nanti.' : 'Boleh permanen.'}</small>
                <PeriodPicker kind={form.kind} from={form.from} to={form.to} onChange={({ from, to }) => patch({ from, to })} />
            </section>

            <section className="req-fsec"><h3><span>4</span>Untuk keperluan apa?</h3>
                <div className="req-period__chips">
                    {(REASONS[form.kind] ?? []).map((reason) => <button key={reason} type="button" onClick={() => patch({ reason })}>{reason}</button>)}
                </div>
                <textarea aria-label="Keperluan" placeholder="Jelaskan singkat" value={form.reason} onChange={(event) => patch({ reason: event.target.value })} />
                <div className="req-period__dates">
                    <label className="req-dialog__field"><span>Departemen *</span><input aria-label="Departemen" value={form.dept} onChange={(event) => patch({ dept: event.target.value })} /></label>
                    <div><ManagerSelector idPrefix="eform-manager" label="Atasan Anda" currentUserId={userId} selectedId={form.managerId} required={false} onSelect={(managerId) => patch({ managerId })} />
                        <small>Hanya diminta tanda tangan bila IT memerlukannya.</small></div>
                </div>
            </section>

            <section className="req-fsec"><h3><span>5</span>Syarat & tanda tangan</h3>
                <TermsGate kindLabel={LABEL[form.kind]} accepted={form.terms} onAccept={(terms) => patch({ terms })} />
                <SignaturePad signerName={userName} onSave={(signature) => patch({ signature })} />
            </section>

            <p className="req-note">IT meninjau lalu menentukan perlu tanda tangan atasan / GM atau tidak. Dokumen dibuat otomatis dari isian ini.</p>
            {error && <p role="alert" className="req-dialog__error">{error}</p>}
            <div className="req-ffoot">
                <span>Isian tersimpan otomatis</span>
                <button type="button" className="req-btn" onClick={() => { clearDraft(); onCancel(); }}>Batal</button>
                <button type="button" className="req-btn req-btn--primary req-btn--efb" disabled={busy} onClick={() => void submit()}>{busy ? 'Mengirim…' : 'Kirim permintaan'}</button>
            </div>
        </div>
    );
}
