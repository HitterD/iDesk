import { describe, it, expect } from 'vitest';
import {
    extractEventPayload,
    generateOutlookWebUrl,
    generateIcsString,
} from '../calendarExport';

describe('calendarExport utility', () => {
    const mockBooking = {
        id: 'booking-123',
        title: 'Daily Standup IT',
        description: 'Pembahasan sprint progress',
        bookingDate: '2026-09-10T00:00:00.000Z',
        startTime: '09:00',
        endTime: '10:00',
        meeting: {
            joinUrl: 'https://zoom.us/j/123456789',
            zoomMeetingId: '123456789',
            password: 'secretpasscode',
        },
    };

    it('extractEventPayload correctly extracts booking details', () => {
        const payload = extractEventPayload(mockBooking);
        expect(payload.id).toBe('booking-123');
        expect(payload.title).toBe('Daily Standup IT');
        expect(payload.date).toBe('2026-09-10');
        expect(payload.startTime).toBe('09:00');
        expect(payload.endTime).toBe('10:00');
        expect(payload.joinUrl).toBe('https://zoom.us/j/123456789');
        expect(payload.passcode).toBe('secretpasscode');
    });

    it('generateOutlookWebUrl creates valid deeplink with parameters', () => {
        const url = generateOutlookWebUrl(mockBooking);
        expect(url).toContain('https://outlook.office.com/calendar/0/deeplink/compose');
        expect(url).toContain('rru=addevent');
        expect(url).toContain('subject=Daily+Standup+IT');
        expect(url).toContain('startdt=2026-09-10T09%3A00%3A00%2B07%3A00');
        expect(url).toContain('enddt=2026-09-10T10%3A00%3A00%2B07%3A00');
        expect(url).toContain('location=https%3A%2F%2Fzoom.us%2Fj%2F123456789');
    });

    it('generateIcsString generates RFC 5545 compliant iCalendar string', () => {
        const ics = generateIcsString(mockBooking);
        expect(ics).toContain('BEGIN:VCALENDAR');
        expect(ics).toContain('VERSION:2.0');
        expect(ics).toContain('METHOD:REQUEST');
        expect(ics).toContain('BEGIN:VEVENT');
        expect(ics).toContain('SUMMARY:Daily Standup IT');
        expect(ics).toContain('DTSTART;TZID=Asia/Jakarta:20260910T090000');
        expect(ics).toContain('DTEND;TZID=Asia/Jakarta:20260910T100000');
        expect(ics).toContain('LOCATION:https://zoom.us/j/123456789');
        expect(ics).toContain('BEGIN:VALARM');
        expect(ics).toContain('TRIGGER:-PT15M');
        expect(ics).toContain('END:VALARM');
        expect(ics).toContain('END:VEVENT');
        expect(ics).toContain('END:VCALENDAR');
    });
});
