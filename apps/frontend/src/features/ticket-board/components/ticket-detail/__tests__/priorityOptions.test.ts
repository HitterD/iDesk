import { describe, it, expect } from 'vitest';
import { buildPriorityOptions } from '../constants';

describe('buildPriorityOptions', () => {
    // Agents get 403 on /sla-config, so the dropdown used to open with no items at all.
    it('lists every priority even when SLA configs are unavailable', () => {
        expect(buildPriorityOptions([]).map((o) => o.value)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
        expect(buildPriorityOptions([]).every((o) => o.slaHours === null)).toBe(true);
    });

    it('attaches SLA hours when a config exists for the priority', () => {
        const options = buildPriorityOptions([{ id: '1', priority: 'HIGH', resolutionTimeMinutes: 480 }]);

        expect(options.find((o) => o.value === 'HIGH')?.slaHours).toBe(8);
        expect(options.find((o) => o.value === 'LOW')?.slaHours).toBeNull();
    });
});
