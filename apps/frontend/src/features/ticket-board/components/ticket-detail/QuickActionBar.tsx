/**
 * QuickActionBar Component
 * 
 * A floating action bar for common ticket actions.
 * Phase 3 improvement for better UX.
 */

import React from 'react';
import {
    MessageSquare,
    Clock,
    CheckCircle2,
    AlertTriangle,
    UserPlus,
    MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionBarProps {
    ticketStatus: string;
    onChangeStatus: (status: string) => void;
    onScrollToChat: () => void;
    onAssign?: () => void;
    isDisabled?: boolean;
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
    ticketStatus,
    onChangeStatus,
    onScrollToChat,
    onAssign,
    isDisabled = false,
}) => {
    const isTerminal = ticketStatus === 'RESOLVED' || ticketStatus === 'CANCELLED';

    if (isTerminal) return null;

    const actions = [
        {
            id: 'reply',
            icon: MessageSquare,
            label: 'Reply',
            onClick: onScrollToChat,
            color: 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30',
        },
        {
            id: 'in-progress',
            icon: Clock,
            label: 'In Progress',
            onClick: () => onChangeStatus('IN_PROGRESS'),
            color: 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30',
            active: ticketStatus === 'IN_PROGRESS',
        },
        {
            id: 'resolve',
            icon: CheckCircle2,
            label: 'Resolve',
            onClick: () => onChangeStatus('RESOLVED'),
            color: 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30',
        },
        ...(onAssign ? [{
            id: 'assign',
            icon: UserPlus,
            label: 'Assign',
            onClick: onAssign,
            color: 'text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/30',
        }] : []),
    ];

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 xl:hidden">
            <div className="flex items-center gap-1 p-2 glass-card-elevated shadow-2xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                        <button
                            key={action.id}
                            onClick={action.onClick}
                            disabled={isDisabled}
                            className={cn(
                                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors duration-150",
                                action.color,
                                action.active && "bg-slate-100 dark:bg-slate-800",
                                isDisabled && "opacity-50 cursor-not-allowed"
                            )}
                            title={action.label}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-[10px] font-medium">{action.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default QuickActionBar;
