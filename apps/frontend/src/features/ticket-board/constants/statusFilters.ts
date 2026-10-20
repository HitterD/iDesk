import { STATUS_CONFIG } from '../components/ticket-detail/constants';

export const DONE_STATUS_FILTER = 'RESOLVED,CLOSED';
export const ACTIVE_STATUS_FILTER = 'TODO,IN_PROGRESS,WAITING_VENDOR';

export const statusFilterLabel = (value: string): string => {
    if (value === DONE_STATUS_FILTER) return 'Selesai';
    if (value === ACTIVE_STATUS_FILTER) return 'Aktif';
    return STATUS_CONFIG[value]?.label ?? value;
};
