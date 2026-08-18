import React from 'react';
import { Edit2, Mail, CheckSquare, Square, CheckCircle, AlertCircle, Key, ArrowRight, MoreHorizontal, Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { AgentStats, SITE_COLORS, getAvatarColor, getRoleConfig, getRoleLabel } from './agent-types';

/** Workload points an agent is expected to carry before the bar reads "full". */
const MAX_CAPACITY = 50;
const LOAD_CRITICAL_PERCENT = 80;
const LOAD_WARNING_PERCENT = 50;
const SLA_GOOD_PERCENT = 90;
const SLA_WARNING_PERCENT = 70;

/** Sites without a colour mapping still need a dark variant, or the badge goes white-on-navy. */
const SITE_BADGE_FALLBACK = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

/** One badge geometry for every chip in the meta row, so the row keeps a single height. */
const BADGE_BASE = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide';

type Tone = 'good' | 'warn' | 'bad';

const TONE_TEXT: Record<Tone, string> = {
    good: 'text-[hsl(var(--success-500))]',
    warn: 'text-[hsl(var(--accent))]',
    bad: 'text-[hsl(var(--error-500))]',
};

const TONE_BAR: Record<Tone, string> = {
    good: 'bg-[hsl(var(--success-500))]',
    warn: 'bg-[hsl(var(--accent))]',
    bad: 'bg-[hsl(var(--error-500))]',
};

const TONE_SURFACE: Record<Tone, string> = {
    good: 'bg-[hsl(var(--success-50))] border-[hsl(var(--success-500))]/20 dark:bg-[hsl(var(--success-500))]/10 dark:border-[hsl(var(--success-500))]/25',
    warn: 'bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))]/25',
    bad: 'bg-[hsl(var(--error-50))] border-[hsl(var(--error-500))]/20 dark:bg-[hsl(var(--error-500))]/10 dark:border-[hsl(var(--error-500))]/25',
};

const toneForLoad = (percent: number): Tone =>
    percent >= LOAD_CRITICAL_PERCENT ? 'bad' : percent >= LOAD_WARNING_PERCENT ? 'warn' : 'good';

const toneForSla = (percent: number): Tone =>
    percent >= SLA_GOOD_PERCENT ? 'good' : percent >= SLA_WARNING_PERCENT ? 'warn' : 'bad';

interface CardStatProps {
    label: string;
    value: React.ReactNode;
    /** Surface classes; omitted stats sit on the neutral tile. */
    surfaceClassName?: string;
    valueClassName?: string;
}

/** One tile in the four-up metric strip. Deliberately quieter than the agent name. */
function CardStat({ label, value, surfaceClassName, valueClassName }: CardStatProps) {
    return (
        <div className={cn(
            'rounded-lg border px-1 py-2 text-center',
            surfaceClassName ?? 'bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))]',
        )}>
            <p className={cn('text-sm font-bold leading-none tabular-nums', valueClassName ?? 'text-slate-800 dark:text-slate-100')}>
                {value}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </p>
        </div>
    );
}

interface AgentActionsMenuProps {
    agentName: string;
    email: string;
    isActive: boolean;
    onEdit?: () => void;
    onResetPassword?: () => void;
    onToggleActive?: () => void;
}

/**
 * Secondary actions live in one menu instead of a four-icon row. The old row was
 * laid out beside the name and, at 44px per icon, left the name no width at all.
 */
function AgentActionsMenu({ agentName, email, isActive, onEdit, onResetPassword, onToggleActive }: AgentActionsMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`More actions for ${agentName}`}
                    className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" variant="compact">
                {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                        <Edit2 aria-hidden="true" />
                        Edit user
                    </DropdownMenuItem>
                )}
                {onResetPassword && (
                    <DropdownMenuItem onClick={onResetPassword}>
                        <Key aria-hidden="true" />
                        Reset password
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                    <a href={`mailto:${email}`}>
                        <Mail aria-hidden="true" />
                        Send email
                    </a>
                </DropdownMenuItem>
                {onToggleActive && (
                    <DropdownMenuItem
                        onClick={onToggleActive}
                        variant={isActive ? 'destructive' : 'default'}
                    >
                        <Power aria-hidden="true" />
                        {isActive ? 'Deactivate account' : 'Activate account'}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

interface AgentCardProps {
    agent: AgentStats;
    onView: () => void;
    onSelect: () => void;
    isSelected: boolean;
    onEdit?: () => void;
    onToggleActive?: () => void;
    isActive?: boolean;
    onResetPassword?: () => void;
}

/**
 * Agent Card Component for Grid View
 * Displays agent info with activity indicator, workload bar, and quick actions
 */
export const AgentCard: React.FC<AgentCardProps> = ({
    agent,
    onView,
    onSelect,
    isSelected,
    onEdit,
    onToggleActive,
    isActive = true,
    onResetPassword,
}) => {
    const roleConfig = getRoleConfig(agent.role);
    const roleLabel = getRoleLabel(agent.role);
    const nameId = `agent-card-name-${agent.id}`;

    // E4: Workload calculation
    const currentLoad = agent.activeWorkloadPoints ?? (agent.openTickets + agent.inProgressTickets);
    const loadPercent = Math.min((currentLoad / MAX_CAPACITY) * 100, 100);
    const loadTone = toneForLoad(loadPercent);
    const slaTone = toneForSla(agent.slaCompliance);
    const isBusy = agent.inProgressTickets > 0;

    return (
        // The whole card opens the agent. It is a "stretched link": the View details
        // button owns the click via an ::after overlay covering the card, so there is
        // still exactly one focusable element for the action and no button nested
        // inside another interactive element. Controls that do something else
        // (select, overflow menu) are lifted above the overlay with `relative z-10`.
        <article
            aria-labelledby={nameId}
            className={cn(
                "group relative flex h-full cursor-pointer flex-col rounded-2xl border p-4 transition-[box-shadow,border-color,transform] duration-200 ease-out",
                "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 active:scale-[0.99] motion-reduce:transform-none",
                // Scoped to the card action: an unscoped `has-[:focus-visible]` would
                // also fire for the select box and overflow menu, which draw their own
                // rings, stacking two rings for one focus.
                "has-[[data-card-action]:focus-visible]:ring-2 has-[[data-card-action]:focus-visible]:ring-primary",
                "bg-white dark:bg-[hsl(var(--card))] border-[hsl(var(--border))]",
                isSelected && "ring-2 ring-primary border-primary"
            )}
        >
            {/* Identity — the name owns the row. Only the select box shares it. */}
            <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-base font-extrabold text-white", getAvatarColor(agent.fullName))}>
                        {agent.fullName.charAt(0)}
                    </div>
                    {/* Live connection status. This used to colour itself from
                        `inProgressTickets`, which read as "online" to everyone looking
                        at it — a logged-out agent stayed green as long as a ticket sat
                        in progress. Workload now says so in words in the meta row. */}
                    <PresenceDot
                        userId={agent.id}
                        userName={agent.fullName}
                        className="absolute -right-0.5 -top-0.5 h-3 w-3 border-2 border-white dark:border-[hsl(var(--card))]"
                    />
                </div>

                <div className="min-w-0 flex-1">
                    <h4
                        id={nameId}
                        className="truncate text-base font-bold leading-tight text-foreground"
                        title={agent.fullName}
                    >
                        {agent.fullName}
                    </h4>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={agent.email}>
                        {agent.email}
                    </p>
                </div>

                {/* Selection stays visible: on touch there is no hover to reveal it, and
                    bulk actions are the reason this grid supports selection at all. */}
                <button
                    type="button"
                    onClick={onSelect}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Select ${agent.fullName}`}
                    className="relative z-10 -mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800"
                >
                    {isSelected
                        ? <CheckSquare className="h-4 w-4 text-primary" aria-hidden="true" />
                        : <Square className="h-4 w-4 text-slate-400" aria-hidden="true" />}
                </button>
            </div>

            {/* Meta row: where, what role, and whether the account is usable at all. */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {agent.site && (
                    <span className={cn(BADGE_BASE, SITE_COLORS[agent.site.code] || SITE_BADGE_FALLBACK)}>
                        {agent.site.code}
                    </span>
                )}
                <span className={cn(BADGE_BASE, roleConfig.badgeColor)}>{roleLabel}</span>
                {isBusy && (
                    <span className={cn(BADGE_BASE, 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400')}>
                        {agent.inProgressTickets} in progress
                    </span>
                )}
                <span
                    className={cn(
                        BADGE_BASE,
                        'ml-auto border',
                        isActive
                            ? 'bg-[hsl(var(--success-50))] text-[hsl(var(--success-600))] border-[hsl(var(--success-500))]/20 dark:bg-[hsl(var(--success-500))]/10 dark:text-[hsl(var(--success-500))]'
                            : 'bg-[hsl(var(--error-50))] text-[hsl(var(--error-600))] border-[hsl(var(--error-500))]/20 dark:bg-[hsl(var(--error-500))]/10 dark:text-[hsl(var(--error-500))]'
                    )}
                >
                    {isActive
                        ? <CheckCircle className="h-3 w-3" aria-hidden="true" />
                        : <AlertCircle className="h-3 w-3" aria-hidden="true" />}
                    {isActive ? 'Active' : 'Inactive'}
                </span>
            </div>

            {/* E4: Workload Capacity Bar */}
            <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Workload</span>
                    <span className={cn('font-bold tabular-nums', TONE_TEXT[loadTone])}>{currentLoad}/{MAX_CAPACITY}</span>
                </div>
                <div
                    className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    role="progressbar"
                    aria-valuenow={currentLoad}
                    aria-valuemin={0}
                    aria-valuemax={MAX_CAPACITY}
                    aria-label={`Workload for ${agent.fullName}`}
                >
                    <div
                        className={cn('h-full origin-left rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none', TONE_BAR[loadTone])}
                        style={{ transform: `scaleX(${loadPercent / 100})`, width: '100%' }}
                    />
                </div>
            </div>

            {/* Stats Grid — `mb-4` guarantees breathing room above the footer rule even
                when `mt-auto` below has no leftover space to distribute. */}
            <div className="mt-4 mb-4 grid grid-cols-4 gap-1.5">
                <CardStat label="Score" value={agent.appraisalPoints || 0} valueClassName="text-[hsl(var(--accent))]" />
                <CardStat label="Active" value={agent.inProgressTickets} valueClassName="text-blue-600 dark:text-blue-400" />
                <CardStat label="Month" value={agent.resolvedThisMonth} valueClassName="text-[hsl(var(--success-500))]" />
                <CardStat
                    label="SLA"
                    value={`${agent.slaCompliance}%`}
                    surfaceClassName={TONE_SURFACE[slaTone]}
                    valueClassName={TONE_TEXT[slaTone]}
                />
            </div>

            {/* Footer actions — `mt-auto` keeps every card's footer on the same baseline
                even when a missing site badge makes a neighbouring card shorter. */}
            <div className="-mx-4 mt-auto flex items-center gap-2 border-t border-[hsl(var(--border))] px-4 pt-3">
                {/* `after:` overlay makes the entire card this button's hit area.
                    `focus-visible:outline-none` is safe: the card draws the focus ring
                    for it via `has-[:focus-visible]` above, so keyboard focus is never
                    invisible. Text stays selectable outside the footer because the
                    overlay sits below the raised controls but above nothing else. */}
                <button
                    type="button"
                    onClick={onView}
                    data-card-action
                    aria-label={`View details for ${agent.fullName}`}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-primary transition-colors after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:bg-primary/10 focus-visible:outline-none"
                >
                    View details
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                </button>
                <AgentActionsMenu
                    agentName={agent.fullName}
                    email={agent.email}
                    isActive={isActive}
                    onEdit={onEdit}
                    onResetPassword={onResetPassword}
                    onToggleActive={onToggleActive}
                />
            </div>
        </article>
    );
};

export default AgentCard;
