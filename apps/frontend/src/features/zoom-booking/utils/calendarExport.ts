import type { ZoomBooking } from '../types';

export interface CalendarEventPayload {
    id: string;
    title: string;
    description?: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime?: string; // HH:mm
    joinUrl?: string;
    passcode?: string;
    zoomMeetingId?: string;
}

export function extractEventPayload(booking: ZoomBooking | any): CalendarEventPayload {
    const rawDate = booking.bookingDate || booking.date;
    const dateStr = typeof rawDate === 'string'
        ? rawDate.split('T')[0]
        : new Date(rawDate || Date.now()).toISOString().split('T')[0];

    const joinUrl = booking.meeting?.joinUrl || booking.joinUrl;
    const passcode = booking.meeting?.password || booking.password;
    const zoomMeetingId = booking.meeting?.zoomMeetingId || booking.zoomMeetingId;

    return {
        id: booking.id || `booking-${Date.now()}`,
        title: booking.title || 'Zoom Meeting',
        description: booking.description,
        date: dateStr,
        startTime: booking.startTime || '09:00',
        endTime: booking.endTime || '10:00',
        joinUrl,
        passcode,
        zoomMeetingId,
    };
}

/**
 * Generate deep-link to compose event in Outlook Office 365 (Web)
 */
export function generateOutlookWebUrl(booking: ZoomBooking | any): string {
    const event = extractEventPayload(booking);
    const [startH, startM] = event.startTime.split(':').map(Number);
    const [endH, endM] = (event.endTime || '10:00').split(':').map(Number);

    const pad = (n: number) => n.toString().padStart(2, '0');
    // Format with timezone offset +07:00 for WIB
    const startIso = `${event.date}T${pad(startH)}:${pad(startM)}:00+07:00`;
    const endIso = `${event.date}T${pad(endH)}:${pad(endM)}:00+07:00`;

    const bodyText = [
        event.description ? `${event.description}\n\n` : '',
        event.joinUrl ? `Join Zoom: ${event.joinUrl}\n` : '',
        event.zoomMeetingId ? `Meeting ID: ${event.zoomMeetingId}\n` : '',
        event.passcode ? `Passcode: ${event.passcode}\n` : '',
    ].filter(Boolean).join('');

    const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: event.title,
        body: bodyText,
        startdt: startIso,
        enddt: endIso,
        location: event.joinUrl || 'Zoom Meeting',
    });

    return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Open Outlook Web in a new browser tab with event prefilled
 */
export function openOutlookWeb(booking: ZoomBooking | any): void {
    const url = generateOutlookWebUrl(booking);
    window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Generate iCalendar (RFC 5545) payload string
 */
export function generateIcsString(booking: ZoomBooking | any): string {
    const event = extractEventPayload(booking);
    const [year, month, day] = event.date.split('-').map(Number);
    const [startH, startM] = event.startTime.split(':').map(Number);
    const [endH, endM] = (event.endTime || '10:00').split(':').map(Number);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const dtStart = `${year}${pad(month)}${pad(day)}T${pad(startH)}${pad(startM)}00`;
    const dtEnd = `${year}${pad(month)}${pad(day)}T${pad(endH)}${pad(endM)}00`;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const cleanTitle = event.title.replace(/\r?\n/g, ' ');
    const descParts = [
        event.description ? `${event.description}\n\n` : '',
        event.joinUrl ? `Link Zoom: ${event.joinUrl}\n` : '',
        event.zoomMeetingId ? `Meeting ID: ${event.zoomMeetingId}\n` : '',
        event.passcode ? `Passcode: ${event.passcode}\n` : '',
    ].filter(Boolean).join('');
    const cleanDesc = descParts.replace(/\r?\n/g, '\\n');

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//iDesk//Zoom Booking Calendar//ID',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:zoom-booking-${event.id}@idesk.internal`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=Asia/Jakarta:${dtStart}`,
        `DTEND;TZID=Asia/Jakarta:${dtEnd}`,
        `SUMMARY:${cleanTitle}`,
        `DESCRIPTION:${cleanDesc}`,
        `LOCATION:${event.joinUrl || 'Zoom Meeting'}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Pengingat Meeting: ${cleanTitle}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
}

/**
 * Trigger immediate download of .ics file for Outlook Desktop or local calendar apps
 */
export function downloadIcsFile(booking: ZoomBooking | any): void {
    const icsContent = generateIcsString(booking);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timeClean = (booking.startTime || 'meeting').replace(':', '');
    a.download = `zoom-meeting-${timeClean}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
