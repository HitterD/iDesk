import React from 'react';
import { motion, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StaggerListProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    keyExtractor: (item: T, index: number) => string;
    className?: string;
    itemClassName?: string;
    staggerDelay?: number;
    animationDuration?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
}

// Stagger animation variants
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: (staggerDelay: number) => ({
        opacity: 1,
        transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.05,
        },
    }),
};

const getItemVariants = (direction: string, duration: number): Variants => {
    const offset = 20;
    const initialPosition = {
        up: { y: offset },
        down: { y: -offset },
        left: { x: offset },
        right: { x: -offset },
    }[direction] || { y: offset };

    return {
        hidden: {
            opacity: 0,
            ...initialPosition,
            filter: 'blur(2px)',
        },
        visible: {
            opacity: 1,
            y: 0,
            x: 0,
            filter: 'blur(0px)',
            transition: {
                duration,
                ease: [0.23, 1, 0.32, 1] as const,
            },
        },
    };
};

export function StaggerList<T>({
    items,
    renderItem,
    keyExtractor,
    className,
    itemClassName,
    staggerDelay = 0.05,
    animationDuration = 0.25,
    direction = 'up',
}: StaggerListProps<T>) {
    const itemVariants = getItemVariants(direction, animationDuration);

    return (
        <motion.div
            className={className}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            custom={staggerDelay}
        >
            {items.map((item, index) => (
                <motion.div
                    key={keyExtractor(item, index)}
                    variants={itemVariants}
                    className={itemClassName}
                >
                    {renderItem(item, index)}
                </motion.div>
            ))}
        </motion.div>
    );
}

// Grid variant for card layouts
interface StaggerGridProps<T> extends Omit<StaggerListProps<T>, 'className'> {
    columns?: number;
    gap?: number;
    className?: string;
}

export function StaggerGrid<T>({
    items,
    renderItem,
    keyExtractor,
    columns = 3,
    gap = 4,
    className,
    itemClassName,
    staggerDelay = 0.08,
    animationDuration = 0.4,
    direction = 'up',
}: StaggerGridProps<T>) {
    const itemVariants = getItemVariants(direction, animationDuration);

    return (
        <motion.div
            className={cn(
                'grid',
                `grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`,
                `gap-${gap}`,
                className
            )}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            custom={staggerDelay}
        >
            {items.map((item, index) => (
                <motion.div
                    key={keyExtractor(item, index)}
                    variants={itemVariants}
                    className={itemClassName}
                >
                    {renderItem(item, index)}
                </motion.div>
            ))}
        </motion.div>
    );
}

// Simple stagger wrapper for any children
interface StaggerChildrenProps {
    children: React.ReactNode;
    className?: string;
    staggerDelay?: number;
    animationDuration?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
}

export const StaggerChildren: React.FC<StaggerChildrenProps> = ({
    children,
    className,
    staggerDelay = 0.05,
    animationDuration = 0.4,
    direction = 'up',
}) => {
    const itemVariants = getItemVariants(direction, animationDuration);

    return (
        <motion.div
            className={className}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            custom={staggerDelay}
        >
            {React.Children.map(children, (child, index) => (
                <motion.div key={index} variants={itemVariants}>
                    {child}
                </motion.div>
            ))}
        </motion.div>
    );
};

export default StaggerList;
