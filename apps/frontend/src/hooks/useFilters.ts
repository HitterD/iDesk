/**
 * useFilters Hook
 * Generic hook for managing filter state across data lists
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from './useDebounce';

// ========================================
// Types
// ========================================

export interface FilterConfig<T extends Record<string, unknown>> {
    /** Initial filter values */
    initialFilters?: Partial<T>;
    /** Debounce delay for search input in milliseconds */
    debounceMs?: number;
    /** Sync filters to URL query params */
    syncUrl?: boolean;
    /** Keys to sync to URL (if undefined, all keys are synced) */
    urlKeys?: (keyof T)[];
}

export interface FilterActions<T extends Record<string, unknown>> {
    /** Current filter values */
    filters: T;
    /** Set a single filter value */
    setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
    /** Set multiple filter values at once */
    setFilters: (updates: Partial<T>) => void;
    /** Clear all filters to initial values */
    clearFilters: () => void;
    /** Clear a specific filter */
    clearFilter: <K extends keyof T>(key: K) => void;
    /** Check if any filter is active (different from initial) */
    hasActiveFilters: boolean;
    /** Count of active filters */
    activeFilterCount: number;
    /** Current search term (raw - not debounced) */
    searchTerm: string;
    /** Debounced search term for API queries */
    debouncedSearchTerm: string;
    /** Set search term */
    setSearchTerm: (term: string) => void;
    /** Toggle a value in an array filter (for multi-select) */
    toggleArrayFilter: <K extends keyof T>(key: K, value: T[K] extends (infer U)[] ? U : never) => void;
}

// ========================================
// Hook Implementation
// ========================================

export function useFilters<T extends Record<string, unknown>>(
    config: FilterConfig<T> = {}
): FilterActions<T> {
    const {
        initialFilters = {} as Partial<T>,
        debounceMs = 300,
        syncUrl = false,
        urlKeys,
    } = config;

    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize filters from URL or initial values
    const initializeFilters = useCallback((): T => {
        if (syncUrl) {
            const urlFilters: Partial<T> = {};
            const keysToCheck = urlKeys || (Object.keys(initialFilters) as (keyof T)[]);

            keysToCheck.forEach((key) => {
                const urlValue = searchParams.get(String(key));
                if (urlValue) {
                    try {
                        // Try to parse JSON for complex values
                        urlFilters[key] = JSON.parse(urlValue) as T[typeof key];
                    } catch {
                        // Use as string if not valid JSON
                        urlFilters[key] = urlValue as T[typeof key];
                    }
                }
            });

            return { ...initialFilters, ...urlFilters } as T;
        }
        return initialFilters as T;
    }, [initialFilters, searchParams, syncUrl, urlKeys]);

    const [filters, setFiltersState] = useState<T>(initializeFilters);
    const [searchTerm, setSearchTermState] = useState('');

    // Debounced search term
    const debouncedSearchTerm = useDebounce(searchTerm, debounceMs);

    // Sync to URL when syncUrl is enabled
    useEffect(() => {
        if (!syncUrl) return;

        const newParams = new URLSearchParams(searchParams);
        const keysToSync = urlKeys || (Object.keys(filters) as (keyof T)[]);

        keysToSync.forEach((key) => {
            const value = filters[key];
            const initialValue = initialFilters[key];

            if (value !== undefined && value !== initialValue) {
                const serialized = typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value);
                newParams.set(String(key), serialized);
            } else {
                newParams.delete(String(key));
            }
        });

        setSearchParams(newParams, { replace: true });
    }, [filters, syncUrl, urlKeys, initialFilters, searchParams, setSearchParams]);

    // Set a single filter
    const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setFiltersState((prev) => ({ ...prev, [key]: value }));
    }, []);

    // Set multiple filters
    const setFilters = useCallback((updates: Partial<T>) => {
        setFiltersState((prev) => ({ ...prev, ...updates }));
    }, []);

    // Clear all filters
    const clearFilters = useCallback(() => {
        setFiltersState(initialFilters as T);
        setSearchTermState('');
    }, [initialFilters]);

    // Clear a specific filter
    const clearFilter = useCallback(<K extends keyof T>(key: K) => {
        setFiltersState((prev) => ({
            ...prev,
            [key]: initialFilters[key],
        }));
    }, [initialFilters]);

    // Toggle a value in an array filter (for multi-select)
    const toggleArrayFilter = useCallback(<K extends keyof T>(
        key: K,
        value: T[K] extends (infer U)[] ? U : never
    ) => {
        setFiltersState((prev) => {
            const currentArray = (prev[key] as unknown[]) || [];
            const valueIndex = currentArray.indexOf(value);

            if (valueIndex === -1) {
                return { ...prev, [key]: [...currentArray, value] };
            } else {
                return { ...prev, [key]: currentArray.filter((_, i) => i !== valueIndex) };
            }
        });
    }, []);

    // Set search term
    const setSearchTerm = useCallback((term: string) => {
        setSearchTermState(term);
    }, []);

    // Calculate active filters
    const { hasActiveFilters, activeFilterCount } = useMemo(() => {
        let count = 0;

        Object.keys(filters).forEach((key) => {
            const currentValue = filters[key as keyof T];
            const initialValue = initialFilters[key as keyof T];

            if (currentValue !== initialValue) {
                if (Array.isArray(currentValue) && currentValue.length > 0) {
                    count++;
                } else if (!Array.isArray(currentValue) && currentValue !== undefined) {
                    count++;
                }
            }
        });

        if (searchTerm.trim()) {
            count++;
        }

        return {
            hasActiveFilters: count > 0,
            activeFilterCount: count,
        };
    }, [filters, initialFilters, searchTerm]);

    return {
        filters,
        setFilter,
        setFilters,
        clearFilters,
        clearFilter,
        hasActiveFilters,
        activeFilterCount,
        searchTerm,
        debouncedSearchTerm,
        setSearchTerm,
        toggleArrayFilter,
    };
}

export default useFilters;
