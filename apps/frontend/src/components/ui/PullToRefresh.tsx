import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
    className?: string;
    threshold?: number;
    disabled?: boolean;
    pullIndicator?: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
    onRefresh,
    children,
    className,
    threshold = 80,
    disabled = false,
    pullIndicator,
}) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);

    const pullDistance = useMotionValue(0);
    const pullProgress = useTransform(pullDistance, [0, threshold], [0, 1]);
    const iconRotation = useTransform(pullDistance, [0, threshold], [0, 180]);
    const indicatorOpacity = useTransform(pullDistance, [0, threshold * 0.3], [0, 1]);

    const canPull = useCallback(() => {
        if (disabled || isRefreshing) return false;
        const container = containerRef.current;
        if (!container) return false;
        return container.scrollTop <= 0;
    }, [disabled, isRefreshing]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!canPull()) return;
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
    }, [canPull]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling || !canPull()) return;

        currentY.current = e.touches[0].clientY;
        const diff = currentY.current - startY.current;
        
        if (diff > 0) {
            // Apply resistance as pull increases
            const resistance = 0.5;
            const distance = Math.min(diff * resistance, threshold * 1.5);
            pullDistance.set(distance);
        }
    }, [isPulling, canPull, pullDistance, threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling) return;
        setIsPulling(false);

        const distance = pullDistance.get();
        
        if (distance >= threshold) {
            setIsRefreshing(true);
            pullDistance.set(threshold * 0.6); // Keep some height during refresh
            
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                pullDistance.set(0);
            }
        } else {
            pullDistance.set(0);
        }
    }, [isPulling, pullDistance, threshold, onRefresh]);

    // Handle mouse events for desktop testing
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!canPull()) return;
        startY.current = e.clientY;
        setIsPulling(true);
    }, [canPull]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPulling || !canPull()) return;

        currentY.current = e.clientY;
        const diff = currentY.current - startY.current;
        
        if (diff > 0) {
            const resistance = 0.5;
            const distance = Math.min(diff * resistance, threshold * 1.5);
            pullDistance.set(distance);
        }
    }, [isPulling, canPull, pullDistance, threshold]);

    const handleMouseUp = useCallback(() => {
        handleTouchEnd();
    }, [handleTouchEnd]);

    // Clean up mouse events when mouse leaves
    useEffect(() => {
        const handleMouseUpGlobal = () => {
            if (isPulling) {
                handleTouchEnd();
            }
        };

        window.addEventListener('mouseup', handleMouseUpGlobal);
        return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
    }, [isPulling, handleTouchEnd]);

    return (
        <div className={cn('relative overflow-hidden', className)}>
            {/* Pull indicator */}
            <motion.div
                className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
                style={{ 
                    height: pullDistance,
                    opacity: indicatorOpacity,
                }}
            >
                {pullIndicator || (
                    <motion.div
                        className={cn(
                            'flex items-center justify-center w-10 h-10 rounded-full',
                            'bg-white dark:bg-slate-800 shadow-lg',
                            'border border-slate-200 dark:border-slate-700'
                        )}
                    >
                        {isRefreshing ? (
                            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                        ) : (
                            <motion.div style={{ rotate: iconRotation }}>
                                <ArrowDown className="w-5 h-5 text-primary" />
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </motion.div>

            {/* Scrollable content */}
            <motion.div
                ref={containerRef}
                className="h-full overflow-y-auto"
                style={{ y: pullDistance }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            >
                {children}
            </motion.div>

            {/* Pull hint text */}
            <motion.div
                className="absolute top-2 left-0 right-0 text-center pointer-events-none"
                style={{ opacity: indicatorOpacity }}
            >
                <motion.span 
                    className="text-xs text-slate-500"
                    style={{ 
                        opacity: useTransform(pullProgress, [0, 0.8, 1], [1, 1, 0])
                    }}
                >
                    {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
                </motion.span>
                <motion.span 
                    className="text-xs text-primary font-medium"
                    style={{ 
                        opacity: useTransform(pullProgress, [0.8, 1], [0, 1])
                    }}
                >
                    Release to refresh
                </motion.span>
            </motion.div>
        </div>
    );
};

// Hook version for more control
export function usePullToRefresh(onRefresh: () => Promise<void>, options: { threshold?: number } = {}) {
    const { threshold = 80 } = options;
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
            setPullProgress(0);
        }
    }, [onRefresh]);

    return {
        isRefreshing,
        pullProgress,
        setPullProgress,
        threshold,
        handleRefresh,
    };
}

export default PullToRefresh;
