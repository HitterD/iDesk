import React from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, ListTodo, Plus, TriangleAlert, UserRoundCog, Users } from 'lucide-react';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/constants/ticket.constants';
import type { Ticket } from '@/types/ticket.types';
import { TicketPill, STATUS_TONES } from '@/components/ui/ticket-pill';
import { cssVars, DASH_COLORS, DashAvatar, DashEmpty, PRIORITY_DOT } from '../components/DashboardParts';
import { isDoneStatus, isTicketOverdue, type TeamAgentStat } from './teamDashboard.stats';
import { feedAge } from '../components/dashboardChart';

export { feedAge };

const FEED_LIMIT = 5;
/** Production "Recent Tickets" tab showed the 8 newest tickets. */
const RECENT_TICKETS_LIMIT = 8;

const ticketNo = (t: Ticket) => t.ticketNumber || t.id.slice(0, 8);

interface FeedItem { icon: React.ElementType; color: string; detail: string; at: string }

/** One feed line per recent ticket, from the ticket's own state (no event stream exists for the team view). */
export function feedItem(t: Ticket): FeedItem {
    const status = STATUS_CONFIG[t.status]?.label ?? t.status;
    if (isDoneStatus(t.status)) {
        return { icon: CircleCheck, color: DASH_COLORS.green, detail: `Diselesaikan${t.assignedTo ? ` oleh ${t.assignedTo.fullName}` : ''}`, at: t.updatedAt };
    }
    if (isTicketOverdue(t)) {
        return { icon: TriangleAlert, color: DASH_COLORS.red, detail: `SLA terlewati · ${PRIORITY_CONFIG[t.priority]?.shortLabel ?? t.priority} · ${status}`, at: t.createdAt };
    }
    if (t.assignedTo) {
        return { icon: UserRoundCog, color: DASH_COLORS.navy, detail: `Ditugaskan ke ${t.assignedTo.fullName} · ${status}`, at: t.createdAt };
    }
    return { icon: Plus, color: DASH_COLORS.blue, detail: `Tiket baru${t.user?.fullName ? ` dari ${t.user.fullName}` : ''} · ${status}`, at: t.createdAt };
}

export const TeamFeed: React.FC<{ tickets: readonly Ticket[] }> = ({ tickets }) => {
    if (tickets.length === 0) return <DashEmpty icon={<ListTodo aria-hidden="true" />}>Belum ada tiket terbaru.</DashEmpty>;
    return (
        <ul className="dash-list">
            {tickets.slice(0, FEED_LIMIT).map((t) => {
                const { icon: Icon, color, detail, at } = feedItem(t);
                return (
                    <li key={t.id}>
                        <Link to={`/tickets/${t.id}`} className="dash-li">
                            <span className="dash-ico" style={cssVars({ '--c': color })}><Icon aria-hidden="true" /></span>
                            <div className="grow1"><b>{t.title}</b><small>#{ticketNo(t)} · {detail}</small></div>
                            <span className="dash-t">{feedAge(at)}</span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
};

/** "Tiket terbaru": newest tickets by creation, mockup list row (priority dot, title, number · requester, status pill). */
export const TeamRecentTickets: React.FC<{ tickets: readonly Ticket[] }> = ({ tickets }) => {
    if (tickets.length === 0) return <DashEmpty icon={<ListTodo aria-hidden="true" />}>Belum ada tiket terbaru.</DashEmpty>;
    return (
        <ul className="dash-list">
            {tickets.slice(0, RECENT_TICKETS_LIMIT).map((t) => (
                <li key={t.id}>
                    <Link to={`/tickets/${t.id}`} className="dash-li">
                        <span className="dash-pdot" style={cssVars({ '--c': PRIORITY_DOT[t.priority] ?? DASH_COLORS.gray })}
                            title={PRIORITY_CONFIG[t.priority]?.label ?? 'Prioritas'} />
                        <div className="grow1">
                            <b>{t.title}</b>
                            <small>#{ticketNo(t)}{t.user?.fullName ? ` · ${t.user.fullName}` : ''}</small>
                        </div>
                        <TicketPill tone={STATUS_TONES[t.status] ?? 'neutral'}>{STATUS_CONFIG[t.status]?.label ?? t.status}</TicketPill>
                    </Link>
                </li>
            ))}
        </ul>
    );
};

const AgentRow: React.FC<{ agent: TeamAgentStat; rank: number }> = ({ agent, rank }) => (
    <>
        <span className="dash-rank">{rank}</span>
        <DashAvatar name={agent.name} />
        <div className="grow1">
            <b>{agent.name}</b>
            <small><span className="dash-n-green">{agent.resolved}</span> selesai · <span className="dash-n-accent">{agent.inProgress}</span> dikerjakan</small>
        </div>
    </>
);

/** Top 5 by resolved; rows open the agent's dashboard only for roles that may view it (ADMIN/MANAGER). */
export const TeamTopAgents: React.FC<{ agents: readonly TeamAgentStat[]; linkAgents: boolean }> = ({ agents, linkAgents }) => {
    if (agents.length === 0) return <DashEmpty icon={<Users aria-hidden="true" />}>Belum ada data agent.</DashEmpty>;
    return (
        <ul className="dash-list">
            {agents.map((a, i) => (
                <li key={a.id}>
                    {linkAgents
                        ? <Link to={`/dashboard/agent/${a.id}`} className="dash-li"><AgentRow agent={a} rank={i + 1} /></Link>
                        : <div className="dash-li"><AgentRow agent={a} rank={i + 1} /></div>}
                </li>
            ))}
        </ul>
    );
};
