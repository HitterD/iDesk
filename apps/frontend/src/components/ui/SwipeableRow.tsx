import React, { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Check, Trash2, Archive, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeAction {
    icon: React.ReactNode;
    label: string;
    color: string;
    bgColor: string;
    onAction: () => void;
}

interface SwipeableRowProps {
    children: React.ReactNode;
    leftAction?: SwipeAction;
    rightAction?: SwipeAction;
    threshold?: number;
    className?: string;
    disabled?: boolean;
    onSwipeStart?: () => void;
    onSwipeEnd?: () => void;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
    children,
    leftAction,
    rightAction,
    threshold = 100,
    className,
    disabled = false,
    onSwipeStart,
    onSwipeEnd,
}) => {
    const [isSwiping, setIsSwiping] = useState(false);
    const constraintsRef = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    
    // Calculate background opacity based on swipe distance
    const leftOpacity = useTransform(x, [0, threshold], [0, 1]);
    const rightOpacity = useTransform(x, [-threshold, 0], [1, 0]);
    
    // Scale for action icons
    const leftScale = useTransform(x, [0, threshold * 0.5, threshold], [0.5, 0.8, 1]);
    const rightScale = useTransform(x, [-threshold, -threshold * 0.5, 0], [1, 0.8, 0.5]);

    const handleDragStart = useCallback(() => {
        setIsSwiping(true);
        onSwipeStart?.();
    }, [onSwipeStart]);

    const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsSwiping(false);
        onSwipeEnd?.();

        const { offset, velocity } = info;
        const swipe = offset.x + velocity.x * 0.2;

        if (swipe > threshold && leftAction) {
            leftAction.onAction();
        } else if (swipe < -threshold && rightAction) {
            rightAction.onAction();
        }
    }, [threshold, leftAction, rightAction, onSwipeEnd]);

    if (disabled || (!leftAction && !rightAction)) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div ref={constraintsRef} className={cn('relative overflow-hidden', className)}>
            {/* Left action background */}
            {leftAction && (
                <motion.div
                    className={cn('absolute inset-y-0 left-0 w-24 flex items-center justify-center', leftAction.bgColor)}
                    style={{ opacity: leftOpacity }}
                >
                    <motion.div style={{ scale: leftScale }} className={leftAction.color}>
                        {leftAction.icon}
                    </motion.div>
                </motion.div>
            )}

            {/* Right action background */}
            {rightAction && (
                <motion.div
                    className={cn('absolute inset-y-0 right-0 w-24 flex items-center justify-center', rightAction.bgColor)}
                    style={{ opacity: rightOpacity }}
                >
                    <motion.div style={{ scale: rightScale }} className={rightAction.color}>
                        {rightAction.icon}
                    </motion.div>
                </motion.div>
            )}

            {/* Swipeable content */}
            <motion.div
                drag="x"
                dragConstraints={{ left: rightAction ? -threshold * 1.2 : 0, right: leftAction ? threshold * 1.2 : 0 }}
                dragElastic={0.1}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                style={{ x }}
                className={cn(
                    'relative bg-white dark:bg-slate-800 touch-pan-y',
                    isSwiping && 'cursor-grabbing'
                )}
            >
                {children}
            </motion.div>
        </div>
    );
};

// Pre-configured swipeable ticket row
interface SwipeableTicketRowProps {
    children: React.ReactNode;
    onResolve?: () => void;
    onDelete?: () => void;
    onArchive?: () => void;
    className?: string;
}

export const SwipeableTicketRow: React.FC<SwipeableTicketRowProps> = ({
    children,
    onResolve,
    onDelete,
    onArchive,
    className,
}) => {
    const leftAction = onResolve ? {
        icon: <Check className="w-6 h-6" />,
        label: 'Resolve',
        color: 'text-white',
        bgColor: 'bg-green-500',
        onAction: onResolve,
    } : onArchive ? {
        icon: <Archive className="w-6 h-6" />,
        label: 'Archive',
        color: 'text-white',
        bgColor: 'bg-blue-500',
        onAction: onArchive,
    } : undefined;

    const rightAction = onDelete ? {
        icon: <Trash2 className="w-6 h-6" />,
        label: 'Delete',
        color: 'text-white',
        bgColor: 'bg-red-500',
        onAction: onDelete,
    } : undefined;

    return (
        <SwipeableRow
            leftAction={leftAction}
            rightAction={rightAction}
            className={className}
        >
            {children}
        </SwipeableRow>
    );
};

// Swipeable list item with reveal actions (iOS style)
interface SwipeRevealActionsProps {
    children: React.ReactNode;
    actions: Array<{
        icon: React.ReactNode;
        label: string;
        color: string;
        onClick: () => void;
    }>;
    className?: string;
}

export const SwipeRevealActions: React.FC<SwipeRevealActionsProps> = ({
    children,
    actions,
    className,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const x = useMotionValue(0);
    const actionWidth = actions.length * 64;

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.x < -50) {
            setIsOpen(true);
        } else if (info.offset.x > 50) {
            setIsOpen(false);
        }
    };

    return (
        <div className={cn('relative overflow-hidden', className)}>
            {/* Actions */}
            <div 
                className="absolute inset-y-0 right-0 flex"
                style={{ width: actionWidth }}
            >
                {actions.map((action, index) => (
                    <button
                        key={index}
                        onClick={() => {
                            action.onClick();
                            setIsOpen(false);
                        }}
                        className={cn(
                            'w-16 flex flex-col items-center justify-center gap-1',
                            action.color
                        )}
                    >
                        {action.icon}
                        <span className="text-[10px] font-medium">{action.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <motion.div
                drag="x"
                dragConstraints={{ left: -actionWidth, right: 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                animate={{ x: isOpen ? -actionWidth : 0 }}
                style={{ x }}
                className="relative bg-white dark:bg-slate-800"
            >
                {children}
            </motion.div>
        </div>
    );
};

export default SwipeableRow;
