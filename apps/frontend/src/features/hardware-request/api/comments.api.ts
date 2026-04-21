import { hrHttp } from './http';
import type { HardwareRequestComment, ApiEnvelope } from '../types';
const unwrap = <T>(e: ApiEnvelope<T>) => { if (!e.success || e.data === undefined) throw new Error(e.error ?? 'API'); return e.data; };

export const CommentsApi = {
    async list(requestId: string, page = 1, pageSize = 50) {
        const r = await hrHttp.get<ApiEnvelope<HardwareRequestComment[]>>(`/${requestId}/comments`, { params: { page, pageSize } });
        return { rows: unwrap(r.data), meta: r.data.meta };
    },
    async create(requestId: string, payload: { body: string; attachments?: unknown[] }) {
        return unwrap((await hrHttp.post<ApiEnvelope<HardwareRequestComment>>(`/${requestId}/comments`, payload)).data);
    },
    async update(requestId: string, commentId: string, body: string) {
        return unwrap((await hrHttp.patch<ApiEnvelope<HardwareRequestComment>>(`/${requestId}/comments/${commentId}`, { body })).data);
    },
    async remove(requestId: string, commentId: string) {
        return unwrap((await hrHttp.delete<ApiEnvelope<HardwareRequestComment>>(`/${requestId}/comments/${commentId}`)).data);
    },
};
