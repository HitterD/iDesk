import { useState } from 'react';
import { ManagerSelector } from '@/features/request-center/components/eform/ManagerSelector';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { CatalogBasket } from '@/features/ticket-board/components/request-flow/picker/CatalogBasket';
import { RecipientInput } from '@/features/ticket-board/components/request-flow/picker/RecipientInput';
import type { BasketLine, CatalogEntry } from '@/features/ticket-board/components/request-flow/picker/basket';
import { hardwareMissing, toHardwarePayload, type HardwareForm } from './hardwareRules';
import { draftKey, useRequestDraft } from './useRequestDraft';

interface HardwareRequestFormProps {
    userId: string;
    userName: string;
    userDepartment: string;
    catalog: CatalogEntry[];
    onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
    onCancel: () => void;
}

/** The Hardware request form: pick items, say who they are for and why, sign, send. */
export function HardwareRequestForm({ userId, userName, userDepartment, catalog, onSubmit, onCancel }: HardwareRequestFormProps) {
    const initial: HardwareForm = { title: '', justification: '', division: userDepartment, recipients: userName.trim() ? [userName.trim()] : [], managerId: '', lines: [], signature: null };
    const [form, setForm, clearDraft] = useRequestDraft<HardwareForm>(draftKey(userId, 'hardware'), initial);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const patch = (change: Partial<HardwareForm>) => { setError(''); setForm({ ...form, ...change }); };
    const several = form.recipients.length > 1;

    const submit = async () => {
        const missing = hardwareMissing(form);
        if (missing) { setError(missing); return; }
        setBusy(true);
        try {
            await onSubmit(toHardwarePayload(form));
            clearDraft();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal mengirim permintaan. Coba lagi.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="req-form">
            <section className="req-fsec"><h3><span>1</span>Barang apa yang dibutuhkan?</h3>
                <CatalogBasket catalog={catalog} lines={form.lines} onChange={(lines: BasketLine[]) => patch({ lines })} />
            </section>

            <section className="req-fsec"><h3><span>2</span>Untuk siapa?</h3>
                <RecipientInput value={form.recipients} onChange={(recipients) => patch({ recipients })} />
                {several && (
                    <div className="req-forwho">
                        <small>Ada lebih dari satu penerima: tentukan tiap barang untuk siapa.</small>
                        {form.lines.map((line, index) => (
                            <label key={`${line.name}-${index}`} className="req-dialog__field">
                                <span>{line.name}</span>
                                <select
                                    aria-label={`Untuk siapa ${line.name}`} value={line.recipient ?? ''}
                                    onChange={(event) => patch({ lines: form.lines.map((l, i) => (i === index ? { ...l, recipient: event.target.value } : l)) })}
                                >
                                    <option value="">Pilih penerima</option>
                                    {form.recipients.map((name) => <option key={name}>{name}</option>)}
                                </select>
                            </label>
                        ))}
                    </div>
                )}
                <label className="req-dialog__field"><span>Divisi penerima *</span><input aria-label="Divisi penerima" value={form.division} onChange={(event) => patch({ division: event.target.value })} /></label>
            </section>

            <section className="req-fsec"><h3><span>3</span>Untuk keperluan apa?</h3>
                <textarea aria-label="Alasan permintaan" placeholder="Jelaskan singkat kenapa barang ini dibutuhkan" value={form.justification} onChange={(event) => patch({ justification: event.target.value })} />
                <ManagerSelector idPrefix="hardware-manager" label="Atasan Anda" currentUserId={userId} selectedId={form.managerId} required={false} onSelect={(managerId) => patch({ managerId })} />
                <small>Hanya diminta tanda tangan bila IT memerlukannya.</small>
            </section>

            <section className="req-fsec"><h3><span>4</span>Tanda tangan</h3>
                <SignaturePad signerName={userName} onSave={(signature) => patch({ signature })} />
            </section>

            <p className="req-note">IT meninjau permintaan, menentukan sumber barang dan siapa yang perlu menyetujui. Dokumen dibuat otomatis dari isian ini.</p>
            {error && <p role="alert" className="req-dialog__error">{error}</p>}
            <div className="req-ffoot">
                <span>Isian tersimpan otomatis</span>
                <button type="button" className="req-btn" onClick={() => { clearDraft(); onCancel(); }}>Batal</button>
                <button type="button" className="req-btn req-btn--primary req-btn--hwb" disabled={busy} onClick={() => void submit()}>{busy ? 'Mengirim…' : 'Kirim permintaan'}</button>
            </div>
        </div>
    );
}
