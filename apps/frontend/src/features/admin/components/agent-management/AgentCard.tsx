import React from 'react';
import { Edit2, Mail, CheckSquare, Square, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentStats, SITE_COLORS, ROLE_CONFIG, getAvatarColor } from './agent-types';

interface AgentCardProps {
    agent: AgentStats;
    onView: () => void;
    onSelect: () => void;
    isSelected: boolean;
    onEdit?: () => void;
    onToggleActive?: () => void;
    isActive?: boolean;
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
    isActive = true
}) => {
    const roleConfig = ROLE_CONFIG[agent.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.USER;

    // E4: Workload calculation
    const maxCapacity = 10;
    const currentLoad = agent.openTickets + agent.inProgressTickets;
    const loadPercent = Math.min((currentLoad / maxCapacity) * 100, 100);
    const loadColor = loadPercent >= 80 ? 'bg-red-500' : loadPercent >= 50 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className={cn(
            "glass-card p-4 rounded-2xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer group",
            isSelected && "ring-2 ring-primary"
        )}>
            {/* Header with Avatar and Quick Actions */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    {/* Avatar with U3: Activity Indicator */}
                    <div className="relative">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white", getAvatarColor(agent.fullName))}>
                            {agent.fullName.charAt(0)}
                        </div>
                        {/* U3: Activity indicator - green pulse for active, gray for idle */}
                        <div
                            className={cn(
                                "absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800",
                                agent.inProgressTickets > 0
                                    ? "bg-green-500 animate-pulse"
                                    : "bg-slate-400"
                            )}
                            title={agent.inProgressTickets > 0 ? 'Working on tickets' : 'No active tickets'}
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-white truncate">{agent.fullName}</p>
                        <p className="text-xs text-slate-500 truncate">{agent.email}</p>
                    </div>
                </div>

                {/* U1: Quick Actions Row - visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Edit User"
                        >
                            <Edit2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </button>
                    )}
                    <a
                        href={`mailto:${agent.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Send Email"
                    >
                        <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </a>
                    <button
                        onClick={(e) => { e.stopPropagation(); onSelect(); }}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-slate-400" />}
                    </button>
                </div>
            </div>

            {/* E4: Workload Capacity Bar */}
            <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Workload</span>
                    <span className={cn(
                        "font-medium",
                        loadPercent >= 80 ? "text-red-600 dark:text-red-400" :
                            loadPercent >= 50 ? "text-yellow-600 dark:text-yellow-400" :
                                "text-green-600 dark:text-green-400"
                    )}>{currentLoad}/{maxCapacity}</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-500", loadColor)}
                        style={{ width: `${loadPercent}%` }}
                    />
                </div>
            </div>

            {/* Badges Row */}
            <div className="flex items-center gap-2 mb-3">
                {agent.site && (
                    <span className={cn("px-2 py-0.5 rounded-lg text-xs font-bold", SITE_COLORS[agent.site.code] || 'bg-slate-100 text-slate-600')}>
                        {agent.site.code}
                    </span>
                )}
                <span className={cn("px-2 py-0.5 rounded-lg text-xs font-bold", roleConfig.badgeColor)}>
                    {agent.role}
                </span>
                {/* U2: Active/Inactive Toggle */}
                {onToggleActive && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
                        className={cn(
                            "px-2 py-0.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors",
                            isActive
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                        )}
                        title={isActive ? 'Click to deactivate' : 'Click to activate'}
                    >
                        {isActive ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {isActive ? 'Active' : 'Inactive'}
                    </button>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{agent.inProgressTickets}</p>
                    <p className="text-xs text-slate-500">Active</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{agent.resolvedThisMonth}</p>
                    <p className="text-xs text-slate-500">Month</p>
                </div>
                <div className={cn(
                    "rounded-lg p-2",
                    agent.slaCompliance >= 90 ? "bg-green-100 dark:bg-green-900/30" :
                        agent.slaCompliance >= 70 ? "bg-yellow-100 dark:bg-yellow-900/30" :
                            "bg-red-100 dark:bg-red-900/30"
                )}>
                    <p className={cn(
                        "text-lg font-bold",
                        agent.slaCompliance >= 90 ? "text-green-600 dark:text-green-400" :
                            agent.slaCompliance >= 70 ? "text-yellow-600 dark:text-yellow-400" :
                                "text-red-600 dark:text-red-400"
                    )}>{agent.slaCompliance}%</p>
                    <p className="text-xs text-slate-500">SLA</p>
                </div>
            </div>

            {/* View Details Button */}
            <button
                onClick={onView}
                className="w-full mt-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-xl transition-colors"
            >
                View Details
            </button>
        </div>
    );
};

export default AgentCard;
