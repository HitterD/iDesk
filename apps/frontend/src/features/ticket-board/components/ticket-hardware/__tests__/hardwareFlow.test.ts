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

    it('counts the arriving items and tells ICT when the installation can be scheduled', () => {
        const base = { requestType: 'BUDGET_ANNUAL' as const, status: 'AWAITING_DELIVERY' as const, schedule: null };
        expect(statusSentence({ ...base, delivery: { arrived: 1, total: 3 } })).toBe('Menunggu barang datang (1/3)');
        expect(staffTodo({ ...base, delivery: { arrived: 1, total: 3 } })).toBe('Catat barang datang');
        expect(statusSentence({ ...base, delivery: { arrived: 3, total: 3 } })).toBe('Barang lengkap, menunggu jadwal pemasangan');
        expect(staffTodo({ ...base, delivery: { arrived: 3, total: 3 } })).toBe('Jadwalkan pemasangan');
        // An older response without counts keeps the plain wording.
        expect(statusSentence(base)).toBe('Menunggu barang datang');
        expect(staffTodo(base)).toBe('Catat barang datang');
    });

    it('sends a reported problem back to ICT with a next step, not a dead end', () => {
        const done = { requestType: 'HARDWARE_INSTALLATION' as const, status: 'INSTALLATION' as const, schedule: { start: '2026-11-13T02:00:00Z', status: 'DONE' } };
        expect(statusSentence(done)).toBe('Masalah dilaporkan, menunggu jadwal perbaikan');
        expect(staffTodo(done)).toBe('Jadwalkan perbaikan');
        // The requester has nothing to answer until ICT proposes a new time.
        expect(requesterTodo(done)).toBeNull();
        // Asking for another time is the same hand-back, already worded.
        const asked = { ...done, schedule: { start: '2026-11-13T02:00:00Z', status: 'RESCHEDULE_REQUESTED' } };
        expect(statusSentence(asked)).toBe('Pemohon minta jadwal lain');
        expect(staffTodo(asked)).toBe('Atur jadwal pemasangan');
    });

    it('tells the agent in the ticket what ICT does next', () => {
        expect(staffTodo({ requestType: 'BUDGET_ANNUAL', status: 'SUBMITTED', schedule: null })).toBe('Review usulan');
        expect(staffTodo({ requestType: 'HARDWARE_INSTALLATION', status: 'SUBMITTED', schedule: null })).toBe('Jadwalkan pemasangan');
        expect(staffTodo({ requestType: 'HARDWARE_INSTALLATION', status: 'INSTALLATION', schedule: { start: 'x', status: 'CONFIRMED' } })).toBe('Selesaikan pemasangan');
        expect(staffTodo({ requestType: 'HARDWARE_INSTALLATION', status: 'AWAITING_USER_CONFIRMATION', schedule: null })).toBeNull();
    });
});
