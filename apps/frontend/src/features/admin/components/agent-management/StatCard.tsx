import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ElementType;
    variant?: 'default' | 'blue' | 'green' | 'purple' | 'amber';
    onClick?: () => void;
    isActive?: boolean;
}

/**
 * Enhanced StatCard with gradient support and click-to-filter
 */
export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtitle,
    icon: Icon,
    variant = 'default',
    onClick,
    isActive
}) => {
    const variantStyles = {
        default: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        blue: 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400/30 text-white',
        green: 'bg-gradient-to-br from-green-500 to-green-600 border-green-400/30 text-white',
        purple: 'bg-gradient-to-br from-purple-500 to-purple-600 border-purple-400/30 text-white',
        amber: 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-400/30 text-white',
    };

    const isColored = variant !== 'default';
    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            onClick={onClick}
            className={cn(
                "rounded-2xl p-5 border hover:shadow-lg transition-all hover:-translate-y-0.5 text-left w-full",
                variantStyles[variant],
                onClick && "cursor-pointer",
                isActive && "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900"
            )}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className={cn("text-sm mb-1", isColored ? "text-white/80" : "text-slate-500 dark:text-slate-400")}>{title}</p>
                    <p className={cn("text-2xl font-bold", isColored ? "text-white" : "text-slate-800 dark:text-white")}>{value}</p>
                    {subtitle && <p className={cn("text-xs mt-1", isColored ? "text-white/70" : "text-slate-400")}>{subtitle}</p>}
                </div>
                <div className={cn("p-3 rounded-xl", isColored ? "bg-white/20" : "bg-slate-100 dark:bg-slate-700")}>
                    <Icon className={cn("w-6 h-6", isColored ? "text-white" : "text-slate-600 dark:text-slate-300")} />
                </div>
            </div>
        </Component>
    );
};

export default StatCard;
