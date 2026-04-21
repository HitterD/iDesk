import React from 'react';
import { cn } from '@/lib/utils';
import { NotificationCategory } from './types/notification.types';
import { CATEGORY_CONFIG } from './constants/notification.constants';

interface NotificationStatCardProps {
    category: NotificationCategory;
    count: number;
    unreadCount?: number;
    isActive: boolean;
    onClick: () => void;
}

export const NotificationStatCard: React.FC<NotificationStatCardProps> = ({
    category,
    count,
    unreadCount = 0,
    isActive,
    onClick
}) => {
    const config = CATEGORY_CONFIG[category];
    const Icon = config.icon;

    return (
        <button
            onClick={onClick}
            className={cn(
                "relative flex-1 min-w-[140px] flex flex-col items-start p-5 rounded-2xl transition-colors duration-150 border-2 text-left group",
                isActive 
                    ? cn(config.bgColor, "border-primary shadow-lg shadow-primary/10 scale-[1.02]") 
                    : "bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md"
            )}
        >
            <div className="w-full flex justify-between items-start mb-4">
                <div className={cn(
                    "p-2.5 rounded-xl transition-colors duration-300",
                    isActive ? "bg-white dark:bg-slate-800 text-primary shadow-sm" : cn(config.bgColor, config.color)
                )}>
                    <Icon className="w-5 h-5" />
                </div>
                
                {unreadCount > 0 && (
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide animate-in zoom-in duration-300",
                        isActive ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                    )}>
                        {unreadCount} NEW
                    </span>
                )}
            </div>
            
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-3xl font-black tracking-tight leading-none",
                        isActive ? "text-primary" : "text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200"
                    )}>
                        {count}
                    </span>
                    {unreadCount > 0 && !isActive && (
                        <span className="flex h-2.5 w-2.5 rounded-full shadow-sm animate-pulse bg-rose-500" />
                    )}
                </div>
                
                <span className={cn(
                    "text-xs font-bold uppercase tracking-wider mt-1",
                    isActive ? "text-primary/80" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-600"
                )}>
                    {config.label}
                </span>
            </div>

            {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-primary rounded-t-full" />
            )}
        </button>
    );
};
