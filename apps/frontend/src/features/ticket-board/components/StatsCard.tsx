import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
    icon: React.ElementType;
    label: string;
    value: number;
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
const AnimatedNumber: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const previousValue = useRef(0);

    useEffect(() => {
        const startValue = previousValue.current;
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

    return <span className={className}>{displayValue.toLocaleString()}</span>;
};

// Skeleton loader for stats card
export const StatsCardSkeleton: React.FC<{ animationIndex?: number }> = ({ animationIndex = 0 }) => {
    const animationDelay = `${animationIndex * 50}ms`;

    return (
        <div
            className="glass-card p-4 animate-fade-in-up opacity-0"
            style={{ animationDelay, animationFillMode: 'forwards' }}
        >
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="space-y-2">
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
                "glass-card-elevated stats-card-glow p-4 transition-all duration-300",
                // Interactive styles
                onClick && "cursor-pointer hover:scale-[1.02] hover:glass-shadow-heavy active:scale-[0.98]",
                // Active filter state
                isActive && "ring-2 ring-primary shadow-lg shadow-primary/20",
                // Highlight states (overdue/critical)
                !isActive && highlight && value > 0 && "ring-2 ring-red-500/50 animate-pulse-red",
                !isActive && highlight && value === 0 && "ring-1 ring-green-500/30"
            )}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300",
                    onClick && "group-hover:scale-110",
                    bgColor
                )}>
                    <Icon className={cn("w-6 h-6", color)} />
                </div>
                <div>
                    <p className={cn("text-2xl font-bold tabular-nums", color)}>
                        <AnimatedNumber value={value} />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                </div>
            </div>
        </div>
    );
};
