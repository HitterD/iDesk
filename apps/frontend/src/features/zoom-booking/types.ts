// Zoom Booking Types

export interface ZoomAccount {
    id: string;
    name: string;
    email: string;
    zoomUserId?: string;
    accountType: 'MASTER' | 'SUB';
    displayOrder: number;
    colorHex: string;
    isActive: boolean;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ZoomBooking {
    id: string;
    zoomAccountId: string;
    zoomAccount?: ZoomAccount;
    bookedByUserId: string;
    bookedByUser?: {
        id: string;
        fullName: string;
        email: string;
    };
    title: string;
    description?: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
    cancellationReason?: string;
    cancelledByUserId?: string;
    cancelledAt?: string;
    meeting?: ZoomMeeting;
    bookedBy?: { // Alias for bookedByUser used in admin table
        id: string;
        fullName: string;
        email: string;
    };
    isExternal?: boolean;
    externalZoomMeetingId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ZoomMeeting {
    id: string;
    zoomBookingId: string;
    zoomMeetingId: string;
    joinUrl: string;
    startUrl: string;
    password?: string;
    hostEmail: string;
    createdAt: string;
}

export interface ZoomSettings {
    id: string;
    defaultDurationMinutes: number;
    advanceBookingDays: number;
    slotStartTime: string;
    slotEndTime: string;
    slotIntervalMinutes: number;
    blockedDates: string[];
    workingDays: number[];
    requireDescription: boolean;
    maxBookingPerUserPerDay: number;
    allowedDurations: number[];
    updatedAt: string;
}

// Public settings (available to all authenticated users)
export interface ZoomPublicSettings {
    slotStartTime: string;
    slotEndTime: string;
    slotIntervalMinutes: number;
    workingDays: number[];
    advanceBookingDays: number;
    allowedDurations: number[];
}

export interface CalendarSlot {
    date: string;
    time: string;
    endTime: string;
    status: 'available' | 'booked' | 'my_booking' | 'blocked' | 'external';
    booking?: {
        id: string;
        title: string;
        bookedBy: string;
        durationMinutes: number;
        startTime: string;
        endTime: string;
        isExternal?: boolean;
        joinUrl?: string;
    };
}

export interface CalendarDay {
    date: string;
    dayOfWeek: number;
    isWorkingDay: boolean;
    isBlocked: boolean;
    slots: CalendarSlot[];
}

export interface CreateBookingDto {
    zoomAccountId: string;
    title: string;
    description?: string;
    bookingDate: string;
    startTime: string;
    durationMinutes: number;
    participantEmails?: string[];
}

export interface CancelBookingDto {
    cancellationReason: string;
}
