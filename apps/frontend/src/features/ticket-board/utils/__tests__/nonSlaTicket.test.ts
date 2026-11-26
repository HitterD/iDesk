import { describe, expect, it } from 'vitest';
import {
    describeNonSlaStage,
    elapsedDaysSince,
    formatShortWibDate,
    isNonSlaTicket,
} from '../nonSlaTicket';

describe('isNonSlaTicket', () => {
    it('returns true for isNonSla flag, requestKind, HARDWARE_REQUEST, and EFORM_REQUEST', () => {
        expect(isNonSlaTicket({ isNonSla: true })).toBe(true);
        expect(isNonSlaTicket({ requestKind: 'HARDWARE' })).toBe(true);
        expect(isNonSlaTicket({ requestKind: 'EFORM' })).toBe(true);
        expect(isNonSlaTicket({ ticketType: 'HARDWARE_REQUEST' })).toBe(true);
        expect(isNonSlaTicket({ ticketType: 'EFORM_REQUEST' })).toBe(true);
    });

    it('returns false for ordinary or null tickets', () => {
        expect(isNonSlaTicket(null)).toBe(false);
        expect(isNonSlaTicket(undefined)).toBe(false);
        expect(isNonSlaTicket({ ticketType: 'SERVICE', requestKind: null, isNonSla: false })).toBe(false);
    });
});

describe('formatShortWibDate', () => {
    it('formats valid ISO date in short WIB id-ID format and returns null on invalid input', () => {
        const formatted = formatShortWibDate('2026-12-03T02:00:00.000Z');
        expect(formatted).toContain('Des');
        expect(formatted).toContain('3');
        expect(formatShortWibDate('invalid-date')).toBeNull();
    });
});

describe('elapsedDaysSince', () => {
    const now = new Date('2026-11-26T12:00:00.000Z');

    it('floors whole days and clamps future dates to 0', () => {
        expect(elapsedDaysSince('2026-11-26T10:00:00.000Z', now)).toBe(0);
        expect(elapsedDaysSince('2026-11-18T11:00:00.000Z', now)).toBe(8);
        expect(elapsedDaysSince('2026-11-28T12:00:00.000Z', now)).toBe(0);
        expect(elapsedDaysSince(null, now)).toBeNull();
    });
});

describe('describeNonSlaStage', () => {
    const now = new Date('2026-11-26T12:00:00.000Z');

    it('handles RESOLVED/CLOSED and CANCELLED states', () => {
        expect(describeNonSlaStage({ status: 'RESOLVED' }, now)).toMatchObject({
            top: 'Selesai',
            bottom: '',
            chipText: 'Selesai',
            isDone: true,
            isCancelled: false,
        });
        expect(describeNonSlaStage({ status: 'CLOSED' }, now).isDone).toBe(true);
        expect(describeNonSlaStage({ status: 'CANCELLED' }, now)).toMatchObject({
            top: 'Dibatalkan',
            bottom: '',
            chipText: 'Dibatalkan',
            isCancelled: true,
            isDone: false,
        });
    });

    it('prefers confirmed installation schedule over wait duration', () => {
        const res = describeNonSlaStage(
            {
                status: 'IN_PROGRESS',
                flowPhase: 'schedule',
                flowPhaseLabel: 'Menunggu jadwal',
                installScheduledAt: '2026-12-03T02:00:00.000Z',
            },
            now,
        );
        expect(res.top).toBe('Jadwal instalasi');
        expect(res.bottom).toContain('Des');
        expect(res.chipText).toMatch(/^Jadwal instalasi · /);
        expect(res.isScheduled).toBe(true);
        expect(res.isLong).toBe(false);
    });

    it('falls back to scheduledDate if installScheduledAt is absent', () => {
        const res = describeNonSlaStage({ status: 'TODO', scheduledDate: '2026-12-03T02:00:00.000Z' }, now);
        expect(res.isScheduled).toBe(true);
        expect(res.top).toBe('Jadwal instalasi');
    });

    it('marks waits <= 7 days normally and > 7 days as isLong with "· lama"', () => {
        const recent = describeNonSlaStage(
            { status: 'IN_PROGRESS', flowPhase: 'appr_gm', flowPhaseLabel: 'Menunggu GM', flowPhaseSince: '2026-11-21T12:00:00.000Z' },
            now,
        );
        expect(recent).toMatchObject({
            top: 'Menunggu GM',
            bottom: '5 hari',
            chipText: 'Menunggu GM · 5 hari',
            isLong: false,
        });

        const long = describeNonSlaStage(
            { status: 'IN_PROGRESS', flowPhase: 'appr_gm', flowPhaseLabel: 'Menunggu GM', flowPhaseSince: '2026-11-18T12:00:00.000Z' },
            now,
        );
        expect(long).toMatchObject({
            top: 'Menunggu GM',
            bottom: '8 hari · lama',
            chipText: 'Menunggu GM · 8 hari',
            isLong: true,
        });
    });

    it('uses short stage label "Pemasangan" in detail chip when flowPhase is schedule or install', () => {
        const res = describeNonSlaStage(
            { status: 'IN_PROGRESS', flowPhase: 'schedule', flowPhaseLabel: 'Penjadwalan instalasi', flowPhaseSince: '2026-11-26T09:00:00.000Z' },
            now,
        );
        expect(res.top).toBe('Penjadwalan instalasi');
        expect(res.bottom).toBe('Hari ini');
        expect(res.chipText).toBe('Pemasangan · Hari ini');
    });
});
