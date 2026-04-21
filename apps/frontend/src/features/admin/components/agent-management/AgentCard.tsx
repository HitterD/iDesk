import React from 'react';
import { Edit2, Mail, CheckSquare, Square, CheckCircle, AlertCircle, Key, ArrowRight } from 'lucide-react';
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
    const roleConfig = ROLE_CONFIG[agent.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.USER;

    // E4: Workload calculation
    const maxCapacity = 50; // Increased capacity for points rather than just ticket count
    const currentLoad = agent.activeWorkloadPoints ?? (agent.openTickets + agent.inProgressTickets);
    const loadPercent = Math.min((currentLoad / maxCapacity) * 100, 100);
    const loadColor = loadPercent >= 80 ? 'bg-[hsl(var(--error-500))]' : loadPercent >= 50 ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--success-500))]';

    return (
        <div className={cn(
            "p-5 rounded-xl border transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:shadow-md hover:-translate-y-0.5 cursor-pointer group",
            "bg-white dark:bg-[hsl(var(--card))] border-[hsl(var(--border))]",
            isSelected && "ring-2 ring-primary border-primary"
        )}>
            {/* Header with Avatar and Quick Actions */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    {/* Avatar with U3: Activity Indicator */}
                    <div className="relative">
                        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center font-extrabold text-lg text-white", getAvatarColor(agent.fullName))}>
                            {agent.fullName.charAt(0)}
                        </div>
                        {/* U3: Activity indicator - green pulse for active, gray for idle */}
                        <div
                            className={cn(
                                "absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[hsl(var(--card))]",
                                agent.inProgressTickets > 0
                                    ? "bg-[hsl(var(--success-500))] animate-pulse"
                                    : "bg-slate-300 dark:bg-slate-600"
                            )}
                            title={agent.inProgressTickets > 0 ? 'Working on tickets' : 'No active tickets'}
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="font-extrabold text-slate-900 dark:text-white truncate tracking-tight">{agent.fullName}</p>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">{agent.email}</p>
                    </div>
                </div>

                {/* U1: Quick Actions Row - visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit User"
                        >
                            <Edit2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </button>
                    )}
                    {onResetPassword && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onResetPassword(); }}
                            className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            title="Reset Password"
                        >
                            <Key className="w-4 h-4 text-[hsl(var(--accent))] dark:text-amber-400" />
                        </button>
                    )}
                    <a
                        href={`mailto:${agent.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Send Email"
                    >
                        <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </a>
                    <button
                        onClick={(e) => { e.stopPropagation(); onSelect(); }}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ml-1"
                    >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-slate-400" />}
                    </button>
                </div>
            </div>

            {/* Badges Row */}
            <div className="flex items-center gap-2 mb-4">
                {agent.site && (
                    <span className={cn("px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider", SITE_COLORS[agent.site.code] || 'bg-slate-100 text-slate-600 border border-slate-200')}>
                        {agent.site.code}
                    </span>
                )}
                <span className={cn("px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider", roleConfig.badgeColor)}>
                    {agent.role}
                </span>
                {/* U2: Active/Inactive Toggle */}
                {onToggleActive && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
                        className={cn(
                            "px-2 py-1 rounded-md text-[10px] uppercase font-bold flex items-center gap-1 transition-colors tracking-wider border",
                            isActive
                                ? "bg-[hsl(var(--success-50))] text-[hsl(var(--success-600))] border-[hsl(var(--success-500))]/20 dark:bg-[hsl(var(--success-500))]/10 dark:text-[hsl(var(--success-500))] hover:bg-[hsl(var(--success-100))]"
                                : "bg-[hsl(var(--error-50))] text-[hsl(var(--error-600))] border-[hsl(var(--error-500))]/20 dark:bg-[hsl(var(--error-500))]/10 dark:text-[hsl(var(--error-500))] hover:bg-[hsl(var(--error-100))]"
                        )}
                        title={isActive ? 'Click to deactivate' : 'Click to activate'}
                    >
                        {isActive ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {isActive ? 'Active' : 'Inactive'}
                    </button>
                )}
            </div>

            {/* E4: Workload Capacity Bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Workload</span>
                    <span className={cn(
                        "font-bold text-[10px]",
                        loadPercent >= 80 ? "text-[hsl(var(--error-500))]" :
                            loadPercent >= 50 ? "text-[hsl(var(--accent))]" :
                                "text-[hsl(var(--success-500))]"
                    )}>{currentLoad}/{maxCapacity}</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-[opacity,transform,colors] duration-200 ease-out", loadColor)}
                        style={{ width: `${loadPercent}%` }}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 flex flex-col items-center justify-center border border-[hsl(var(--border))]">
                    <p className="text-lg font-extrabold text-[hsl(var(--accent))] leading-none">{agent.appraisalPoints || 0}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mt-1.5">Appraisal</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 flex flex-col items-center justify-center border border-[hsl(var(--border))]">
                    <p className="text-lg font-extrabold text-blue-500 dark:text-blue-400 leading-none">{agent.inProgressTickets}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mt-1.5">Active</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 flex flex-col items-center justify-center border border-[hsl(var(--border))]">
                    <p className="text-lg font-extrabold text-[hsl(var(--success-500))] leading-none">{agent.resolvedThisMonth}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mt-1.5">Month</p>
                </div>
                <div className={cn(
                    "rounded-lg p-2.5 flex flex-col items-center justify-center border",
                    agent.slaCompliance >= 90 ? "bg-[hsl(var(--success-50))] border-[hsl(var(--success-500))]/20 dark:bg-[hsl(var(--success-500))]/10 dark:border-[hsl(var(--success-500))]/20" :
                        agent.slaCompliance >= 70 ? "bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))]/20 dark:bg-[hsl(var(--accent))]/10 dark:border-[hsl(var(--accent))]/20" :
                            "bg-[hsl(var(--error-50))] border-[hsl(var(--error-500))]/20 dark:bg-[hsl(var(--error-500))]/10 dark:border-[hsl(var(--error-500))]/20"
                )}>
                    <p className={cn(
                        "text-lg font-extrabold leading-none",
                        agent.slaCompliance >= 90 ? "text-[hsl(var(--success-500))]" :
                            agent.slaCompliance >= 70 ? "text-[hsl(var(--accent))]" :
                                "text-[hsl(var(--error-500))]"
                    )}>{agent.slaCompliance}%</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mt-1.5">SLA</p>
                </div>
            </div>

            {/* View Details Button */}
            <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] -mx-5 px-5">
                <button
                    onClick={onView}
                    className="w-full py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors flex items-center justify-center gap-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group/btn"
                >
                    VIEW DETAILS
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
};

export default AgentCard;
