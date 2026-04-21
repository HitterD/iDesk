import { hrHttp } from './http';
import type { HardwareCatalog, ApiEnvelope, ItemCategory } from '../types';
const unwrap = <T>(e: ApiEnvelope<T>) => { if (!e.success) throw new Error(e.error ?? 'API error'); return e.data as T; };

export const CatalogApi = {
    async list(params?: { category?: ItemCategory; active?: boolean }) {
        return unwrap((await hrHttp.get<ApiEnvelope<HardwareCatalog[]>>('/catalog', { params })).data);
    },
    async create(payload: Omit<HardwareCatalog, 'id' | 'active' | 'displayOrder'> & { displayOrder?: number }) {
        return unwrap((await hrHttp.post<ApiEnvelope<HardwareCatalog>>('/catalog', payload)).data);
    },
    async update(id: string, payload: Partial<HardwareCatalog>) {
        return unwrap((await hrHttp.patch<ApiEnvelope<HardwareCatalog>>(`/catalog/${id}`, payload)).data);
    },
    async remove(id: string) {
        return unwrap((await hrHttp.delete<ApiEnvelope<HardwareCatalog>>(`/catalog/${id}`)).data);
    },
};
