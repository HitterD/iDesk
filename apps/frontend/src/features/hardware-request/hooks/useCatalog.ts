import { useQuery } from '@tanstack/react-query';
import { CatalogApi } from '../api/catalog.api';
import type { ItemCategory } from '../types';

export const useCatalog = (params?: { category?: ItemCategory; active?: boolean }) =>
    useQuery({
        queryKey: ['catalog', params ?? {}],
        queryFn: () => CatalogApi.list(params),
        staleTime: 5 * 60_000,
    });
