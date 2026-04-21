import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, User, TrendingUp, CheckCircle, Clock, AlertTriangle, BarChart3, Trophy, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Site {
    id: string;
    code: string;
    name: string;
}

interface AgentStats {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: Site;
    openTickets: number;
    inProgressTickets: number;
    resolvedThisWeek: number;
    resolvedThisMonth: number;
    resolvedTotal: number;
    slaCompliance: number;
}

interface AgentComparisonDialogProps {
    isOpen: boolean;
    onClose: () => void;
    agents: AgentStats[];
}

const SITE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SMG: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

// Get avatar color based on name
const getAvatarColor = (name: string): string => {
    const colors = [
        'from-blue-500 to-cyan-500',
        'from-green-500 to-emerald-500',
        'from-purple-500 to-pink-500',
        'from-amber-500 to-orange-500',
        'from-rose-500 to-red-500',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

// Comparison bar component
const ComparisonBar: React.FC<{
    label: string;
    values: number[];
    max: number;
    icon: React.ElementType;
    colors: string[];
}> = ({ label, values, max, icon: Icon, colors }) => {
    const normalizedMax = Math.max(...values, max) || 1;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Icon className="w-4 h-4" />
                <span>{label}</span>
            </div>
            <div className="space-y-1.5">
                {values.map((value, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                            <div
                                className={cn("h-full rounded-lg transition-[opacity,transform,colors] duration-200 ease-out", colors[idx])}
                                style={{ width: `${(value / normalizedMax) * 100}%` }}
                            />
                        </div>
                        <span className="w-10 text-sm font-bold text-slate-700 dark:text-slate-300 text-right">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const AgentComparisonDialog: React.FC<AgentComparisonDialogProps> = ({
    isOpen,
    onClose,
    agents
}) => {
    if (agents.length < 2) return null;

    const agent1 = agents[0];
    const agent2 = agents[1];

    // Determine winner for each metric
    const metrics = [
        { key: 'resolvedThisMonth', label: 'Resolved (Month)', icon: CheckCircle },
        { key: 'resolvedThisWeek', label: 'Resolved (Week)', icon: TrendingUp },
        { key: 'inProgressTickets', label: 'In Progress', icon: Clock },
        { key: 'slaCompliance', label: 'SLA Compliance', icon: AlertTriangle },
    ];

    const getWinner = (key: string): 'agent1' | 'agent2' | 'tie' => {
        const val1 = agent1[key as keyof AgentStats] as number;
        const val2 = agent2[key as keyof AgentStats] as number;
        if (val1 > val2) return 'agent1';
        if (val2 > val1) return 'agent2';
        return 'tie';
    };

    // Count overall wins
    const wins = { agent1: 0, agent2: 0 };
    metrics.forEach(m => {
        const winner = getWinner(m.key);
        if (winner === 'agent1') wins.agent1++;
        else if (winner === 'agent2') wins.agent2++;
    });

    const overallWinner = wins.agent1 > wins.agent2 ? 'agent1' : wins.agent2 > wins.agent1 ? 'agent2' : 'tie';

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                        <Dialog.Title className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            Agent Comparison
                        </Dialog.Title>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Agent Headers */}
                    <div className="grid grid-cols-2 gap-4 p-6 pb-4">
                        {[agent1, agent2].map((agent, idx) => {
                            const isWinner = (idx === 0 && overallWinner === 'agent1') || (idx === 1 && overallWinner === 'agent2');
                            return (
                                <div key={agent.id} className={cn(
                                    "p-4 rounded-xl border-2 transition-[opacity,transform,colors] duration-200 ease-out",
                                    isWinner
                                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/10"
                                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg relative",
                                            getAvatarColor(agent.fullName)
                                        )}>
                                            {agent.fullName.charAt(0)}
                                            {isWinner && (
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                                                    <Trophy className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">{agent.fullName}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {agent.site && (
                                                    <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold", SITE_COLORS[agent.site.code])}>
                                                        {agent.site.code}
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-500">{agent.role}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {isWinner && (
                                        <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                                            <Medal className="w-3 h-3" />
                                            Winner ({wins[idx === 0 ? 'agent1' : 'agent2']}/{metrics.length} metrics)
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Comparison Metrics */}
                    <div className="px-6 pb-6 space-y-4">
                        {metrics.map((metric) => {
                            const val1 = agent1[metric.key as keyof AgentStats] as number;
                            const val2 = agent2[metric.key as keyof AgentStats] as number;
                            const winner = getWinner(metric.key);

                            return (
                                <ComparisonBar
                                    key={metric.key}
                                    label={metric.label}
                                    values={[val1, val2]}
                                    max={Math.max(val1, val2)}
                                    icon={metric.icon}
                                    colors={[
                                        winner === 'agent1' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-slate-400 to-slate-500',
                                        winner === 'agent2' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-slate-400 to-slate-500'
                                    ]}
                                />
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                        <button
                            onClick={onClose}
                            className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
