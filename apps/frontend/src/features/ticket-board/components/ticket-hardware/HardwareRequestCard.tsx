import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowUpRight, CalendarCheck, CalendarClock, CheckCircle2, CircleSlash, Cpu, MessageSquareWarning, PackageCheck, ThumbsUp, Wrench, XCircle,
} from 'lucide-react';
import { TICKET_MOVE_TEXT, type LinkedTicketMove } from '../ticket-detail/ActivityEvent';
import { Button } from '@/components/ui/button';
import { TicketPill, type TicketPillTone } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import { formatMessageTime, toDisplayName } from '../ticket-detail/messageThread';
import {
    FLOW_LABEL, requesterTodo, staffTodo, statusSentence, type HardwareTicketPhase, type RequestStatus, type TicketHardwareRequest,
} from './hardwareFlow';
import { HardwareRequesterActions } from './HardwareRequesterActions';
import { HardwareProgress } from './HardwareProgress';
import { useAnswerProposal } from './useTicketHardware';
import './ticket-hardware.css';

export interface HardwarePhaseEvent {
    id: string;
    number: string;
    phase: HardwareTicketPhase;
    at?: string | null;
}

interface HardwareRequestCardProps {
    event: HardwarePhaseEvent;
    actorName?: string | null;
    reason?: string | null;
    createdAt: string;
    /** Live state; undefined while loading or when the viewer cannot read it. */
    request?: TicketHardwareRequest;
    ticketId: string;
    /** The ticket's requester (answers the proposal); staff only follow it. */
    isRequester: boolean;
    hardwareBasePath: string;
    /** What this step did to the ticket (closed it, handed it back), if anything. */
    ticketMove?: LinkedTicketMove;
}

const WIB = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

const PHASE: Record<Exclude<HardwareTicketPhase, 'PROPOSED'>, { icon: React.ElementType; text: string; tone: 'ok' | 'warn' | 'bad' | 'info' }> = {
    SUBMITTED: { icon: ThumbsUp, text: 'disetujui pemohon dan diajukan', tone: 'ok' },
    DECLINED: { icon: CircleSlash, text: 'ditolak pemohon', tone: 'bad' },
    WITHDRAWN: { icon: CircleSlash, text: 'ditarik tim IT', tone: 'info' },
    APPROVED: { icon: CheckCircle2, text: 'disetujui ICT', tone: 'ok' },
    REJECTED: { icon: XCircle, text: 'ditolak ICT', tone: 'bad' },
    PROCUREMENT_DONE: { icon: PackageCheck, text: 'selesai pengadaan', tone: 'ok' },
    SCHEDULE_PROPOSED: { icon: CalendarCheck, text: 'punya usulan jadwal pemasangan, menunggu pemohon', tone: 'warn' },
    RESCHEDULE_REQUESTED: { icon: CalendarClock, text: 'pemohon minta jadwal pemasangan lain', tone: 'warn' },
    SCHEDULED: { icon: CalendarCheck, text: 'dijadwalkan pemasangan', tone: 'info' },
    INSTALLED: { icon: Wrench, text: 'selesai dipasang, menunggu konfirmasi pemohon', tone: 'warn' },
    ISSUE_REPORTED: { icon: MessageSquareWarning, text: 'dilaporkan bermasalah oleh pemohon', tone: 'bad' },
    COMPLETED: { icon: CheckCircle2, text: 'selesai', tone: 'ok' },
    CANCELLED: { icon: XCircle, text: 'dibatalkan', tone: 'bad' },
};

const STATUS_TONE: Partial<Record<RequestStatus, TicketPillTone>> = {
    DRAFT: 'amber', COMPLETED: 'green', CLOSED: 'green', REJECTED: 'red', CANCELLED: 'neutral', AWAITING_USER_CONFIRMATION: 'amber',
};

/** A hardware request message in the ticket chat: the proposal as a live card, later steps as one-line events. */
export const HardwareRequestCard: React.FC<HardwareRequestCardProps> = (props) =>
    props.event.phase === 'PROPOSED' ? <ProposalCard {...props} /> : <PhaseLine {...props} />;

function PhaseLine({ event, actorName, reason, createdAt, hardwareBasePath, ticketMove }: HardwareRequestCardProps) {
    const meta = PHASE[event.phase as Exclude<HardwareTicketPhase, 'PROPOSED'>];
    const Icon = meta.icon;
    return (
        <div className={cn('thw-line', `is-${meta.tone}`)}>
            <span className="thw-line-ico"><Icon aria-hidden="true" /></span>
            <span className="thw-line-text">
                <Link to={`${hardwareBasePath}/${event.id}`}><b>{event.number}</b></Link> {meta.text}{ticketMove && `. ${TICKET_MOVE_TEXT[ticketMove]}`}
                {(event.phase === 'SCHEDULED' || event.phase === 'SCHEDULE_PROPOSED') && event.at && <> · <b>{WIB.format(new Date(event.at))} WIB</b></>}
                {actorName && <span className="thw-line-by"> · {toDisplayName(actorName)}</span>}
                {reason && <span className="thw-line-reason">“{reason}”</span>}
            </span>
            <time dateTime={createdAt}>{formatMessageTime(createdAt)}</time>
        </div>
    );
}

function ProposalCard({ event, actorName, createdAt, request, ticketId, isRequester, hardwareBasePath }: HardwareRequestCardProps) {
    const { accept, decline, withdraw } = useAnswerProposal(ticketId);
    const [confirmDecline, setConfirmDecline] = useState(false);
    const pending = request?.status === 'DRAFT';
    const busy = accept.isPending || decline.isPending || withdraw.isPending;
    const todo = isRequester && request ? requesterTodo(request) : null;
    // Staff see where ICT stands next; the work itself happens on the Hardware Request page.
    const nextForIct = !isRequester && request ? staffTodo(request) : null;
    const href = `${hardwareBasePath}/${event.id}`;

    return (
        <article className="thw-card" aria-label={`Usulan hardware ${event.number}`}>
            <header className="thw-card-head">
                <span className="thw-card-ico"><Cpu aria-hidden="true" /></span>
                <span className="thw-card-title">
                    <b>Usulan hardware</b>
                    <small>{event.number}{request ? ` · ${FLOW_LABEL[request.requestType]}` : ''}</small>
                </span>
            </header>
            {request && <TicketPill tone={STATUS_TONE[request.status] ?? 'navy'} className="thw-card-state">{statusSentence(request)}</TicketPill>}

            {request ? (<>
                <ul className="thw-card-items">
                    {request.items.map((item) => (
                        <li key={item.name}><span>{item.name}</span><b>×{item.quantity}</b></li>
                    ))}
                </ul>
                {request.justification && <p className="thw-card-why">{request.justification}</p>}
                {!pending && <HardwareProgress request={request} />}
                {request.status === 'REJECTED' && request.rejectReason && <p className="thw-card-note">Alasan ICT: {request.rejectReason}</p>}
                {todo && <HardwareRequesterActions request={request} ticketId={ticketId} href={href} />}
            </>) : <p className="thw-card-why">Memuat detail…</p>}

            <footer className="thw-card-foot">
                <span className="thw-card-meta">
                    {actorName ? `Diusulkan ${toDisplayName(actorName)}` : 'Diusulkan tim IT'} · {formatMessageTime(createdAt)}
                </span>
                {pending && isRequester && !confirmDecline && (<>
                    <Button type="button" variant="soft" onClick={() => setConfirmDecline(true)} disabled={busy}>Tolak</Button>
                    <Button type="button" variant="primary" onClick={() => accept.mutate(event.id)} loading={accept.isPending} disabled={busy}>
                        Setujui &amp; ajukan
                    </Button>
                </>)}
                {pending && isRequester && confirmDecline && (<>
                    <span className="thw-card-ask">Tolak usulan ini?</span>
                    <Button type="button" variant="soft" onClick={() => setConfirmDecline(false)} disabled={busy}>Batal</Button>
                    <Button type="button" variant="danger" onClick={() => decline.mutate(event.id)} loading={decline.isPending} disabled={busy}>
                        Ya, tolak
                    </Button>
                </>)}
                {pending && !isRequester && !confirmDecline && (
                    <Button type="button" variant="subtle" onClick={() => setConfirmDecline(true)}>Tarik usulan</Button>
                )}
                {pending && !isRequester && confirmDecline && (<>
                    <span className="thw-card-ask">Tarik usulan ini?</span>
                    <Button type="button" variant="soft" onClick={() => setConfirmDecline(false)} disabled={busy}>Batal</Button>
                    <Button type="button" variant="danger" onClick={() => withdraw.mutate(event.id)} loading={withdraw.isPending} disabled={busy}>
                        Ya, tarik
                    </Button>
                </>)}
                {!pending && request && (
                    <Button asChild variant={nextForIct ? 'primary' : 'soft'}>
                        <Link to={href}>{nextForIct ?? 'Lihat detail'}<ArrowUpRight aria-hidden="true" /></Link>
                    </Button>
                )}
            </footer>
        </article>
    );
}
