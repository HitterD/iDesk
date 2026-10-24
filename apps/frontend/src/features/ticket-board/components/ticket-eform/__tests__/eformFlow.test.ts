import { describe, expect, it } from 'vitest';
import { currentStep, flowSteps, staffTodo, statusSentence } from '../eformFlow';

describe('e-form access on a ticket', () => {
    it('shows the manager step only for types that need it', () => {
        expect(flowSteps('VPN').map((s) => s.label)).toEqual(['Tanda tangan pemohon', 'Persetujuan atasan', 'Proses ICT', 'Akses aktif']);
        expect(flowSteps('SYNOLOGY_NAS').map((s) => s.label)).toEqual(['Tanda tangan pemohon', 'Proses ICT', 'Akses aktif']);
    });

    it('places the request on its step, and off the bar once stopped', () => {
        expect(currentStep('VPN', 'PENDING_MANAGER')).toBe(1);
        expect(currentStep('SYNOLOGY_NAS', 'PENDING_ICT')).toBe(1);
        expect(currentStep('EMAIL', 'CONFIRMED')).toBe(3);
        expect(currentStep('VPN', 'REJECTED')).toBe(-1);
        expect(currentStep('VPN', 'CANCELLED')).toBe(-1);
    });

    it('says who it is waiting on', () => {
        expect(statusSentence({ status: 'PENDING_MANAGER', approverName: 'Rina' })).toBe('Menunggu persetujuan Rina');
        expect(statusSentence({ status: 'DRAFT', approverName: null })).toBe('Menunggu pemohon melengkapi & tanda tangan');
        expect(staffTodo({ status: 'PENDING_ICT' })).toBe('Proses akses');
        expect(staffTodo({ status: 'PENDING_MANAGER' })).toBeNull();
    });
});
