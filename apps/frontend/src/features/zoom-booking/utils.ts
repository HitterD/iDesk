import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import type { ZoomBooking } from './types';

export const formatZoomAccountName = (name?: string): string => {
    if (!name) return 'Zoom';
    // Extracts "Zoom 1", "Zoom 2", etc. regardless of preceding or succeeding text
    const match = name.match(/zoom\s*\d+/i);
    if (match) {
        // Capitalize properly: "Zoom X"
        const text = match[0];
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    return name;
};

export const extractMeetingId = (url: string): string => {
    const match = url.match(/\/j\/(\d+)/);
    if (match && match[1]) {
        return match[1].replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
    }
    return 'N/A';
};

export const generateInvitationText = (booking: ZoomBooking): string => {
    const rawDate = typeof booking.bookingDate === 'string' ? booking.bookingDate.split('T')[0] : format(new Date(booking.bookingDate), 'yyyy-MM-dd');
    const formattedDate = format(parseISO(rawDate), 'EEEE, d MMMM yyyy', { locale: idLocale });
    const meetingId = booking.meeting?.zoomMeetingId || (booking.meeting?.joinUrl ? extractMeetingId(booking.meeting.joinUrl) : 'N/A');

    return `${booking.zoomAccount?.name || 'Zoom Admin'} is inviting you to a scheduled Zoom meeting.

Topic: ${booking.title}
Time: ${formattedDate} ${booking.startTime} - ${booking.endTime} WIB

Join Zoom Meeting
${booking.meeting?.joinUrl || 'Link belum tersedia'}

Meeting ID: ${meetingId}
${booking.meeting?.password ? `Passcode: ${booking.meeting.password}` : ''}`.trim();
};

/**
 * Universal clipboard copy helper working on both HTTP and HTTPS origins
 */
export const copyToClipboard = async (text: string, label: string = 'Teks'): Promise<boolean> => {
    try {
        let copied = false;

        // 1. Try modern async clipboard API first if available
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(text);
                copied = true;
            } catch {
                copied = false;
            }
        }

        // 2. Fallback for HTTP / non-secure contexts / focus-trapped dialogs
        if (!copied) {
            const container = (document.querySelector('[role="dialog"]') as HTMLElement) || document.body;
            const textArea = document.createElement("textarea");
            textArea.value = text;
            // Place inside active dialog container so Radix FocusScope trap permits focus
            textArea.style.position = "absolute";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            textArea.style.width = "1px";
            textArea.style.height = "1px";
            textArea.setAttribute("readonly", "");
            container.appendChild(textArea);

            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, text.length || 99999);

            try {
                copied = document.execCommand('copy');
            } catch {
                copied = false;
            }

            container.removeChild(textArea);
        }

        if (copied) {
            toast.success(`${label} disalin ke clipboard!`);
            return true;
        } else {
            throw new Error('Copy command failed');
        }
    } catch (err) {
        console.error('Failed to copy text: ', err);
        toast.error(`Gagal menyalin ${label.toLowerCase()}.`);
        return false;
    }
};
