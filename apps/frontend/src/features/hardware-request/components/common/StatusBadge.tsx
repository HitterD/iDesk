import { ResBub } from '@/components/resources/ResourceParts';
import { STATUS_BUB, getStatusMeta } from '../../utils/status.util';
import type { RequestStatus } from '../../types';

/** Mockup `.bub` status pill (hardware.html HW_STATUS hues). `size` is kept for callers; one size. */
export function StatusBadge({ status }: { status: RequestStatus; size?: 'sm' | 'md' | 'lg' }) {
    const bub = STATUS_BUB[status];
    if (!bub) return <ResBub color="var(--dash-gray)">{getStatusMeta(status).label}</ResBub>;
    return <ResBub color={bub.color} ink={bub.ink}>{bub.label}</ResBub>;
}
