import React from 'react';
import { FileText, AlertTriangle, CheckCircle, Clock, FileQuestion } from 'lucide-react';
import { DashboardStats } from '../types/renewal.types';

interface ContractStatsProps {
    stats: DashboardStats | undefined;
    isLoading: boolean;
}

export const ContractStats: React.FC<ContractStatsProps> = ({ stats, isLoading }) => {
    const cards = [
        {
            label: 'Total Contracts',
            value: stats?.total ?? 0,
            icon: FileText,
            color: 'bg-blue-50 dark:bg-blue-900/20',
            iconColor: 'text-blue-500',
            textColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            label: 'Active',
            value: stats?.active ?? 0,
            icon: CheckCircle,
            color: 'bg-green-50 dark:bg-green-900/20',
            iconColor: 'text-green-500',
            textColor: 'text-green-600 dark:text-green-400',
        },
        {
            label: 'Expiring Soon',
            value: stats?.expiringSoon ?? 0,
            icon: AlertTriangle,
            color: 'bg-orange-50 dark:bg-orange-900/20',
            iconColor: 'text-orange-500',
            textColor: 'text-orange-600 dark:text-orange-400',
        },
        {
            label: 'Expired',
            value: stats?.expired ?? 0,
            icon: Clock,
            color: 'bg-red-50 dark:bg-red-900/20',
            iconColor: 'text-red-500',
            textColor: 'text-red-600 dark:text-red-400',
        },
        {
            label: 'Draft',
            value: stats?.draft ?? 0,
            icon: FileQuestion,
            color: 'bg-slate-50 dark:bg-slate-800',
            iconColor: 'text-slate-500',
            textColor: 'text-slate-600 dark:text-slate-400',
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
            {cards.map((card) => (
                <div
                    key={card.label}
                    className={`${card.color} rounded-2xl p-6 border border-slate-200 dark:border-slate-700 transition-all hover:scale-105`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <card.icon className={`w-6 h-6 ${card.iconColor}`} />
                        <span className={`text-3xl font-bold ${card.textColor}`}>{card.value}</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{card.label}</p>
                </div>
            ))}
        </div>
    );
};
