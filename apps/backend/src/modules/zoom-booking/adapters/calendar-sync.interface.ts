/**
 * Interface for Calendar Sync Adapters
 * Supports Google Calendar and Outlook Calendar integration
 */

export interface CalendarEvent {
    id?: string;
    externalId?: string; // ID from external calendar (Google/Outlook)
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendees?: CalendarAttendee[];
    meetingLink?: string;
    conferenceData?: {
        type: 'zoom' | 'meet' | 'teams';
        joinUrl?: string;
        meetingId?: string;
        password?: string;
    };
    metadata?: Record<string, any>;
}

export interface CalendarAttendee {
    email: string;
    name?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
    organizer?: boolean;
}

export interface SyncResult {
    success: boolean;
    externalEventId?: string;
    error?: string;
}

export interface CalendarSyncAdapter {
    /**
     * Get adapter name
     */
    getName(): string;

    /**
     * Check if adapter is configured and ready
     */
    isConfigured(): boolean;

    /**
     * Create event in external calendar
     */
    createEvent(event: CalendarEvent): Promise<SyncResult>;

    /**
     * Update event in external calendar
     */
    updateEvent(externalId: string, event: CalendarEvent): Promise<SyncResult>;

    /**
     * Delete event from external calendar
     */
    deleteEvent(externalId: string): Promise<SyncResult>;

    /**
     * Get events from external calendar
     */
    getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]>;

    /**
     * Sync events bidirectionally
     */
    syncEvents(startDate: Date, endDate: Date): Promise<{
        synced: number;
        errors: string[];
    }>;
}
