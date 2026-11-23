import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Bell, CheckCircle2, Hourglass, KeyRound, XCircle } from 'lucide-react';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';
import { useAccessActions, useAccessView, type AccessGroup, type AccessItem } from '../api';
import { Kpi, type KpiTone } from '../Kpi';

const KPIS: Array<{ group: AccessGroup; label: string; icon: typeof Hourglass; tone: KpiTone }> = [
    { group: 'soon', label: 'Segera berakhir (≤7 hari)', icon: Hourglass, tone: 'amber' },
    { group: 'expired', label: 'Kedaluwarsa — cabut akses', icon: AlertTriangle, tone: 'red' },
    { group: 'active', label: 'Aktif', icon: CheckCircle2, tone: 'green' },
    { group: 'permanent', label: 'Permanen', icon: KeyRound, tone: 'neutral' },
];
const KIND_LABEL: Record<string, string> = { VPN: 'VPN', WEBSITE: 'Website', NETWORK: 'Network', FLASHDISK: 'Flashdisk', EMAIL: 'Email', SYNOLOGY_NAS: 'Synology NAS' };
const DAY_MS = 86_400_000;
/** The timeline shows 3 months back and 6 months ahead of today, like the mockup. */
const MONTHS_BACK = 3;
const MONTHS_SHOWN = 9;
const day = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const monthName = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'short' });
const show = (value: string): string => day.format(new Date(`${value}T00:00:00Z`));

function status(item: AccessItem): string {
    if (item.daysLeft === null) return 'Permanen';
    if (item.daysLeft < 0) return `Lewat ${Math.abs(item.daysLeft)} hari`;
    return item.daysLeft === 0 ? 'Berakhir hari ini' : `Sisa ${item.daysLeft} hari`;
}

/** The window of the timeline: first day of the month MONTHS_BACK ago, MONTHS_SHOWN months long. */
function timeline(today: string) {
    const now = new Date(`${today}T00:00:00Z`);
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MONTHS_BACK, 1);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MONTHS_BACK + MONTHS_SHOWN, 1);
    const pos = (iso: string | null, fallback: number): number => {
        if (!iso) return fallback;
        return Math.max(0, Math.min(100, ((Date.parse(`${iso}T00:00:00Z`) - start) / (end - start)) * 100));
    };
    const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => monthName.format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MONTHS_BACK + i, 1))));
    return { pos, months, today: pos(today, 0) };
}

const wibToday = (): string => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** "Masa Berlaku Akses" (mockup ticket-unify `centerAccess`): KPI filters, and each access on a timeline with today marked. */
export function AccessExpiryTab({ today = wibToday() }: { today?: string }) {
    const [group, setGroup] = useState<AccessGroup>('soon');
    const { data, isLoading, isError } = useAccessView(group);
    const { remind, revoke } = useAccessActions();
    const tl = timeline(today);

    const doRemind = (item: AccessItem) => remind.mutateAsync(item.eformId)
        .then(() => toast.success(`Pengingat dikirim ke ${item.requesterName}`))
        .catch((err) => toast.error(getApiErrorMessage(err, 'Gagal mengirim pengingat')));
    const doRevoke = (item: AccessItem) => revoke.mutateAsync(item.eformId)
        .then(() => toast.success('Tiket pencabutan akses dibuat untuk IT'))
        .catch((err) => toast.error(getApiErrorMessage(err, 'Gagal membuat tiket pencabutan')));

    return (
        <div className="da-access">
            <div className="da-kpis">
                {KPIS.map(({ group: g, label, icon, tone }) => (
                    <Kpi key={g} icon={icon} tone={tone} label={label} value={data?.counts[g] ?? 0} active={group === g} onClick={() => setGroup(g)} />
                ))}
            </div>
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat daftar akses.</p>}
            <section className="da-card">
                <div className="da-tl-head" aria-hidden="true">
                    <span>Pemohon</span><span>Akses</span>
                    <span className="da-tl-scale">{tl.months.map((m, i) => <i key={`${m}-${i}`}>{m}</i>)}</span>
                    <span>Status</span><span />
                </div>
                {isLoading && <p aria-busy="true" className="da-muted da-cpad">Memuat…</p>}
                {data && data.items.length === 0 && <p className="da-empty">Tidak ada akses di kelompok ini.</p>}
                <ul className="da-tl-rows">
                    {(data?.items ?? []).map((item) => {
                        const from = tl.pos(item.startDate, 0);
                        const to = tl.pos(item.endDate, 100);
                        return (
                            <li key={item.eformId} className="da-tl-row">
                                <div className="da-tl-who"><b>{item.requesterName}</b><small>{item.department}</small></div>
                                <div><span className="da-tag-ef">{KIND_LABEL[item.kind] ?? item.kind}</span></div>
                                <div className="da-tl-bar" aria-label={`Masa berlaku ${item.startDate ? show(item.startDate) : '-'} sampai ${item.endDate ? show(item.endDate) : 'tanpa batas'}`}>
                                    <span className="da-tl-today" style={{ left: `${tl.today}%` }} />
                                    <span className={`da-tl-fill is-${item.group}`} style={{ left: `${from}%`, width: `${Math.max(1, to - from)}%` }} />
                                </div>
                                <div className="da-tl-status"><b className={`is-${item.group}`}>{status(item)}</b><small>{item.endDate ? `s/d ${show(item.endDate)}` : 'tanpa batas'}</small></div>
                                <div className="da-tl-act">
                                    {item.group === 'expired' && <button type="button" className="req-btn req-btn--danger" onClick={() => void doRevoke(item)}><XCircle aria-hidden="true" />Cabut akses</button>}
                                    {item.group === 'soon' && <button type="button" className="req-btn" onClick={() => void doRemind(item)}><Bell aria-hidden="true" />Ingatkan</button>}
                                    <Link className="req-btn req-btn--ghost" to={`/tickets/${item.ticketId}`}>Tiket</Link>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
