import { describe, expect, it } from 'vitest';
import { ACTIVE_STATUS_FILTER, DONE_STATUS_FILTER, statusFilterLabel } from '../statusFilters';

describe('status filters', () => {
    it('uses the API status lists verbatim', () => {
        expect(DONE_STATUS_FILTER).toBe('RESOLVED,CLOSED');
        expect(ACTIVE_STATUS_FILTER).toBe('TODO,IN_PROGRESS,WAITING_VENDOR');
    });

    it.each([
        ['RESOLVED,CLOSED', 'Selesai'],
        ['TODO,IN_PROGRESS,WAITING_VENDOR', 'Aktif'],
        ['TODO', 'Open'],
        ['IN_PROGRESS', 'In Progress'],
        ['WAITING_VENDOR', 'Waiting Vendor'],
        ['RESOLVED', 'Resolved'],
        ['CLOSED', 'Closed'],
        ['CANCELLED', 'Cancelled'],
        ['UNKNOWN', 'UNKNOWN'],
        ['', ''],
    ])('labels %s as %s', (value, label) => {
        expect(statusFilterLabel(value)).toBe(label);
    });
});
