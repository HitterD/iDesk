import React from 'react';
import { FileText, AlertTriangle, CheckCircle, Clock, FileQuestion } from 'lucide-react';
import { DashboardStats, ContractStatus } from '../types/renewal.types';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

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
            accentLine: 'bg-blue-500 group-hover:bg-blue-600',
            iconBox: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
        },
        {
            key: ContractStatus.ACTIVE,
            label: 'Active',
            value: stats?.active ?? 0,
            icon: CheckCircle,
            accentLine: 'bg-[hsl(var(--success-500))] group-hover:bg-[hsl(var(--success-600))]',
            iconBox: 'bg-[hsl(var(--success-50))] text-[hsl(var(--success-600))] dark:bg-[hsl(var(--success-500))]/10 dark:text-[hsl(var(--success-400))]',
        },
        {
            key: ContractStatus.EXPIRING_SOON,
            label: 'Expiring Soon',
            value: stats?.expiringSoon ?? 0,
            icon: AlertTriangle,
            accentLine: 'bg-[hsl(var(--warning-500))] group-hover:bg-[hsl(var(--warning-600))]',
            iconBox: 'bg-[hsl(var(--warning-50))] text-[hsl(var(--warning-600))] dark:bg-[hsl(var(--warning-500))]/10 dark:text-[hsl(var(--warning-400))]',
            urgent: true,
        },
        {
            key: ContractStatus.EXPIRED,
            label: 'Expired',
            value: stats?.expired ?? 0,
            icon: Clock,
            accentLine: 'bg-[hsl(var(--error-500))] group-hover:bg-[hsl(var(--error-600))]',
            iconBox: 'bg-[hsl(var(--error-50))] text-[hsl(var(--error-600))] dark:bg-[hsl(var(--error-500))]/10 dark:text-[hsl(var(--error-400))]',
            urgent: true,
        },
        {
            key: ContractStatus.DRAFT,
            label: 'Draft',
            value: stats?.draft ?? 0,
            icon: FileQuestion,
            accentLine: 'bg-slate-400 group-hover:bg-slate-500',
            iconBox: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        },
    ];

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 flex flex-col gap-2 min-h-32 relative animate-pulse">
                        <div className="flex justify-between items-start mb-1">
                            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
                        </div>
                        <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {cards.map((card) => {
                const isActive = activeStatus === card.key;
                const hasUrgentValue = 'urgent' in card && card.urgent && card.value > 0;
                
                return (
                    <div
                        key={card.label}
                        onClick={() => onStatClick?.(card.key)}
                        className={cn(
                            "p-4 rounded-xl flex flex-col gap-2 transition-[opacity,transform,colors] duration-200 ease-out group relative border cursor-pointer animate-fade-in-up overflow-hidden",
                            isActive 
                                ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm" 
                                : "border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] hover:border-primary/40 hover:shadow-sm"
                        )}
                        role="button"
                        tabIndex={0}
                    >
                        {/* Accent Left Line */}
                        <div className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-md transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group-hover:h-3/4",
                            isActive ? "h-full bg-primary" : card.accentLine
                        )} />

                        <div className="flex justify-between items-start mb-1 z-10">
                            <span className={cn(
                                "text-xs font-semibold tracking-wider uppercase pl-2",
                                hasUrgentValue && card.key === ContractStatus.EXPIRED ? "text-[hsl(var(--error-600))] dark:text-[hsl(var(--error-400))]" : 
                                hasUrgentValue && card.key === ContractStatus.EXPIRING_SOON ? "text-[hsl(var(--warning-600))] dark:text-[hsl(var(--warning-400))]" :
                                "text-slate-500 dark:text-slate-400"
                            )}>
                                {card.label}
                            </span>
                            
                            <div className={cn("p-2 rounded-lg transition-colors z-10", card.iconBox)}>
                                <card.icon className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="pl-2 z-10 flex items-end gap-3 justify-between">
                            <div className={cn(
                                "text-3xl font-extrabold tracking-tight leading-none",
                                hasUrgentValue && card.key === ContractStatus.EXPIRED ? "text-[hsl(var(--error-600))] dark:text-[hsl(var(--error-400))]" : "text-slate-900 dark:text-white"
                            )}>
                                <AnimatedNumber value={card.value} />
                            </div>

                            {/* Indicator Dots for Urgent values instead of full card pulse */}
                            {hasUrgentValue && (
                                <div className="flex items-center gap-1.5 mb-1 bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full border border-slate-100 dark:border-white/5">
                                    <span className={cn(
                                        "w-2 h-2 rounded-full animate-pulse", 
                                        card.key === ContractStatus.EXPIRED ? "bg-[hsl(var(--error-500))]" : "bg-[hsl(var(--warning-500))]"
                                    )} />
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Action Req</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
