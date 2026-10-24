import { describe, expect, it } from 'vitest';
import { currentStep, requesterTodo, statusSentence } from '../hardwareFlow';

describe('hardware flow on a ticket', () => {
    it('folds request statuses into the short step bar', () => {
        expect(currentStep('HARDWARE_INSTALLATION', 'DRAFT')).toBe(0);
        expect(currentStep('HARDWARE_INSTALLATION', 'INSTALLATION')).toBe(1);
        expect(currentStep('BUDGET_ANNUAL', 'AWAITING_DELIVERY')).toBe(2);
        expect(currentStep('NON_BUDGET', 'COMPLETED')).toBe(5);
        expect(currentStep('BUDGET_ANNUAL', 'REJECTED')).toBe(-1);
    });

    it('says what the installation is waiting for', () => {
        const base = { requestType: 'HARDWARE_INSTALLATION' as const, status: 'INSTALLATION' as const };
        expect(statusSentence({ ...base, schedule: null })).toBe('Menunggu jadwal pemasangan');
        expect(statusSentence({ ...base, schedule: { start: null, end: null, status: 'PROPOSED' } })).toBe('Pilih jadwal pemasangan');
        expect(requesterTodo({ status: 'INSTALLATION', schedule: { start: null, end: null, status: 'PROPOSED' } })).toBe('Pilih jadwal');
        expect(requesterTodo({ status: 'APPROVED', schedule: null })).toBeNull();
    });
});
