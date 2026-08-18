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
    const Component = onClick ? 'button' : 'div';

    return (
        // No role/tabIndex/onKeyDown overrides: when onClick is set this already IS a
        // <button>, so the extra Enter handler fired onClick a second time.
        <Component
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            aria-pressed={onClick ? isActive ?? false : undefined}
            className={cn(
                "p-5 rounded-xl flex flex-col transition-[transform,box-shadow,border-color,background-color] duration-150 motion-reduce:transition-none group relative border animate-fade-in-up motion-reduce:animate-none text-left w-full",
                "bg-white dark:bg-[hsl(var(--card))] border-[hsl(var(--border))]",
                onClick && "cursor-pointer hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 motion-reduce:transform-none",
                isActive && "border-primary shadow-sm ring-1 ring-primary"
            )}
        >
            <div className="flex justify-between items-start mb-2 z-10">
                <span className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                    {title}
                </span>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 transition-colors">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
            </div>

            <div className="z-10 mt-1">
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none tabular-nums">
                    {value}
                </div>
                {subtitle && (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate mt-2">{subtitle}</p>
                )}
            </div>
        </Component>
    );
};

export default StatCard;
