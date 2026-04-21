import { hrHttp } from './http';
import type { HardwareRequestActivity, ApiEnvelope } from '../types';
const unwrap = <T>(e: ApiEnvelope<T>) => { if (!e.success || e.data === undefined) throw new Error(e.error ?? 'API'); return e.data; };

export const ActivityApi = {
    async list(requestId: string) {
        return unwrap((await hrHttp.get<ApiEnvelope<HardwareRequestActivity[]>>(`/${requestId}/activity`)).data);
    },
};
