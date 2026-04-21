import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
    icon: React.ElementType;
    label: string;
    value: number | string;
    color: string;
    bgColor: string;
    highlight?: boolean;
    /** Index for staggered animation (0-5 typically) */
    animationIndex?: number;
    /** Click handler for filtering */
    onClick?: () => void;
    /** Whether this filter is currently active */
    isActive?: boolean;
    /** Loading state */
    isLoading?: boolean;
}

// Animated number component for smooth counting effect
const AnimatedNumber: React.FC<{ value: number | string; className?: string }> = ({ value, className }) => {
    const [displayValue, setDisplayValue] = useState<number | string>(typeof value === 'number' ? 0 : value);
    const previousValue = useRef<number | string>(typeof value === 'number' ? 0 : value);

    useEffect(() => {
        if (typeof value !== 'number') {
            setDisplayValue(value);
            return;
        }

        const startValue = typeof previousValue.current === 'number' ? previousValue.current : 0;
        const endValue = value;
        const duration = 800; // ms
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function - easeOutQuart for smooth deceleration
            const easeProgress = 1 - Math.pow(1 - progress, 4);

            const currentValue = Math.round(startValue + (endValue - startValue) * easeProgress);
            setDisplayValue(currentValue);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
        previousValue.current = value;
    }, [value]);

    if (typeof displayValue === 'number') {
        return <span className={className}>{displayValue.toLocaleString()}</span>;
    }

    return <span className={className}>{displayValue}</span>;
};

// Skeleton loader for stats card
export const StatsCardSkeleton: React.FC<{ animationIndex?: number }> = ({ animationIndex = 0 }) => {
    const animationDelay = `${animationIndex * 50}ms`;

    return (
        <div
            className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4 animate-fade-in-up opacity-0"
            style={{ animationDelay, animationFillMode: 'forwards' }}
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                <div className="space-y-2 flex-1">
                    <div className="h-6 w-12 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                </div>
            </div>
        </div>
    );
};

export const StatsCard: React.FC<StatsCardProps> = ({
    icon: Icon,
    label,
    value,
    color,
    bgColor,
    highlight,
    animationIndex = 0,
    onClick,
    isActive,
    isLoading,
}) => {
    // Calculate staggered delay based on index (50ms per card)
    const animationDelay = `${animationIndex * 50}ms`;

    if (isLoading) {
        return <StatsCardSkeleton animationIndex={animationIndex} />;
    }

    return (
        <div
            className={cn(
                "bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl relative overflow-hidden group p-4 transition-[colors,transform,box-shadow] duration-300 ease-out hover:bg-slate-50/50 dark:hover:bg-slate-800/20 card-interactive",
                // Interactive styles
                onClick && "cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md hover:-translate-y-0.5",
                // Active filter state
                isActive && "ring-1 ring-primary border-primary bg-primary/5 dark:bg-primary/10",
                // Highlight states (overdue/critical)
                !isActive && highlight && typeof value === 'number' && value > 0 && "cursor-pointer hover:shadow-sm",
                !isActive && highlight && typeof value === 'number' && value === 0 && ""
            )}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        >
            {/* Accent Line for highlights */}
            {highlight && (
                <div className={cn("absolute left-0 top-0 bottom-0 w-1", color.replace('text-', 'bg-'))} />
            )}

            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200",
                    bgColor
                )}>
                    <Icon className={cn("w-5 h-5", color)} />
                </div>
                <div className="min-w-0 pr-2">
                    <p className={cn("text-2xl font-extrabold tracking-tight tabular-nums", color)}>
                        <AnimatedNumber value={value} />
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{label}</p>
                </div>
            </div>
        </div>
    );
};
