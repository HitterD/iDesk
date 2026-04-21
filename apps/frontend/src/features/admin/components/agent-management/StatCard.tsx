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
 * Enhanced StatCard with Industrial Utilitarian design
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
    // Generate accent color based on variant for the left line
    const getAccentColor = () => {
        switch (variant) {
            case 'blue': return 'bg-blue-500 dark:bg-blue-600';
            case 'green': return 'bg-[hsl(var(--success-500))]';
            case 'purple': return 'bg-purple-500 dark:bg-purple-600';
            case 'amber': return 'bg-[hsl(var(--accent))]';
            default: return 'bg-slate-200 dark:bg-slate-700 group-hover:bg-primary';
        }
    };

    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            onClick={onClick}
            className={cn(
                "p-5 rounded-xl flex flex-col transition-colors duration-150 group relative border animate-fade-in-up text-left w-full",
                "bg-white dark:bg-[hsl(var(--card))] border-[hsl(var(--border))]",
                onClick && "cursor-pointer hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5",
                isActive && "border-primary shadow-sm ring-1 ring-primary"
            )}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        >
            <div className="flex justify-between items-start mb-2 z-10">
                <span className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                    {title}
                </span>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 transition-colors">
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            
            <div className="z-10 mt-1">
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                    {value}
                </div>
                {subtitle && (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate mt-2">{subtitle}</p>
                )}
            </div>

            {/* Accent line on left side */}
            <div className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-md transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group-hover:h-3/4",
                getAccentColor()
            )} />
        </Component>
    );
};

export default StatCard;
