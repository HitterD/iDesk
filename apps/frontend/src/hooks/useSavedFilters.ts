import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { generateId } from '@/lib/utils';

export interface SavedFilter {
    id: string;
    name: string;
    filters: {
        status?: string[];
        priority?: string[];
        assignee?: string[];
        category?: string[];
        search?: string;
        dateRange?: {
            start: string;
            end: string;
        };
    };
    isDefault?: boolean;
    createdAt: string;
    updatedAt: string;
}

interface UseSavedFiltersOptions {
    storageKey?: string;
    maxFilters?: number;
}

export function useSavedFilters(options: UseSavedFiltersOptions = {}) {
    const { 
        storageKey = 'ticket-saved-filters',
        maxFilters = 10 
    } = options;

    const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
    const [currentFilter, setCurrentFilter] = useState<SavedFilter | null>(null);

    // Load filters from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                setSavedFilters(parsed);
                
                // Auto-apply default filter
                const defaultFilter = parsed.find((f: SavedFilter) => f.isDefault);
                if (defaultFilter) {
                    setCurrentFilter(defaultFilter);
                }
            }
        } catch (error) {
            console.error('Failed to load saved filters:', error);
        }
    }, [storageKey]);

    // Save filters to localStorage
    const persistFilters = useCallback((filters: SavedFilter[]) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(filters));
        } catch (error) {
            console.error('Failed to save filters:', error);
        }
    }, [storageKey]);

    // Create a new filter
    const createFilter = useCallback((
        name: string, 
        filters: SavedFilter['filters'],
        isDefault?: boolean
    ) => {
        if (savedFilters.length >= maxFilters) {
            toast.error(`Maximum of ${maxFilters} saved filters allowed`);
            return null;
        }

        const existingNames = savedFilters.map(f => f.name.toLowerCase());
        if (existingNames.includes(name.toLowerCase())) {
            toast.error('A filter with this name already exists');
            return null;
        }

        const newFilter: SavedFilter = {
            id: generateId(),
            name,
            filters,
            isDefault: isDefault || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // If this is default, remove default from others
        let updatedFilters = savedFilters;
        if (isDefault) {
            updatedFilters = savedFilters.map(f => ({ ...f, isDefault: false }));
        }

        const newFilters = [...updatedFilters, newFilter];
        setSavedFilters(newFilters);
        persistFilters(newFilters);
        toast.success(`Filter "${name}" saved`);
        
        return newFilter;
    }, [savedFilters, maxFilters, persistFilters]);

    // Update an existing filter
    const updateFilter = useCallback((
        id: string,
        updates: Partial<Pick<SavedFilter, 'name' | 'filters' | 'isDefault'>>
    ) => {
        const index = savedFilters.findIndex(f => f.id === id);
        if (index === -1) {
            toast.error('Filter not found');
            return false;
        }

        let updatedFilters = [...savedFilters];
        
        // If setting as default, remove default from others
        if (updates.isDefault) {
            updatedFilters = updatedFilters.map(f => ({ ...f, isDefault: false }));
        }

        updatedFilters[index] = {
            ...updatedFilters[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        setSavedFilters(updatedFilters);
        persistFilters(updatedFilters);
        toast.success('Filter updated');
        
        return true;
    }, [savedFilters, persistFilters]);

    // Delete a filter
    const deleteFilter = useCallback((id: string) => {
        const filter = savedFilters.find(f => f.id === id);
        if (!filter) {
            toast.error('Filter not found');
            return false;
        }

        const newFilters = savedFilters.filter(f => f.id !== id);
        setSavedFilters(newFilters);
        persistFilters(newFilters);
        
        if (currentFilter?.id === id) {
            setCurrentFilter(null);
        }
        
        toast.success(`Filter "${filter.name}" deleted`);
        return true;
    }, [savedFilters, currentFilter, persistFilters]);

    // Apply a filter
    const applyFilter = useCallback((filter: SavedFilter | null) => {
        setCurrentFilter(filter);
        if (filter) {
            toast.success(`Applied filter: ${filter.name}`);
        }
    }, []);

    // Clear current filter
    const clearFilter = useCallback(() => {
        setCurrentFilter(null);
    }, []);

    // Set a filter as default
    const setDefault = useCallback((id: string) => {
        return updateFilter(id, { isDefault: true });
    }, [updateFilter]);

    // Get filter values for UI
    const getFilterValues = useCallback(() => {
        if (!currentFilter) return null;
        return currentFilter.filters;
    }, [currentFilter]);

    return {
        savedFilters,
        currentFilter,
        createFilter,
        updateFilter,
        deleteFilter,
        applyFilter,
        clearFilter,
        setDefault,
        getFilterValues,
        hasFilters: savedFilters.length > 0,
        canAddMore: savedFilters.length < maxFilters,
    };
}

export default useSavedFilters;
