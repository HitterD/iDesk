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
            className="bg-card border border-border/70 rounded-2xl p-3 sm:p-4 animate-fade-in-up opacity-0 shrink-0 min-w-[125px] sm:min-w-0"
            style={{ animationDelay, animationFillMode: 'forwards' }}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="space-y-2 flex-1">
                    <div className="h-3 w-14 rounded bg-muted animate-pulse" />
                    <div className="h-7 w-10 rounded bg-muted animate-pulse" />
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-muted animate-pulse shrink-0" />
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
    highlight: _highlight,
    animationIndex = 0,
    onClick,
    isActive,
    isLoading,
}) => {
    if (isLoading) {
        return <StatsCardSkeleton animationIndex={animationIndex} />;
    }

    return (
        <div
            className={cn(
                "bg-card border rounded-2xl relative p-3 sm:p-4 transition-all duration-200 ease-out shrink-0 min-w-[125px] sm:min-w-0 snap-start shadow-xs group",
                // Base border & background state - soft and subtle, no harsh double rings
                isActive
                    ? "border-primary/40 bg-primary/[0.04] dark:bg-primary/[0.08]"
                    : "border-border/70 hover:border-border hover:bg-muted/30 dark:hover:bg-slate-800/30",
                // Interactive styles
                onClick && "cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]"
            )}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
                    <p className={cn("text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums mt-0.5 sm:mt-1", color)}>
                        <AnimatedNumber value={value} />
                    </p>
                </div>
                <div className={cn("w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105", bgColor)}>
                    <Icon className={cn("w-4 h-4 sm:w-4.5 sm:h-4.5", color)} aria-hidden="true" />
                </div>
            </div>
        </div>
    );
};
