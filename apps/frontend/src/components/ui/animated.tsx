import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
    index?: number;
    children: React.ReactNode;
    className?: string;
    animation?: 'fade-in-up' | 'fade-in-down' | 'slide-in-right' | 'slide-in-left' | 'scale-in' | 'pop-in';
}

/**
 * Animated wrapper for cards with staggered animation support
 */
export const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
    index = 0, 
    children,
    className,
    animation = 'fade-in-up'
}) => (
    <div 
        className={cn(
            `animate-${animation} opacity-0`,
            className
        )}
        style={{ 
            animationDelay: `${index * 0.05}s`,
            animationFillMode: 'forwards'
        }}
    >
        {children}
    </div>
);

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    className?: string;
    prefix?: string;
    suffix?: string;
}

/**
 * Animated counter that counts up to a target value
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ 
    value, 
    duration = 1000,
    className,
    prefix = '',
    suffix = ''
}) => {
    const [displayValue, setDisplayValue] = useState(0);
    
    useEffect(() => {
        if (value === 0) {
            setDisplayValue(0);
            return;
        }

        const steps = 20;
        const increment = value / steps;
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.floor(current));
            }
        }, duration / steps);
        
        return () => clearInterval(timer);
    }, [value, duration]);
    
    return <span className={className}>{prefix}{displayValue.toLocaleString()}{suffix}</span>;
};

interface AnimatedListProps {
    children: React.ReactNode[];
    className?: string;
    itemClassName?: string;
    animation?: 'fade-in-up' | 'fade-in-down' | 'slide-in-right' | 'slide-in-left';
    staggerDelay?: number;
}

/**
 * Animated list with staggered children animations
 */
export const AnimatedList: React.FC<AnimatedListProps> = ({
    children,
    className,
    itemClassName,
    animation = 'fade-in-up',
    staggerDelay = 0.05
}) => (
    <div className={className}>
        {React.Children.map(children, (child, index) => (
            <div
                key={index}
                className={cn(`animate-${animation} opacity-0`, itemClassName)}
                style={{
                    animationDelay: `${index * staggerDelay}s`,
                    animationFillMode: 'forwards'
                }}
            >
                {child}
            </div>
        ))}
    </div>
);

interface NotificationBadgeProps {
    count: number;
    className?: string;
    maxCount?: number;
    showPulse?: boolean;
}

/**
 * Notification badge with pulse animation
 */
export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ 
    count,
    className,
    maxCount = 99,
    showPulse = true
}) => {
    if (count <= 0) return null;
    
    return (
        <span className={cn(
            "absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full",
            "text-[10px] font-bold text-white flex items-center justify-center px-1",
            showPulse && count > 0 && "animate-pulse-ring",
            className
        )}>
            {count > maxCount ? `${maxCount}+` : count}
        </span>
    );
};

/**
 * Skeleton loading component with shimmer effect
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn(
        "bg-muted rounded animate-pulse relative overflow-hidden",
        className
    )}>
        <div className="absolute inset-0 animate-shimmer" />
    </div>
);

export default {
    AnimatedCard,
    AnimatedCounter,
    AnimatedList,
    NotificationBadge,
    Skeleton
};
