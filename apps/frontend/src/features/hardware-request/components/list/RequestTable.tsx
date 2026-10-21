import { Fragment, useState, type ReactNode } from 'react';
import { Hourglass } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { isTerminal } from '../../utils/status.util';
import { daysSince, agingTone } from '../../utils/aging.util';
import { RequestRowDrawer } from './RequestRowDrawer';
import { DashAvatar } from '@/features/dashboard/components/DashboardParts';
import { ResBub, ResTable, rowActivation } from '@/components/resources/ResourceParts';
import type { HardwareRequest } from '../../types';
import { cn } from '@/lib/utils';

/** Mockup hardware.html COLS: Nomor · Requester · Items · Site · Status · Umur · Updated. */
const COLS = 'minmax(170px,1.2fr) minmax(170px,1.1fr) minmax(200px,1.6fr) 56px 170px 78px 74px';
const UPDATED_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

const itemsSummary = (r: HardwareRequest) =>
    (r.items ?? []).map((i) => `${i.categorySnapshot?.name ?? i.name ?? 'Item'} · ${i.quantity} unit`).join(', ') || '—';

function AgeCell({ r }: { r: HardwareRequest }) {
    if (isTerminal(r.status)) return <span className="res-muted">—</span>;
    const days = daysSince(r.updatedAt);
    const tone = agingTone(days);
    const label = `${days} hari`;
    if (tone === 'none') return <span className="res-muted">{label}</span>;
    const red = tone === 'red';
    return <ResBub icon={Hourglass} color={red ? 'var(--dash-red)' : 'var(--dash-orange)'} ink={red ? 'var(--dash-ink-red)' : 'var(--dash-ink-orange)'}>{label}</ResBub>;
}

export function RequestTable({ rows, foot }: { rows: HardwareRequest[]; foot?: ReactNode }) {
    const [openId, setOpenId] = useState<string | null>(null);

    return (
        <ResTable label="Daftar hardware request" cols={COLS}
            head={<><span>Nomor</span><span>Requester</span><span>Items</span><span>Site</span><span>Status</span><span>Umur</span><span className="is-right">Updated</span></>}
            foot={foot}>
            {rows.map((r) => {
                const isOpen = openId === r.id;
                const name = r.requester?.fullName ?? '—';
                const sub = r.recipient?.fullName && r.recipient.id !== r.requesterId ? `Untuk ${r.recipient.fullName}` : r.requester?.email;
                return (
                    <Fragment key={r.id}>
                        <div className={cn('res-row is-link', isOpen && 'is-open')} aria-expanded={isOpen}
                            aria-label={`${r.requestNumber}: ${r.justification}`}
                            {...rowActivation(() => setOpenId(isOpen ? null : r.id))}>
                            <div className="res-tk">
                                <span className="res-tk-id">{r.requestNumber}</span>
                                <span className="res-tk-title" title={r.justification}>{r.justification || '—'}</span>
                            </div>
                            <div className="queue-person res-hide-m">
                                <DashAvatar name={name} />
                                <div className="min-w-0"><b>{name}</b>{sub && <small>{sub}</small>}</div>
                            </div>
                            <span className="res-cell res-hide-m" title={itemsSummary(r)}>{itemsSummary(r)}</span>
                            <span className="res-hide-m">{r.site?.name ? <ResBub color="var(--dash-gray)" mono plain>{r.site.name}</ResBub> : <span className="res-muted">—</span>}</span>
                            <span><StatusBadge status={r.status} /></span>
                            <span className="res-hide-m"><AgeCell r={r} /></span>
                            <span className="res-date res-hide-m">{new Date(r.updatedAt).toLocaleDateString('id-ID', UPDATED_FMT)}</span>
                            {isOpen && (
                                <div className="res-row-detail" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                                    <RequestRowDrawer r={r} />
                                </div>
                            )}
                        </div>
                    </Fragment>
                );
            })}
        </ResTable>
    );
}
