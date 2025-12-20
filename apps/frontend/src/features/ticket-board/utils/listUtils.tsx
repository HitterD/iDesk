import React, { useCallback, MouseEvent, ReactNode } from 'react';

/**
 * Animation delay configuration
 * These values are used to calculate staggered animation delays for list items
 */
export const ANIMATION_CONFIG = {
    /** Base delay per item in seconds */
    STAGGER_DELAY: 0.03,
    /** Maximum delay to prevent long waits for large lists */
    MAX_DELAY: 0.6,
    /** Whether to cap animation delay at MAX_DELAY */
    CAP_DELAY: true,
} as const;

/**
 * Calculate staggered animation delay for list items
 * @param index - The index of the item in the list
 * @param options - Optional configuration overrides
 * @returns CSS style object with animationDelay
 */
export function getStaggeredDelay(
    index: number,
    options?: {
        staggerDelay?: number;
        maxDelay?: number;
        capDelay?: boolean;
    }
): React.CSSProperties {
    const staggerDelay = options?.staggerDelay ?? ANIMATION_CONFIG.STAGGER_DELAY;
    const maxDelay = options?.maxDelay ?? ANIMATION_CONFIG.MAX_DELAY;
    const capDelay = options?.capDelay ?? ANIMATION_CONFIG.CAP_DELAY;

    let delay = index * staggerDelay;

    if (capDelay && delay > maxDelay) {
        delay = maxDelay;
    }

    return { animationDelay: `${delay}s` };
}

/**
 * Hook to create a click handler that stops propagation
 * Reduces boilerplate of onClick={(e) => e.stopPropagation()}
 */
export function useStopPropagation<T extends Element = HTMLDivElement>(
    onClick?: (e: MouseEvent<T>) => void
) {
    return useCallback(
        (e: MouseEvent<T>) => {
            e.stopPropagation();
            onClick?.(e);
        },
        [onClick]
    );
}

/**
 * Wrapper component that stops event propagation
 * Use this instead of inline onClick={(e) => e.stopPropagation()}
 */
interface StopPropagationWrapperProps {
    children: ReactNode;
    className?: string;
    onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export const StopPropagationWrapper: React.FC<StopPropagationWrapperProps> = ({
    children,
    className = '',
    onClick,
}) => {
    const handleClick = useStopPropagation(onClick);

    return (
        <div className= { className } onClick = { handleClick } >
            { children }
            </div>
    );
};

/**
 * Estimate item height for virtualization
 * Adjust these values based on actual rendered row heights
 */
export const ROW_HEIGHT_CONFIG = {
    /** Default row height in pixels (for desktop) */
    DESKTOP: 72,
    /** Row height for mobile view */
    MOBILE: 120,
    /** Minimum number of items before virtualization is beneficial */
    VIRTUALIZATION_THRESHOLD: 50,
} as const;

/**
 * Check if virtualization should be enabled based on item count
 */
export function shouldVirtualize(itemCount: number): boolean {
    return itemCount >= ROW_HEIGHT_CONFIG.VIRTUALIZATION_THRESHOLD;
}
