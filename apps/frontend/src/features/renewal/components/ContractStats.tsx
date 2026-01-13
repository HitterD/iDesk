import React from 'react';
import { FileText, AlertTriangle, CheckCircle, Clock, FileQuestion } from 'lucide-react';
import { DashboardStats, ContractStatus } from '../types/renewal.types';
import { cn } from '@/lib/utils';

interface ContractStatsProps {
    stats: DashboardStats | undefined;
    isLoading: boolean;
    onStatClick?: (status: ContractStatus | '') => void;
    activeStatus?: ContractStatus | '';
}

export const ContractStats: React.FC<ContractStatsProps> = ({
    stats,
    isLoading,
    onStatClick,
    activeStatus = ''
}) => {
    const cards = [
        {
            key: '' as ContractStatus | '',
            label: 'Total Contracts',
            value: stats?.total ?? 0,
            icon: FileText,
            color: 'bg-blue-50 dark:bg-blue-500/10 backdrop-blur-sm',
            activeColor: 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
            iconColor: 'text-blue-600 dark:text-blue-400',
            textColor: 'text-blue-700 dark:text-blue-400',
            glowColor: 'shadow-lg shadow-blue-500/10 dark:shadow-blue-500/20',
        },
        {
            key: ContractStatus.ACTIVE,
            label: 'Active',
            value: stats?.active ?? 0,
            icon: CheckCircle,
            color: 'bg-emerald-50 dark:bg-emerald-500/10 backdrop-blur-sm',
            activeColor: 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            textColor: 'text-emerald-700 dark:text-emerald-400',
            glowColor: 'shadow-lg shadow-emerald-500/10 dark:shadow-emerald-500/20',
        },
        {
            key: ContractStatus.EXPIRING_SOON,
            label: 'Expiring Soon',
            value: stats?.expiringSoon ?? 0,
            icon: AlertTriangle,
            color: 'bg-orange-50 dark:bg-orange-500/10 backdrop-blur-sm',
            activeColor: 'ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
            iconColor: 'text-orange-600 dark:text-orange-400',
            textColor: 'text-orange-700 dark:text-orange-400',
            glowColor: 'shadow-lg shadow-orange-500/20 dark:shadow-orange-500/30',
            urgent: true,
        },
        {
            key: ContractStatus.EXPIRED,
            label: 'Expired',
            value: stats?.expired ?? 0,
            icon: Clock,
            color: 'bg-red-50 dark:bg-red-500/10 backdrop-blur-sm',
            activeColor: 'ring-2 ring-red-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
            iconColor: 'text-red-600 dark:text-red-400',
            textColor: 'text-red-700 dark:text-red-400',
            glowColor: 'shadow-lg shadow-red-500/20 dark:shadow-red-500/30',
            urgent: true,
        },
        {
            key: ContractStatus.DRAFT,
            label: 'Draft',
            value: stats?.draft ?? 0,
            icon: FileQuestion,
            color: 'bg-slate-100 dark:bg-slate-500/10 backdrop-blur-sm',
            activeColor: 'ring-2 ring-slate-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
            iconColor: 'text-slate-600 dark:text-slate-400',
            textColor: 'text-slate-700 dark:text-slate-400',
            glowColor: 'shadow-lg shadow-slate-500/10 dark:shadow-slate-500/10',
        },
    ];

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 animate-pulse">
                        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {cards.map((card) => {
                const isActive = activeStatus === card.key;
                const hasUrgentValue = 'urgent' in card && card.urgent && card.value > 0;
                return (
                    <div
                        key={card.label}
                        onClick={() => onStatClick?.(card.key)}
                        className={cn(
                            card.color,
                            card.glowColor,
                            "rounded-2xl p-6 transition-all cursor-pointer border border-slate-200 dark:border-white/10",
                            "hover:scale-105 hover:-translate-y-1",
                            hasUrgentValue && "animate-pulse",
                            isActive && card.activeColor
                        )}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <card.icon className={cn("w-6 h-6", card.iconColor)} />
                            <span className={cn("text-3xl font-bold", card.textColor)}>{card.value}</span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{card.label}</p>
                        {isActive && card.key !== '' && (
                            <p className="text-xs text-primary mt-1 font-medium">Click to clear</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
