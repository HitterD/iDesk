import { describe, expect, it } from 'vitest';
import { currentStep, requesterTodo, staffTodo, statusSentence } from '../hardwareFlow';

describe('hardware flow on a ticket', () => {
    it('folds request statuses into the short step bar', () => {
        expect(currentStep('HARDWARE_INSTALLATION', 'DRAFT')).toBe(0);
        expect(currentStep('HARDWARE_INSTALLATION', 'INSTALLATION')).toBe(1);
        expect(currentStep('BUDGET_ANNUAL', 'AWAITING_DELIVERY')).toBe(2);
        expect(currentStep('NON_BUDGET', 'COMPLETED')).toBe(5);
        expect(currentStep('BUDGET_ANNUAL', 'REJECTED')).toBe(-1);
    });

    it('says what the installation is waiting for, and who answers', () => {
        const base = { requestType: 'HARDWARE_INSTALLATION' as const, status: 'INSTALLATION' as const, requesterId: 'u-1' };
        const slots = { id: 's-1', start: null, end: null, proposedById: 'ict-1', slots: [{ start: 'a', end: 'b' }] };
        expect(statusSentence({ ...base, schedule: null })).toBe('Menunggu jadwal pemasangan');
        // ICT offered several slots: the requester picks one.
        expect(statusSentence({ ...base, schedule: { ...slots, status: 'PROPOSED_AWAITING_USER' } })).toBe('Pilih jadwal pemasangan');
        expect(requesterTodo({ ...base, schedule: { ...slots, status: 'PROPOSED_AWAITING_USER' } })).toBe('Pilih jadwal');
        // ICT moved the installation to one new time: the requester confirms it.
        expect(requesterTodo({ ...base, schedule: { ...slots, status: 'PROPOSED' } })).toBe('Konfirmasi jadwal');
        // The requester proposed the time themselves: ICT answers, nothing for the requester.
        expect(requesterTodo({ ...base, schedule: { ...slots, status: 'PROPOSED', proposedById: 'u-1' } })).toBeNull();
        expect(requesterTodo({ status: 'APPROVED', schedule: null })).toBeNull();
    });

    it('tells the agent in the ticket what ICT does next', () => {
        expect(staffTodo({ requestType: 'BUDGET_ANNUAL', status: 'SUBMITTED', schedule: null })).toBe('Review usulan');
        expect(staffTodo({ requestType: 'HARDWARE_INSTALLATION', status: 'SUBMITTED', schedule: null })).toBe('Jadwalkan pemasangan');
        expect(staffTodo({ requestType: 'HARDWARE_INSTALLATION', status: 'INSTALLATION', schedule: { start: 'x', status: 'CONFIRMED' } })).toBe('Selesaikan pemasangan');
        expect(staffTodo({ requestType: 'HARDWARE_INSTALLATION', status: 'AWAITING_USER_CONFIRMATION', schedule: null })).toBeNull();
    });
});
