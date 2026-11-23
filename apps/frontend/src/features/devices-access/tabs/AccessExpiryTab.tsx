import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';
import { useAccessActions, useAccessView, type AccessGroup, type AccessItem } from '../api';

const KPIS: Array<{ group: AccessGroup; label: string }> = [
    { group: 'soon', label: 'Segera berakhir (≤7 hari)' },
    { group: 'expired', label: 'Kedaluwarsa — cabut akses' },
    { group: 'active', label: 'Aktif' },
    { group: 'permanent', label: 'Permanen' },
];
const KIND_LABEL: Record<string, string> = { VPN: 'VPN', WEBSITE: 'Website', NETWORK: 'Network', FLASHDISK: 'Flashdisk', EMAIL: 'Email', SYNOLOGY_NAS: 'Synology NAS' };
const day = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const show = (value: string): string => day.format(new Date(`${value}T00:00:00Z`));

function status(item: AccessItem): string {
    if (item.daysLeft === null) return 'Permanen';
    if (item.daysLeft < 0) return `Lewat ${Math.abs(item.daysLeft)} hari`;
    return item.daysLeft === 0 ? 'Berakhir hari ini' : `Sisa ${item.daysLeft} hari`;
}

/** "Masa Berlaku Akses": who has which access and when it ends; remind those ending soon, revoke the expired. */
export function AccessExpiryTab() {
    const [group, setGroup] = useState<AccessGroup>('soon');
    const { data, isLoading, isError } = useAccessView(group);
    const { remind, revoke } = useAccessActions();

    const doRemind = (item: AccessItem) => remind.mutateAsync(item.eformId)
        .then(() => toast.success(`Pengingat dikirim ke ${item.requesterName}`))
        .catch((err) => toast.error(getApiErrorMessage(err, 'Gagal mengirim pengingat')));
    const doRevoke = (item: AccessItem) => revoke.mutateAsync(item.eformId)
        .then(() => toast.success('Tiket pencabutan akses dibuat untuk IT'))
        .catch((err) => toast.error(getApiErrorMessage(err, 'Gagal membuat tiket pencabutan')));

    return (
        <div className="da-access">
            <div className="da-kpis">
                {KPIS.map(({ group: g, label }) => (
                    <button key={g} type="button" className={`da-kpi ${group === g ? 'is-on' : ''}`} aria-pressed={group === g} onClick={() => setGroup(g)}>
                        <span className="da-kpi__v">{data?.counts[g] ?? 0}</span><span>{label}</span>
                    </button>
                ))}
            </div>
            {isLoading && <p aria-busy="true">Memuat…</p>}
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat daftar akses.</p>}
            {data && data.items.length === 0 && <p className="req-basket__empty">Tidak ada akses di kelompok ini.</p>}
            <ul className="da-rows">
                {(data?.items ?? []).map((item) => (
                    <li key={item.eformId} className="da-row">
                        <div><b>{item.requesterName}</b><small>{item.department}</small></div>
                        <span className="tag-ef">{KIND_LABEL[item.kind] ?? item.kind}</span>
                        <div><b>{status(item)}</b><small>{item.endDate ? `s/d ${show(item.endDate)}` : 'tanpa batas'}</small></div>
                        <div className="da-row__acts">
                            {item.group === 'expired' && <button type="button" className="req-btn req-btn--danger" onClick={() => void doRevoke(item)}>Cabut akses</button>}
                            {item.group === 'soon' && <button type="button" className="req-btn" onClick={() => void doRemind(item)}>Ingatkan</button>}
                            <Link className="req-btn req-btn--ghost" to={`/tickets/${item.ticketId}`}>Tiket</Link>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
