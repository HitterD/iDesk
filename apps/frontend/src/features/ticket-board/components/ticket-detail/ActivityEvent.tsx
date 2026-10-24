import React from 'react';
import { ArrowRight } from 'lucide-react';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/constants/ticket.constants';
import { TicketPill, type TicketPillTone } from '@/components/ui/ticket-pill';
import { formatMessageTime, toDisplayName } from './messageThread';
import type { HardwareTicketPhase } from '../ticket-hardware/hardwareFlow';
import type { EFormTicketPhase } from '../ticket-eform/eformFlow';

/** Mirrors the backend's TicketSystemEvent (utils/ticket-activity.util.ts). */
export interface TicketSystemEvent {
    v: 1;
    actor: { id: string; name: string } | null;
    changes: { field: 'status' | 'assignee' | 'priority' | 'category' | 'vendorVisit'; from: string | null; to: string | null }[];
    reason?: string | null;
    /** A step of a hardware request proposed from this ticket (rendered by ticket-hardware, not here). */
    hardwareRequest?: { id: string; number: string; phase: HardwareTicketPhase; at?: string | null };
    /** A step of an e-form access request proposed from this ticket (rendered by ticket-eform, not here). */
    eformRequest?: { id: string; code: string; formType: string; phase: EFormTicketPhase };
}

type Change = TicketSystemEvent['changes'][number];

const FIELD_LABEL: Record<Change['field'], string> = {
    status: 'Status',
    assignee: 'PIC',
    priority: 'Prioritas',
    category: 'Kategori',
    vendorVisit: 'Janji vendor',
};

const STATUS_LABEL: Record<string, string> = {
    TODO: 'Open', IN_PROGRESS: 'In Progress', WAITING_VENDOR: 'Waiting Vendor',
    RESOLVED: 'Resolved', CLOSED: 'Closed', CANCELLED: 'Dibatalkan',
};
const STATUS_TONE: Record<string, TicketPillTone> = {
    TODO: 'blue', IN_PROGRESS: 'navy', WAITING_VENDOR: 'amber', RESOLVED: 'green', CLOSED: 'neutral', CANCELLED: 'red',
};

const WIB_VISIT = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function valueLabel(field: Change['field'], value: string): string {
    switch (field) {
        case 'status': return STATUS_LABEL[value] ?? (STATUS_CONFIG as Record<string, { label?: string }>)[value]?.label ?? value;
        case 'priority': return (PRIORITY_CONFIG as Record<string, { shortLabel?: string }>)[value]?.shortLabel ?? value;
        case 'assignee': return toDisplayName(value);
        case 'vendorVisit': return `${WIB_VISIT.format(new Date(value))} WIB`;
        default: return value;
    }
}

function ChangeValue({ field, value, emphasis }: { field: Change['field']; value: string | null; emphasis?: boolean }) {
    if (!value) return <span className="act-empty">{field === 'assignee' ? 'Tanpa PIC' : '—'}</span>;
    const label = valueLabel(field, value);
    if (field === 'status') return <TicketPill tone={STATUS_TONE[value] ?? 'neutral'} className="act-pill">{label}</TicketPill>;
    return emphasis ? <b>{label}</b> : <span>{label}</span>;
}

function ChangeRow({ change }: { change: Change }) {
    return (
        <li>
            <span className="act-field">{FIELD_LABEL[change.field]}</span>
            {change.from !== null && change.to !== null ? (<>
                <span className="act-from"><ChangeValue field={change.field} value={change.from} /></span>
                <ArrowRight className="act-arrow" aria-label="menjadi" />
                <ChangeValue field={change.field} value={change.to} emphasis />
            </>) : change.to !== null ? (
                <ChangeValue field={change.field} value={change.to} emphasis />
            ) : (
                <span className="act-from"><ChangeValue field={change.field} value={change.from} /> <span className="act-empty">dilepas</span></span>
            )}
        </li>
    );
}

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Requesters see what happened to their ticket, not who on the team did it or why. */
const REQUESTER_FIELDS: ReadonlySet<Change['field']> = new Set(['status', 'assignee', 'vendorVisit']);

/**
 * One activity entry in the conversation: who acted, then each change as "field: old -> new",
 * then the reason they gave. Built from structured data, never from the message text.
 */
export const ActivityEvent: React.FC<{ event: TicketSystemEvent; createdAt: string; audience: 'staff' | 'requester' }> = ({ event, createdAt, audience }) => {
    const isRequester = audience === 'requester';
    const changes = isRequester ? event.changes.filter((c) => REQUESTER_FIELDS.has(c.field)) : event.changes;
    if (changes.length === 0) return null;
    const actor = event.actor ? toDisplayName(event.actor.name) : 'Sistem';
    return (
        <div className="act-event" role="group" aria-label={`Aktivitas oleh ${isRequester ? 'tim IT' : actor}`}>
            <div className="act-head">
                {!isRequester && <span className="act-avatar" aria-hidden="true">{event.actor ? initialsOf(actor) : 'iD'}</span>}
                <span><b>{isRequester ? 'Tim IT' : actor}</b> {changes.length === 1 ? 'mengubah' : 'memperbarui'} tiket</span>
                <time dateTime={createdAt}>{formatMessageTime(createdAt)}</time>
            </div>
            <ul className="act-changes">
                {changes.map((change) => <ChangeRow key={change.field} change={change} />)}
            </ul>
            {event.reason && !isRequester && <p className="act-reason">“{event.reason}”</p>}
        </div>
    );
};
