import type { TvBoardCard } from '../hooks/useTvBoardSocket';
import { DIVISION_CONFIGS, resolveCardDivision } from '../utils/tvBoardDivisions';
import { formatSlaDeadline, formatSlaStatus } from '../utils/tvBoardTime';

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
 * One Reminders-style list row: title + requester on the left, PIC + SLA in a fixed right column
 * so every row aligns. Sized in rem so it scales with the board's root font size.
 */
export function TvBoardTicketRow({ card, now }: { card: TvBoardCard; now: Date }) {
    const divisionKey = resolveCardDivision(card);
    const division = DIVISION_CONFIGS[divisionKey];
    const sla = formatSlaStatus(card.slaTarget, card.isOverdue, now);
    const title = card.title || card.description;

    return (
        <li
            data-testid="tv-board-card"
            data-overdue={card.isOverdue || undefined}
            className="grid grid-cols-[minmax(0,1fr)_15rem] items-center gap-x-[1.5rem] px-[1.5rem] py-[0.95rem]"
        >
            {/* Left: title, then division · requester · department */}
            <div className="min-w-0">
                <h3 className="truncate text-[1.65rem] font-semibold leading-[1.25] tracking-[-0.01em] text-[#1D1D1F]" title={title}>
                    {title}
                </h3>
                <div className="mt-[0.3rem] flex min-w-0 items-center gap-[0.5rem] text-[1.1rem] leading-none">
                    <span className="h-[0.6rem] w-[0.6rem] shrink-0 rounded-full" style={{ backgroundColor: division.color }} aria-hidden="true" />
                    <span className="shrink-0 font-medium" style={{ color: division.color }}>
                        {divisionKey === 'ORACLE_DEV' ? 'ORACLE / K2' : division.shortLabel}
                    </span>
                    <span className="shrink-0 text-[#C7C7CC]" aria-hidden="true">·</span>
                    <span className="truncate text-[#424245]" title={card.requesterName}>
                        {card.requesterName}
                    </span>
                    {card.requesterDepartment && (
                        <span data-testid="tv-board-department" className="max-w-[40%] shrink truncate text-[#86868B]">
                            {card.requesterDepartment}
                        </span>
                    )}
                </div>
            </div>

            {/* Right: PIC, then SLA */}
            <div className="min-w-0 text-right">
                {card.assignedToName ? (
                    <div className="flex min-w-0 items-center justify-end gap-[0.55rem]">
                        <span className="flex h-[2rem] w-[2rem] shrink-0 items-center justify-center rounded-full bg-[#E8E8ED] text-[0.8rem] font-bold text-[#1D1D1F]">
                            {getInitials(card.assignedToName)}
                        </span>
                        <span className="truncate text-[1.2rem] font-bold text-[#1D1D1F]" title={card.assignedToName}>
                            {card.assignedToName}
                        </span>
                    </div>
                ) : (
                    <span className="text-[1.2rem] font-semibold text-amber-600">Belum ditugaskan</span>
                )}
                {sla && (
                    <div
                        className="mt-[0.3rem] text-[1rem] font-medium tabular-nums leading-none"
                        style={{ color: sla.overdue ? APPLE_RED : '#86868B' }}
                        title={card.slaTarget ? `Target SLA: ${formatSlaDeadline(card.slaTarget)}` : undefined}
                    >
                        {sla.label}
                    </div>
                )}
            </div>
        </li>
    );
}
