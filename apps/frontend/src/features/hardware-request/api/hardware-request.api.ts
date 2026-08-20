import { hrHttp } from './http';
import type {
    HardwareRequest, ListFilters, ApiEnvelope,
    ProcurementDecisionInput, ProcurementCompleteInput, HardwareRequestItem
} from '../types';

const unwrap = <T>(e: ApiEnvelope<T>) => { if (!e.success || e.data === undefined) throw new Error(e.error ?? 'API'); return e.data; };

export const HardwareRequestApi = {
    async list(params: ListFilters) {
        const r = await hrHttp.get<ApiEnvelope<HardwareRequest[]>>('/', { params });
        return { rows: unwrap(r.data), meta: r.data.meta };
    },
    async byId(id: string) {
        return unwrap((await hrHttp.get<ApiEnvelope<HardwareRequest>>(`/${id}`)).data);
    },
    async create(payload: { recipientName?: string; justification: string; items: Array<{ catalogId: string; quantity: number; customFields?: Record<string, unknown>; notes?: string }> }) {
        return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>('/', payload)).data);
    },
    async update(id: string, payload: Partial<{ justification: string; recipientName: string; items: unknown[] }>) {
        return unwrap((await hrHttp.patch<ApiEnvelope<HardwareRequest>>(`/${id}`, payload)).data);
    },
    async submit(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/submit`)).data); },
    async cancel(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/cancel`)).data); },
    async review(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/review`)).data); },
    async approve(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/approve`)).data); },
    async reject(id: string, reason: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/reject`, { reason })).data); },
    async updateItem(id: string, itemId: string, payload: Partial<{ actualCost: number; vendor: string; invoiceNumber: string; invoiceDate: string; notes: string }>) {
        return unwrap((await hrHttp.patch<ApiEnvelope<unknown>>(`/${id}/items/${itemId}`, payload)).data);
    },
    async completeInstallation(id: string) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/install/complete`)).data); },
    async confirmInstallation(id: string, payload: { kind: 'ACCEPT_AS_IS' | 'REPORT_ISSUE', comments?: string }) { return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${id}/confirm-installation`, payload)).data); },
};

export async function decideProcurementItems(
    requestId: string,
    input: ProcurementDecisionInput,
): Promise<HardwareRequestItem[]> {
    const res = await hrHttp.post<ApiEnvelope<HardwareRequestItem[]>>(`/${requestId}/procurement/decision`, input);
    return unwrap(res.data);
}

export async function completeProcurement(
    requestId: string,
    input: ProcurementCompleteInput,
): Promise<HardwareRequest> {
    const res = await hrHttp.post<ApiEnvelope<HardwareRequest>>(`/${requestId}/procurement/complete`, input);
    return unwrap(res.data);
}
