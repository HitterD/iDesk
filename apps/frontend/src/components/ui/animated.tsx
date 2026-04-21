import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

// Helper for animations
const getAnimationVariants = (animation: string): Variants => {
    switch (animation) {
        case 'fade-in-down':
            return { hidden: { opacity: 0, y: -20 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } };
        case 'slide-in-right':
            return { hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 20 } };
        case 'slide-in-left':
            return { hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 } };
        case 'scale-in':
            return { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 } };
        case 'pop-in':
            return { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.8 } };
        case 'fade-in-up':
        default:
            return { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 20 } };
    }
};

const customEase = [0.23, 1, 0.32, 1] as const;

interface AnimatedCardProps {
    index?: number;
    children: React.ReactNode;
    className?: string;
    animation?: 'fade-in-up' | 'fade-in-down' | 'slide-in-right' | 'slide-in-left' | 'scale-in' | 'pop-in';
}

/**
 * Animated wrapper for cards with staggered animation support using Framer Motion
 */
export const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
    index = 0, 
    children,
    className,
    animation = 'fade-in-up'
}) => (
    <AnimatePresence mode="wait">
        <motion.div 
            className={className}
            variants={getAnimationVariants(animation)}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ 
                duration: 0.3, 
                ease: customEase,
                delay: index * 0.04 
            }}
        >
            {children}
        </motion.div>
    </AnimatePresence>
);

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    className?: string;
    prefix?: string;
    suffix?: string;
}

/**
 * Animated counter that counts up to a target value smoothly
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

        const startTimestamp = performance.now();
        // Emil Kowalski inspired easing
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
        
        const step = (timestamp: number) => {
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easedProgress = easeOut(progress);
            
            setDisplayValue(Math.floor(easedProgress * value));
            
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                setDisplayValue(value);
            }
        };
        
        const frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
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
 * Animated list with staggered children animations using Framer Motion
 */
export const AnimatedList: React.FC<AnimatedListProps> = ({
    children,
    className,
    itemClassName,
    animation = 'fade-in-up',
    staggerDelay = 0.04
}) => (
    <motion.div 
        className={className}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={{
            hidden: {},
            visible: {
                transition: {
                    staggerChildren: staggerDelay
                }
            },
            exit: {
                transition: {
                    staggerChildren: staggerDelay / 2,
                    staggerDirection: -1
                }
            }
        }}
    >
        <AnimatePresence mode="popLayout">
            {React.Children.map(children, (child, index) => (
                <motion.div
                    key={index}
                    className={itemClassName}
                    variants={getAnimationVariants(animation)}
                    transition={{ duration: 0.3, ease: customEase }}
                >
                    {child}
                </motion.div>
            ))}
        </AnimatePresence>
    </motion.div>
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
