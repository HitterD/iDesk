import { BarChart3, Eye, Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import type { User, AgentStats } from '@/types/admin.types';
import { VirtualizedAgentGrid } from '../VirtualizedAgentGrid';
import { AgentCard } from './AgentCard';
import { AgentCardErrorBoundary } from './AgentCardErrorBoundary';
import { SITE_COLORS, ROLE_CONFIG } from './agent-utils';

type SortKey = 'fullName' | 'openTickets' | 'inProgressTickets' | 'resolvedThisWeek' | 'resolvedThisMonth' | 'slaCompliance' | 'appraisalPoints' | 'activeWorkloadPoints';

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
    if (displayedAgentStats.length === 0) return null;

    return (
        <div className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    {viewMode === 'grid' ? 'Agent Cards' : 'Agent Performance'}
                    <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                        ({displayedAgentStats.length}{statsFilter !== 'all' ? ` of ${filteredAgentStats.length}` : ''} agents)
                    </span>
                    {selectedSite !== 'ALL' && (
                        <span className={cn("text-sm px-2 py-0.5 rounded-lg font-normal", SITE_COLORS[selectedSite])}>
                            {selectedSite}
                        </span>
                    )}
                    {selectedRole !== 'ALL' && ROLE_CONFIG[selectedRole as keyof typeof ROLE_CONFIG] && (
                        <span className={cn("text-sm px-2 py-0.5 rounded-lg font-normal", ROLE_CONFIG[selectedRole as keyof typeof ROLE_CONFIG]?.badgeColor || 'bg-slate-100 text-slate-600')}>
                            {selectedRole}
                        </span>
                    )}
                </h3>
            </div>

            {/* P1-1: Grid View - B1: Now using VirtualizedAgentGrid for performance */}
            {viewMode === 'grid' ? (
                displayedAgentStats.length > 50 ? (
                    /* B1: Virtualized grid for 50+ agents - only renders visible cards */
                    <div className="h-[600px]">
                        <VirtualizedAgentGrid
                            users={displayedAgentStats.map(agent => ({
                                id: agent.id,
                                fullName: agent.fullName,
                                email: agent.email,
                                role: agent.role as 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER',
                                site: agent.site,
                                isActive: users.find(u => u.id === agent.id)?.isActive,
                                openTickets: agent.openTickets,
                                inProgressTickets: agent.inProgressTickets,
                                resolvedThisMonth: agent.resolvedThisMonth,
                                slaCompliance: agent.slaCompliance,
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
                                const fullUser = users.find(u => u.id === user.id);
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
                                            slaCompliance: user.slaCompliance || 100,
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
                                            const fullUser = users.find(u => u.id === user.id);
                                            if (fullUser) onEditUser(fullUser);
                                        }}
                                        onToggleActive={() => {
                                            const fullUser = users.find(u => u.id === user.id);
                                            if (fullUser) {
                                                onToggleActive({ userId: user.id, isActive: !fullUser.isActive });
                                            }
                                        }}
                                        isActive={user.isActive ?? true}
                                        onResetPassword={() => {
                                            const fullUser = users.find(u => u.id === user.id);
                                            if (fullUser) { onResetPassword(fullUser); }
                                        }}
                                    />
                                </AgentCardErrorBoundary>
                            )}
                        />
                    </div>
                ) : (
                    /* Standard grid for <50 agents - keeps animations */
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {displayedAgentStats.map((agent, index) => (
                            <div key={agent.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
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
                                            const user = users.find(u => u.id === agent.id);
                                            if (user) onEditUser(user);
                                        }}
                                        onToggleActive={() => {
                                            const user = users.find(u => u.id === agent.id);
                                            if (user) {
                                                onToggleActive({ userId: agent.id, isActive: !user.isActive });
                                            }
                                        }}
                                        isActive={users.find(u => u.id === agent.id)?.isActive ?? true}
                                        onResetPassword={() => {
                                            const user = users.find(u => u.id === agent.id);
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
                        <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-[hsl(var(--border))]">
                            <tr>
                                <th
                                    onClick={() => onSort('fullName')}
                                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Agent {sortConfig.key === 'fullName' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Site</th>
                                <th
                                    onClick={() => onSort('openTickets')}
                                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Open {sortConfig.key === 'openTickets' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => onSort('inProgressTickets')}
                                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    In Progress {sortConfig.key === 'inProgressTickets' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => onSort('appraisalPoints')}
                                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Appraisal {sortConfig.key === 'appraisalPoints' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => onSort('activeWorkloadPoints')}
                                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Load Pts {sortConfig.key === 'activeWorkloadPoints' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => onSort('resolvedThisWeek')}
                                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Week {sortConfig.key === 'resolvedThisWeek' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => onSort('resolvedThisMonth')}
                                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Month {sortConfig.key === 'resolvedThisMonth' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => onSort('slaCompliance')}
                                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    SLA % {sortConfig.key === 'slaCompliance' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Role</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[hsl(var(--border))]">
                            {displayedAgentStats.map((agent) => (
                                <tr key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {agent.fullName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800 dark:text-white">{agent.fullName}</p>
                                                <p className="text-xs text-slate-500">{agent.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {agent.site ? (
                                            <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", SITE_COLORS[agent.site.code])}>
                                                {agent.site.code}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300">
                                            {agent.openTickets}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400">
                                            {agent.inProgressTickets}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400">
                                            {agent.appraisalPoints || 0}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg text-sm font-medium text-red-600 dark:text-red-400">
                                            {agent.activeWorkloadPoints || 0}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm font-medium text-green-600 dark:text-green-400">
                                            {agent.resolvedThisWeek}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm font-medium text-green-600 dark:text-green-400">
                                            {agent.resolvedThisMonth}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <Tooltip.Provider>
                                            <Tooltip.Root delayDuration={200}>
                                                <Tooltip.Trigger asChild>
                                                    <span className={cn(
                                                        "px-2 py-1 rounded-lg text-sm font-medium cursor-help inline-flex items-center gap-1",
                                                        agent.slaCompliance >= 90 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                                            agent.slaCompliance >= 70 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                                                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                    )}>
                                                        {agent.slaCompliance}%
                                                        <Info className="w-3 h-3 opacity-60" />
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
                                    <td className="px-4 py-4 text-center">
                                        <span className={cn(
                                            "px-2 py-1 rounded-lg text-xs font-bold",
                                            ROLE_CONFIG[agent.role as keyof typeof ROLE_CONFIG]?.badgeColor || 'bg-slate-100 text-slate-600'
                                        )}>
                                            {agent.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <button
                                            onClick={() => onViewDetail(users.find(u => u.id === agent.id) || null)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                            title="View Details"
                                            aria-label="View Details"
                                        >
                                            <Eye className="w-4 h-4 text-slate-500" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
