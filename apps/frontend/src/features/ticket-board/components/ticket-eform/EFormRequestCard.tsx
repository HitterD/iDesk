import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, CheckCircle2, CircleSlash, FileSignature, KeyRound, ThumbsUp, UserCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TicketPill, type TicketPillTone } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import { getTypeConfig } from '@/features/request-center/components/eform/eform-vocabulary';
import { formatMessageTime, toDisplayName } from '../ticket-detail/messageThread';
import { currentStep, flowSteps, isStopped, staffTodo, statusSentence, type EFormStatus, type EFormTicketPhase, type TicketEFormRequest } from './eformFlow';
import { useCancelEFormProposal } from './useTicketEForm';
import '../ticket-hardware/ticket-hardware.css';
import './ticket-eform.css';

export interface EFormPhaseEvent {
    id: string;
    code: string;
    formType: string;
    phase: EFormTicketPhase;
}

interface EFormRequestCardProps {
    event: EFormPhaseEvent;
    actorName?: string | null;
    reason?: string | null;
    createdAt: string;
    /** Live state; undefined while loading or when the viewer cannot read it. */
    request?: TicketEFormRequest;
    ticketId: string;
    /** The ticket's requester (signs the proposal); staff only follow it. */
    isRequester: boolean;
    /** E-form pages of the viewer's portal, e.g. /client/eform-access. */
    eformBasePath: string;
}

const PHASE: Record<Exclude<EFormTicketPhase, 'PROPOSED'>, { icon: React.ElementType; text: string; tone: 'ok' | 'warn' | 'bad' | 'info' }> = {
    SUBMITTED: { icon: ThumbsUp, text: 'ditandatangani dan diajukan pemohon', tone: 'ok' },
    DECLINED: { icon: CircleSlash, text: 'ditolak pemohon', tone: 'bad' },
    WITHDRAWN: { icon: CircleSlash, text: 'ditarik tim IT', tone: 'info' },
    MANAGER_APPROVED: { icon: UserCheck, text: 'disetujui atasan, diteruskan ke ICT', tone: 'ok' },
    GRANTED: { icon: KeyRound, text: 'aktif. Tiket ditutup otomatis', tone: 'ok' },
    REJECTED: { icon: XCircle, text: 'ditolak', tone: 'bad' },
};

const STATUS_TONE: Partial<Record<EFormStatus, TicketPillTone>> = {
    DRAFT: 'amber', PENDING_MANAGER: 'amber', CONFIRMED: 'green', REJECTED: 'red', CANCELLED: 'neutral',
};

/** An e-form access message in the ticket chat: the proposal as a live card, later steps as one-line events. */
export const EFormRequestCard: React.FC<EFormRequestCardProps> = (props) =>
    props.event.phase === 'PROPOSED' ? <ProposalCard {...props} /> : <PhaseLine {...props} />;

function PhaseLine({ event, actorName, reason, createdAt, eformBasePath }: EFormRequestCardProps) {
    const meta = PHASE[event.phase as Exclude<EFormTicketPhase, 'PROPOSED'>];
    const Icon = meta.icon;
    return (
        <div className={cn('thw-line', `is-${meta.tone}`)}>
            <span className="thw-line-ico"><Icon aria-hidden="true" /></span>
            <span className="thw-line-text">
                <Link to={`${eformBasePath}/${event.id}`}><b>{getTypeConfig(event.formType).label} {event.code}</b></Link> {meta.text}
                {actorName && <span className="thw-line-by"> · {toDisplayName(actorName)}</span>}
                {reason && <span className="thw-line-reason">“{reason}”</span>}
            </span>
            <time dateTime={createdAt}>{formatMessageTime(createdAt)}</time>
        </div>
    );
}

/** Compact step bar, same look as the hardware request's. */
export const EFormProgress: React.FC<{ request: Pick<TicketEFormRequest, 'formType' | 'status'> }> = ({ request }) => {
    const steps = flowSteps(request.formType);
    const current = currentStep(request.formType, request.status);
    const done = request.status === 'CONFIRMED';
    return (
        <ol className={cn('thw-steps', isStopped(request.status) && 'is-stopped')} aria-label="Progres akses E-Form">
            {steps.map((step, index) => {
                const state = done || index < current ? 'done' : index === current ? 'current' : 'todo';
                return (
                    <li key={step.label} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                        <span className="thw-dot">{state === 'done' && <Check aria-hidden="true" />}</span>
                        <span className="thw-step-label">{step.label}</span>
                    </li>
                );
            })}
        </ol>
    );
};

function ProposalCard({ event, actorName, createdAt, request, ticketId, isRequester, eformBasePath }: EFormRequestCardProps) {
    const cancel = useCancelEFormProposal(ticketId, isRequester);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const type = getTypeConfig(request?.formType ?? event.formType);
    const TypeIcon = type.icon;
    const pending = request?.status === 'DRAFT';
    const nextForIct = !isRequester && request ? staffTodo(request) : null;
    // The requester signs on the e-form page, prefilled from this proposal, and comes back to the ticket.
    const signHref = `${eformBasePath}/new?proposal=${event.id}&ticket=${ticketId}`;
    // The detail page offers ICT the right action per access type (credentials, or fulfil for existing accounts).
    const detailHref = `${eformBasePath}/${event.id}`;

    return (
        <article className="thw-card" aria-label={`Usulan ${type.label} ${event.code}`}>
            <header className="thw-card-head">
                <span className="thw-card-ico is-eform"><TypeIcon aria-hidden="true" /></span>
                <span className="thw-card-title">
                    <b>Usulan {type.label}</b>
                    <small>E-Form {event.code}</small>
                </span>
            </header>
            {request && <TicketPill tone={STATUS_TONE[request.status] ?? 'navy'} className="thw-card-state">{statusSentence(request)}</TicketPill>}

            {request ? (<>
                {request.note && <p className="thw-card-why">{request.note}</p>}
                {!pending && <EFormProgress request={request} />}
                {request.status === 'REJECTED' && request.rejectionReason && <p className="thw-card-note">Alasan: {request.rejectionReason}</p>}
                {pending && isRequester && (
                    <p className="thw-ask-q"><FileSignature aria-hidden="true" />Lengkapi data, pilih atasan penyetuju lalu tanda tangan. Sebagian sudah diisi tim IT.</p>
                )}
            </>) : <p className="thw-card-why">Memuat detail…</p>}

            <footer className="thw-card-foot">
                <span className="thw-card-meta">
                    {actorName ? `Diusulkan ${toDisplayName(actorName)}` : 'Diusulkan tim IT'} · {formatMessageTime(createdAt)}
                </span>
                {pending && !confirmCancel && (isRequester ? (<>
                    <Button type="button" variant="soft" onClick={() => setConfirmCancel(true)}>Tolak</Button>
                    <Button asChild variant="primary">
                        <Link to={signHref}><FileSignature aria-hidden="true" />Lengkapi &amp; tanda tangani</Link>
                    </Button>
                </>) : (
                    <Button type="button" variant="subtle" onClick={() => setConfirmCancel(true)}>Tarik usulan</Button>
                ))}
                {pending && confirmCancel && (<>
                    <span className="thw-card-ask">{isRequester ? 'Tolak usulan ini?' : 'Tarik usulan ini?'}</span>
                    <Button type="button" variant="soft" onClick={() => setConfirmCancel(false)} disabled={cancel.isPending}>Batal</Button>
                    <Button type="button" variant="danger" onClick={() => cancel.mutate(event.id)} loading={cancel.isPending}>
                        {isRequester ? 'Ya, tolak' : 'Ya, tarik'}
                    </Button>
                </>)}
                {!pending && request && request.status !== 'CANCELLED' && (
                    <Button asChild variant={nextForIct ? 'primary' : 'soft'}>
                        <Link to={detailHref}>
                            {request.status === 'CONFIRMED' && isRequester ? <><CheckCircle2 aria-hidden="true" />Lihat akses</> : nextForIct ?? 'Lihat detail'}
                            <ArrowUpRight aria-hidden="true" />
                        </Link>
                    </Button>
                )}
            </footer>
        </article>
    );
}
