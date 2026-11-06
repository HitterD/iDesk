import type { TvBoardCard } from '../hooks/useTvBoardSocket';
import { DIVISION_CONFIGS, resolveCardDivision, type DivisionKey } from '../utils/tvBoardDivisions';
import { formatSlaDeadline, formatSlaStatus } from '../utils/tvBoardTime';
import { useSlaClock } from '@/lib/slaCountdown';
import { toDisplayName } from '@/features/ticket-board/components/ticket-detail/messageThread';

export const APPLE_RED = '#FF3B30';

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
}

/**
 * One list row, readable from across the room: the title, then a quiet line with the division and the
 * requester; PIC and SLA in a fixed right column so rows align. Overdue rows carry a red edge.
 * Sized in rem so it scales with the board's root font size.
 */
export function TvBoardTicketRow({ card, now, boardSiteCode }: { card: TvBoardCard; now: Date; boardSiteCode?: string }) {
    const divisionKey = resolveCardDivision(card);
    const division = DIVISION_CONFIGS[divisionKey];
    const slaClock = useSlaClock(false);
    const sla = formatSlaStatus(card.slaTarget, card.isOverdue, now, { priority: card.priority, info: slaClock });
    const title = card.title || card.description;
    // On the dev hub board, tickets from other sites carry their origin site.
    const foreignSite = card.siteCode && boardSiteCode && card.siteCode !== boardSiteCode ? card.siteCode : null;
    const requester = toDisplayName(card.requesterName);
    const pic = card.assignedToName ? toDisplayName(card.assignedToName) : null;
    const forwardedFrom = card.forwardedFromTeam ? DIVISION_CONFIGS[card.forwardedFromTeam as DivisionKey] : undefined;

    return (
        <li
            data-testid="tv-board-card"
            data-overdue={card.isOverdue || undefined}
            className="relative grid grid-cols-[minmax(0,1fr)_12.5rem] items-center gap-x-[1.5rem] px-[1.6rem] py-[1rem]"
        >
            {card.isOverdue && <span className="absolute inset-y-[0.9rem] left-0 w-[0.3rem] rounded-r-full" style={{ backgroundColor: APPLE_RED }} aria-hidden="true" />}
            <div className="min-w-0">
                <h3 className="truncate text-[1.6rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[var(--tv-text)]" title={title}>
                    {title}
                </h3>
                <div className="mt-[0.35rem] flex min-w-0 items-center gap-[0.55rem] text-[1.05rem] leading-none text-[var(--tv-text-secondary)]">
                    {foreignSite && (
                        <span
                            data-testid="tv-board-origin-site"
                            className="shrink-0 rounded-[0.4rem] bg-[var(--tv-avatar)] px-[0.45rem] py-[0.2rem] text-[0.85rem] font-semibold tracking-wide text-[var(--tv-text)]"
                        >
                            {foreignSite}
                        </span>
                    )}
                    <span className="h-[0.55rem] w-[0.55rem] shrink-0 rounded-full" style={{ backgroundColor: division.color }} aria-hidden="true" />
                    <span className="shrink-0 font-medium" style={{ color: division.color }}>
                        {divisionKey === 'ORACLE_DEV' ? 'ORACLE / K2' : division.shortLabel}
                    </span>
                    {forwardedFrom && (
                        <span
                            data-testid="tv-board-forwarded-from"
                            className="shrink-0 rounded-[0.4rem] px-[0.45rem] py-[0.2rem] text-[0.85rem] font-semibold"
                            style={{ color: forwardedFrom.color, backgroundColor: `${forwardedFrom.color}1F` }}
                        >
                            ↪ dari {forwardedFrom.shortLabel}
                        </span>
                    )}
                    <span className="shrink-0 text-[var(--tv-separator)]" aria-hidden="true">·</span>
                    <span className="truncate" title={requester}>{requester}</span>
                </div>
            </div>

            <div className="min-w-0 text-right">
                {pic ? (
                    <div className="flex min-w-0 items-center justify-end gap-[0.55rem]">
                        <span className="flex h-[1.9rem] w-[1.9rem] shrink-0 items-center justify-center rounded-full bg-[var(--tv-avatar)] text-[0.75rem] font-bold text-[var(--tv-text)]">
                            {getInitials(pic)}
                        </span>
                        <span className="truncate text-[1.15rem] font-semibold text-[var(--tv-text)]" title={pic}>{pic}</span>
                    </div>
                ) : (
                    <span className="text-[1.05rem] font-semibold text-[var(--tv-warn)]">Belum ditugaskan</span>
                )}
                {sla && (
                    <div
                        className="mt-[0.35rem] text-[1rem] font-medium tabular-nums leading-none"
                        style={{ color: sla.overdue ? APPLE_RED : 'var(--tv-text-tertiary)' }}
                        title={card.slaTarget ? `Target SLA: ${formatSlaDeadline(card.slaTarget)}` : undefined}
                    >
                        {sla.label}
                    </div>
                )}
            </div>
        </li>
    );
}
