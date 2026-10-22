import { useState } from 'react';
import { BarChart3, Eye, Info, ChevronUp, ChevronDown } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';
import type { User, AgentStats } from '@/types/admin.types';
import { VirtualizedAgentGrid } from '../VirtualizedAgentGrid';
import { AgentCard } from './AgentCard';
import { AgentCardErrorBoundary } from './AgentCardErrorBoundary';
import { AgentRatingsSection } from './AgentRatingsSection';
import { SITE_COLORS, ROLE_CONFIG, getRoleLabel } from './agent-utils';
import { DashAvatar } from '@/features/dashboard/components/DashboardParts';
import { ResBub } from '@/components/resources/ResourceParts';

type SortKey = 'fullName' | 'openTickets' | 'inProgressTickets' | 'resolvedThisWeek' | 'resolvedThisMonth' | 'slaCompliance' | 'appraisalPoints' | 'activeWorkloadPoints';

interface SortHeaderProps {
    label: string;
    sortKey: SortKey;
    sortConfig: { key: SortKey; dir: 'asc' | 'desc' };
    onSort: (key: SortKey) => void;
    align?: 'left' | 'center';
}

function SortHeader({ label, sortKey, sortConfig, onSort, align = 'center' }: SortHeaderProps) {
    const isSorted = sortConfig.key === sortKey;
    return (
        <th
            aria-sort={isSorted ? (sortConfig.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={cn(
                'px-3 py-2.5 text-[11.5px] font-medium text-[var(--td-text-3)]',
                align === 'left' ? 'text-left' : 'text-center'
            )}
        >
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className="min-h-[44px] -my-3 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                <span className="inline-flex items-center gap-1">
                    {label}
                    {isSorted && (sortConfig.dir === 'asc'
                        ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                        : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />)}
                </span>
            </button>
        </th>
    );
}

interface AgentPerformancePanelProps {
    displayedAgentStats: AgentStats[];
    filteredAgentStats: AgentStats[];
    viewMode: 'grid' | 'table';
    statsFilter: 'all' | 'active' | 'resolved' | 'top';
    selectedSite: string;
    selectedRole: string;
    users: User[];
    selectedUserIds: Set<string>;
    sortConfig: { key: SortKey; dir: 'asc' | 'desc' };
    onSort: (key: SortKey) => void;
    onToggleSelection: (id: string) => void;
    onViewDetail: (detail: User | null) => void;
    onEditUser: (user: User) => void;
    onToggleActive: (vars: { userId: string; isActive: boolean }) => void;
    onResetPassword: (user: User) => void;
}

export function AgentPerformancePanel({
    displayedAgentStats,
    filteredAgentStats,
    viewMode,
    statsFilter,
    selectedSite,
    selectedRole,
    users,
    selectedUserIds,
    sortConfig,
    onSort,
    onToggleSelection,
    onViewDetail,
    onEditUser,
    onToggleActive,
    onResetPassword,
}: AgentPerformancePanelProps) {
    const [isOpen, setIsOpen] = useState(() => {
        if (typeof window === 'undefined') return true;
        try {
            const saved = localStorage.getItem('idesk_agent_cards_expanded');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        try {
            localStorage.setItem('idesk_agent_cards_expanded', JSON.stringify(open));
        } catch {
            // Ignore storage errors
        }
    };

    if (displayedAgentStats.length === 0) return null;

    // Grid callbacks previously scanned all users for every card and every action.
    // A lookup table keeps render work linear as the visible agent count grows.
    const usersById = new Map(users.map(user => [user.id, user]));

    return (
        <Collapsible.Root
            open={isOpen}
            onOpenChange={handleOpenChange}
            className="dash-panel !p-0 overflow-hidden"
        >
            <div className={cn(
                "px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 transition-colors",
                isOpen && "border-b border-[hsl(var(--border))]"
            )}>
                <Collapsible.Trigger asChild>
                    <button
                        type="button"
                        className="flex-1 flex items-center justify-between text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg -m-1.5 p-1.5"
                    >
                        <h3 className="min-w-0 font-bold text-slate-800 dark:text-white flex flex-wrap items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                                <BarChart3 className="w-4 h-4" aria-hidden="true" />
                            </span>
                            <span className="group-hover:text-primary transition-colors">
                                {viewMode === 'grid' ? 'Agent Cards' : 'Agent Performance'}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {displayedAgentStats.length}{statsFilter !== 'all' ? ` of ${filteredAgentStats.length}` : ''} agents
                            </span>
                            {selectedSite !== 'ALL' && (
                                <span className={cn("text-xs px-2 py-0.5 rounded-md font-semibold", SITE_COLORS[selectedSite])}>
                                    {selectedSite}
                                </span>
                            )}
                            {selectedRole !== 'ALL' && ROLE_CONFIG[selectedRole as keyof typeof ROLE_CONFIG] && (
                                <span className={cn("text-xs px-2 py-0.5 rounded-md font-semibold", ROLE_CONFIG[selectedRole as keyof typeof ROLE_CONFIG]?.badgeColor || 'bg-slate-100 text-slate-600')}>
                                    {selectedRole}
                                </span>
                            )}
                        </h3>

                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                                {isOpen ? 'Hide' : 'Show'}
                            </span>
                            <span className="w-7 h-7 grid place-items-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-all">
                                {isOpen ? (
                                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                                ) : (
                                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                                )}
                            </span>
                        </div>
                    </button>
                </Collapsible.Trigger>
            </div>

            <Collapsible.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">

            {/* P1-1: Grid View - B1: Now using VirtualizedAgentGrid for performance */}
            {viewMode === 'grid' ? (
                displayedAgentStats.length > 50 ? (
                    /* B1: Virtualized grid for 50+ agents - only renders visible cards.
                       Viewport-relative height so tall screens show more than two rows,
                       with a floor that still fits two full cards on a laptop. */
                    <div className="h-[min(78vh,1040px)] min-h-[680px]">
                        <VirtualizedAgentGrid
                            users={displayedAgentStats.map(agent => ({
                                id: agent.id,
                                fullName: agent.fullName,
                                email: agent.email,
                                role: agent.role as 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER',
                                site: agent.site,
                                isActive: usersById.get(agent.id)?.isActive,
                                openTickets: agent.openTickets,
                                inProgressTickets: agent.inProgressTickets,
                                resolvedThisWeek: agent.resolvedThisWeek,
                                resolvedThisMonth: agent.resolvedThisMonth,
                                slaCompliance: agent.slaCompliance,
                                // Carried through so a card past the 50-agent threshold
                                // shows the same score and workload as one below it.
                                appraisalPoints: agent.appraisalPoints,
                                activeWorkloadPoints: agent.activeWorkloadPoints,
                            }))}
                            selectedIds={selectedUserIds}
                            onSelect={onToggleSelection}
                            onViewDetails={(user) => onViewDetail({
                                id: user.id,
                                fullName: user.fullName,
                                email: user.email,
                                role: user.role,
                                site: user.site,
                                createdAt: '',
                            })}
                            onEdit={(user) => {
                                const fullUser = usersById.get(user.id);
                                if (fullUser) onEditUser(fullUser);
                            }}
                            renderCard={(user, isSelected) => (
                                <AgentCardErrorBoundary>
                                    <AgentCard
                                        agent={{
                                            id: user.id,
                                            fullName: user.fullName,
                                            email: user.email,
                                            role: user.role,
                                            site: user.site,
                                            openTickets: user.openTickets || 0,
                                            inProgressTickets: user.inProgressTickets || 0,
                                            resolvedThisWeek: user.resolvedThisWeek || 0,
                                            resolvedThisMonth: user.resolvedThisMonth || 0,
                                            resolvedTotal: 0,
                                            slaCompliance: user.slaCompliance ?? 100,
                                            appraisalPoints: user.appraisalPoints,
                                            activeWorkloadPoints: user.activeWorkloadPoints,
                                        }}
                                        onView={() => onViewDetail({
                                            id: user.id,
                                            fullName: user.fullName,
                                            email: user.email,
                                            role: user.role,
                                            site: user.site,
                                            createdAt: '',
                                        })}
                                        onSelect={() => onToggleSelection(user.id)}
                                        isSelected={isSelected}
                                        onEdit={() => {
                                            const fullUser = usersById.get(user.id);
                                            if (fullUser) onEditUser(fullUser);
                                        }}
                                        onToggleActive={() => {
                                            const fullUser = usersById.get(user.id);
                                            if (fullUser) {
                                                onToggleActive({ userId: user.id, isActive: !fullUser.isActive });
                                            }
                                        }}
                                        isActive={user.isActive ?? true}
                                        onResetPassword={() => {
                                            const fullUser = usersById.get(user.id);
                                            if (fullUser) { onResetPassword(fullUser); }
                                        }}
                                    />
                                </AgentCardErrorBoundary>
                            )}
                        />
                    </div>
                ) : (
                    /* Standard grid for <50 agents - keeps animations.
                       Capped at 4 columns: the old 5-up made each card ~250px, which is
                       narrower than the name plus its four metric tiles can survive. */
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {displayedAgentStats.map((agent, index) => (
                            <div key={agent.id} className="animate-fade-in-up motion-reduce:animate-none" style={{ animationDelay: `${index * 30}ms` }}>
                                <AgentCardErrorBoundary>
                                    <AgentCard
                                        agent={agent}
                                        onView={() => onViewDetail({
                                            id: agent.id,
                                            fullName: agent.fullName,
                                            email: agent.email,
                                            role: agent.role as 'ADMIN' | 'AGENT' | 'USER',
                                            site: agent.site,
                                            createdAt: '',
                                        })}
                                        onSelect={() => onToggleSelection(agent.id)}
                                        isSelected={selectedUserIds.has(agent.id)}
                                        onEdit={() => {
                                            const user = usersById.get(agent.id);
                                            if (user) onEditUser(user);
                                        }}
                                        onToggleActive={() => {
                                            const user = usersById.get(agent.id);
                                            if (user) {
                                                onToggleActive({ userId: agent.id, isActive: !user.isActive });
                                            }
                                        }}
                                        isActive={usersById.get(agent.id)?.isActive ?? true}
                                        onResetPassword={() => {
                                            const user = usersById.get(agent.id);
                                            if (user) { onResetPassword(user); }
                                        }}
                                    />
                                </AgentCardErrorBoundary>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        {/* P2-3: Sticky headers for better scroll experience */}
                        <thead className="bg-[hsl(var(--idesk-surface))] sticky top-0 z-10 border-b border-[var(--td-line)]">
                            <tr>
                                <SortHeader label="Agent" sortKey="fullName" sortConfig={sortConfig} onSort={onSort} align="left" />
                                <th className="px-3 py-2.5 text-center text-[11.5px] font-medium text-[var(--td-text-3)]">Site</th>
                                <SortHeader label="Open" sortKey="openTickets" sortConfig={sortConfig} onSort={onSort} />
                                <SortHeader label="In Progress" sortKey="inProgressTickets" sortConfig={sortConfig} onSort={onSort} />
                                <SortHeader label="Appraisal" sortKey="appraisalPoints" sortConfig={sortConfig} onSort={onSort} />
                                <SortHeader label="Load Pts" sortKey="activeWorkloadPoints" sortConfig={sortConfig} onSort={onSort} />
                                <SortHeader label="Week" sortKey="resolvedThisWeek" sortConfig={sortConfig} onSort={onSort} />
                                <SortHeader label="Month" sortKey="resolvedThisMonth" sortConfig={sortConfig} onSort={onSort} />
                                <SortHeader label="SLA %" sortKey="slaCompliance" sortConfig={sortConfig} onSort={onSort} />
                                <th className="px-3 py-2.5 text-center text-[11.5px] font-medium text-[var(--td-text-3)]">Role</th>
                                <th className="px-3 py-2.5 text-center text-[11.5px] font-medium text-[var(--td-text-3)]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--td-line)]">
                            {displayedAgentStats.map((agent) => (
                                <tr key={agent.id} className="hover:bg-[var(--res-surface-2)] transition-colors">
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-3">
                                            <DashAvatar name={agent.fullName} />
                                            <div className="min-w-0 queue-person">
                                                <div className="min-w-0"><b>{agent.fullName}</b><small>{agent.email}</small></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {agent.site ? (
                                            <ResBub color="var(--dash-gray)" mono plain>{agent.site.code}</ResBub>
                                        ) : '-'}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="text-[12.5px] font-semibold tabular-nums">
                                            {agent.openTickets}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="text-[12.5px] font-semibold tabular-nums">
                                            {agent.inProgressTickets}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="text-[12.5px] font-semibold tabular-nums">
                                            {agent.appraisalPoints || 0}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="text-[12.5px] font-semibold tabular-nums">
                                            {agent.activeWorkloadPoints || 0}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="text-[12.5px] font-semibold tabular-nums">
                                            {agent.resolvedThisWeek}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="text-[12.5px] font-semibold tabular-nums">
                                            {agent.resolvedThisMonth}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <Tooltip.Provider>
                                            <Tooltip.Root delayDuration={200}>
                                                <Tooltip.Trigger asChild>
                                                    <span className={cn(
                                                        "text-[12.5px] font-semibold cursor-help inline-flex items-center gap-1 tabular-nums",
                                                        agent.slaCompliance >= 90 ? "text-[var(--dash-ink-green)]" :
                                                            agent.slaCompliance >= 70 ? "text-[var(--dash-ink-orange)]" :
                                                                "text-[var(--dash-ink-red)]"
                                                    )}>
                                                        {agent.slaCompliance}%
                                                        <Info className="w-3 h-3 opacity-60" aria-hidden="true" />
                                                    </span>
                                                </Tooltip.Trigger>
                                                <Tooltip.Portal>
                                                    <Tooltip.Content
                                                        side="top"
                                                        className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-[200px] z-50"
                                                        sideOffset={5}
                                                    >
                                                        <p className="font-semibold mb-1">SLA Compliance</p>
                                                        <p className="text-slate-300">
                                                            = (Total - Overdue) / Total × 100
                                                        </p>
                                                        <Tooltip.Arrow className="fill-slate-900" />
                                                    </Tooltip.Content>
                                                </Tooltip.Portal>
                                            </Tooltip.Root>
                                        </Tooltip.Provider>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <ResBub color="var(--dash-gray)" plain>{getRoleLabel(agent.role)}</ResBub>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <button
                                            type="button"
                                            onClick={() => onViewDetail(usersById.get(agent.id) || null)}
                                            className="res-icon-btn mx-auto"
                                            title={`View details for ${agent.fullName}`}
                                            aria-label={`View details for ${agent.fullName}`}
                                        >
                                            <Eye aria-hidden="true" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <AgentRatingsSection />
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
