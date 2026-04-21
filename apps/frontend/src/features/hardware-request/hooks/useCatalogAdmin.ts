import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CatalogApi } from '../api/catalog.api';
import type { HardwareCatalog } from '../types';

export function useCatalogAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['catalog', 'admin'],
    queryFn: () => CatalogApi.list(),
    staleTime: 5 * 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['catalog'] });
  };

  const create = useMutation({ mutationFn: CatalogApi.create, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<HardwareCatalog> }) =>
      CatalogApi.update(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: CatalogApi.remove, onSuccess: invalidate });

  return { items: list.data ?? [] as HardwareCatalog[], isLoading: list.isLoading, create, update, remove };
}
