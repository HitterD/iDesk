import { useState, useEffect } from 'react';

/**
 * Hook to debounce a value
 * Useful for search inputs to avoid excessive API calls
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Hook to get debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 300
): T {
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    const debouncedCallback = ((...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        const id = setTimeout(() => {
            callback(...args);
        }, delay);
        
        setTimeoutId(id);
    }) as T;

    useEffect(() => {
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [timeoutId]);

    return debouncedCallback;
}

export default useDebounce;
