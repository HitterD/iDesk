import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface ZoomTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface ZoomRecurrenceRequest {
    type: 1 | 2 | 3; // 1: Daily, 2: Weekly, 3: Monthly
    repeat_interval: number;
    weekly_days?: string; // 1: Sunday, 2: Monday, ..., 7: Saturday
    monthly_day?: number;
    monthly_week?: number;
    monthly_week_day?: number;
    end_times?: number;
    end_date_time?: string; // UTC ISO string e.g. 2026-09-30T23:59:59Z
}

export interface ZoomMeetingOccurrence {
    occurrence_id: string;
    start_time: string;
    duration: number;
    status: string;
}

export interface ZoomMeetingRequest {
    topic: string;
    type: 2 | 8; // 2: Scheduled meeting, 8: Recurring meeting with fixed time
    start_time: string;
    duration: number;
    timezone: string;
    password?: string;
    agenda?: string;
    recurrence?: ZoomRecurrenceRequest;
    settings?: {
        host_video?: boolean;
        participant_video?: boolean;
        join_before_host?: boolean;
        mute_upon_entry?: boolean;
        waiting_room?: boolean;
        auto_recording?: 'none' | 'local' | 'cloud';
    };
}

export interface ZoomMeetingResponse {
    id: number;
    host_id: string;
    host_email: string;
    topic: string;
    type: number;
    status: string;
    start_time: string;
    duration: number;
    timezone: string;
    created_at: string;
    start_url: string;
    join_url: string;
    password: string;
    h323_password: string;
    pmi: number;
    settings: Record<string, any>;
    occurrences?: ZoomMeetingOccurrence[];
}

interface ZoomUserResponse {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    type: number;
    status: string;
}

export interface ZoomMeetingListItem {
    id: number;
    topic: string;
    type: number;
    start_time: string;
    duration: number;
    timezone: string;
    created_at: string;
    join_url: string;
    host_id: string;
    agenda?: string;
}

/** Safety bound: 20 x 100 meetings per host is far beyond real usage. */
const MAX_MEETING_PAGES = 20;

export interface ZoomMeetingListResponse {
    page_count: number;
    page_number: number;
    page_size: number;
    total_records: number;
    next_page_token?: string;
    meetings: ZoomMeetingListItem[];
}

export interface ZoomRecordingFile {
    id: string;
    meeting_id: string;
    recording_start: string;
    recording_end: string;
    file_type: string;
    file_extension?: string;
    file_size: number;
    play_url?: string;
    download_url?: string;
    status: string;
    recording_type: string;
}

export interface ZoomRecordingResponse {
    id: number | string;
    uuid: string;
    account_id: string;
    host_id: string;
    topic: string;
    start_time: string;
    duration: number;
    total_size: number;
    recording_count: number;
    share_url: string;
    recording_play_passcode?: string;
    recording_files?: ZoomRecordingFile[];
}

@Injectable()
export class ZoomApiAdapter implements OnModuleInit {
    private readonly logger = new Logger(ZoomApiAdapter.name);
    private axiosInstance: AxiosInstance;
    private accessToken: string | null = null;
    private tokenExpiresAt: Date | null = null;
    private recordingScopeAvailable: boolean = true;

    private readonly accountId: string;
    private readonly clientId: string;
    private readonly clientSecret: string;

    constructor(private readonly configService: ConfigService) {
        this.accountId = this.configService.get<string>('ZOOM_ACCOUNT_ID', '');
        this.clientId = this.configService.get<string>('ZOOM_CLIENT_ID', '');
        this.clientSecret = this.configService.get<string>('ZOOM_CLIENT_SECRET', '');

        this.axiosInstance = axios.create({
            baseURL: 'https://api.zoom.us/v2',
            timeout: 30000,
        });
    }

    /**
     * Check if Zoom cloud recording scopes are available on current credentials
     */
    isRecordingScopeAvailable(): boolean {
        return this.recordingScopeAvailable;
    }

    async onModuleInit() {
        // Lazy initialization - don't make network calls during startup
        // Token will be refreshed on first API request
        if (this.accountId && this.clientId && this.clientSecret) {
            this.logger.log('Zoom API adapter configured (lazy initialization - token will refresh on first use)');
        } else {
            this.logger.warn('Zoom credentials not configured. Zoom features will be disabled.');
        }
    }

    /**
     * Get valid access token, refreshing if necessary (Server-to-Server OAuth)
     */
    private async getAccessToken(): Promise<string> {
        // Check if token exists and is still valid (with 5-minute buffer)
        if (this.accessToken && this.tokenExpiresAt) {
            const now = new Date();
            const bufferTime = 5 * 60 * 1000; // 5 minutes
            if (this.tokenExpiresAt.getTime() - bufferTime > now.getTime()) {
                return this.accessToken;
            }
        }

        return this.refreshAccessToken();
    }

    /**
     * Refresh access token using Server-to-Server OAuth
     */
    private async refreshAccessToken(): Promise<string> {
        const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.accountId}`;
        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        try {
            const response = await axios.post<ZoomTokenResponse>(
                tokenUrl,
                null,
                {
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);
            this.recordingScopeAvailable = true; // Reset on token refresh to allow re-checking if new scopes were granted

            this.logger.debug('Zoom access token refreshed successfully');
            return this.accessToken;
        } catch (error: any) {
            this.logger.error('Failed to refresh Zoom access token', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Zoom API');
        }
    }

    /**
     * Sleep helper for retry delay
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Make authenticated request to Zoom API with exponential backoff retry
     */
    private async request<T>(
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
        endpoint: string,
        data?: any,
        retries: number = 3,
        options?: { suppressErrorLog?: boolean },
    ): Promise<T> {
        const token = await this.getAccessToken();

        try {
            const response = await this.axiosInstance.request<T>({
                method,
                url: endpoint,
                data,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error: any) {
            const status = error.response?.status;
            const errorData = error.response?.data;
            const errorMessage = errorData ? (typeof errorData === 'object' ? JSON.stringify(errorData) : errorData) : error.message;

            // Retry on rate limit (429) or server errors (5xx)
            if ((status === 429 || (status >= 500 && status < 600)) && retries > 0) {
                const delay = Math.pow(2, 3 - retries) * 1000; // 1s, 2s, 4s
                this.logger.warn(`Zoom API ${status} error, retrying in ${delay}ms... (${retries} retries left)`);
                await this.sleep(delay);
                return this.request<T>(method, endpoint, data, retries - 1, options);
            }

            if (!options?.suppressErrorLog) {
                this.logger.error(`Zoom API error: ${method} ${endpoint} - ${errorMessage}`);
            }
            throw error;
        }
    }

    /**
     * Check if error is a Zoom scope/permission error
     */
    isScopeError(error: any): boolean {
        const message = error.response?.data?.message || error.message || '';
        return message.includes('does not contain scopes');
    }

    /**
     * Get Zoom user by email
     */
    async getZoomUser(email: string): Promise<ZoomUserResponse | null> {
        try {
            return await this.request<ZoomUserResponse>('GET', `/users/${email}`);
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }

    /**
     * List all users in the Zoom account
     */
    async listZoomUsers(): Promise<ZoomUserResponse[]> {
        const response = await this.request<{ users: ZoomUserResponse[] }>('GET', '/users');
        return response.users;
    }

    /**
     * Create a scheduled meeting for a specific user
     */
    async createMeeting(
        hostEmail: string,
        topic: string,
        startTime: Date,
        durationMinutes: number,
        agenda?: string,
        recurrence?: ZoomRecurrenceRequest,
    ): Promise<ZoomMeetingResponse> {
        // Zoom API expects start_time in the specified timezone's LOCAL format
        // When timezone is 'Asia/Jakarta', we need to send the time as it appears in Jakarta
        // Format: YYYY-MM-DDTHH:mm:ss (NO Z suffix, NO timezone offset)

        // Extract Jakarta local time components from the Date object
        // The Date was created with +07:00 offset, so we need to format it as Jakarta time
        const jakartaOffset = 7 * 60 * 60 * 1000; // +7 hours in milliseconds
        const utcTime = startTime.getTime();
        const jakartaTime = new Date(utcTime + jakartaOffset);

        const year = jakartaTime.getUTCFullYear();
        const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(jakartaTime.getUTCDate()).padStart(2, '0');
        const hours = String(jakartaTime.getUTCHours()).padStart(2, '0');
        const minutes = String(jakartaTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(jakartaTime.getUTCSeconds()).padStart(2, '0');

        // Format: 2024-12-18T20:00:00 (Jakarta local time, no Z suffix)
        const formattedStartTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

        this.logger.log(`Zoom API createMeeting: topic=${topic}, start_time=${formattedStartTime}, timezone=Asia/Jakarta, recurring=${Boolean(recurrence)}`);

        const meetingRequest: ZoomMeetingRequest = {
            topic,
            type: recurrence ? 8 : 2, // 8: Recurring with fixed time, 2: Scheduled meeting
            start_time: formattedStartTime, // Local time in Jakarta timezone
            duration: durationMinutes,
            timezone: 'Asia/Jakarta',
            agenda,
            ...(recurrence ? { recurrence } : {}),
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true,
                mute_upon_entry: false,
                waiting_room: false,
                auto_recording: 'none',
            },
        };

        return this.request<ZoomMeetingResponse>('POST', `/users/${hostEmail}/meetings`, meetingRequest);
    }

    /**
     * Get meeting details
     */
    async getMeeting(meetingId: string | number): Promise<ZoomMeetingResponse> {
        return this.request<ZoomMeetingResponse>('GET', `/meetings/${meetingId}`);
    }

    /**
     * List meetings for a user
     */
    /**
     * All meetings of a host, following `next_page_token` (Zoom returns 100 per page). Callers
     * that delete "stale" rows must see every page, or meetings past page 1 look deleted.
     */
    async listMeetings(hostEmail: string, type: 'scheduled' | 'upcoming' | 'upcoming_meetings' = 'scheduled'): Promise<ZoomMeetingListResponse> {
        const base = `/users/${encodeURIComponent(hostEmail)}/meetings?type=${type}&page_size=100`;
        const first = await this.request<ZoomMeetingListResponse>('GET', base);
        const meetings = [...(first.meetings || [])];
        let token = first.next_page_token;
        for (let page = 1; token && page < MAX_MEETING_PAGES; page++) {
            const next = await this.request<ZoomMeetingListResponse>('GET', `${base}&next_page_token=${encodeURIComponent(token)}`);
            meetings.push(...(next.meetings || []));
            token = next.next_page_token;
        }
        if (token) throw new Error(`Zoom meeting list for ${hostEmail} exceeds ${MAX_MEETING_PAGES} pages`);
        return { ...first, meetings, next_page_token: undefined };
    }

    /**
     * Delete/Cancel a meeting (optionally a specific occurrence)
     */
    async deleteMeeting(meetingId: string | number, occurrenceId?: string): Promise<void> {
        const query = occurrenceId ? `?occurrence_id=${occurrenceId}` : '';
        await this.request<void>('DELETE', `/meetings/${meetingId}${query}`);
    }

    /**
     * Update a meeting (optionally a specific occurrence)
     */
    async updateMeeting(
        meetingId: string | number,
        updates: Partial<ZoomMeetingRequest>,
        occurrenceId?: string,
    ): Promise<void> {
        const query = occurrenceId ? `?occurrence_id=${occurrenceId}` : '';
        await this.request<void>('PATCH', `/meetings/${meetingId}${query}`, updates);
    }

    /**
     * Get cloud recordings for a meeting
     * Returns null if no recordings found (404) or if cloud recording scope is not granted (4711)
     */
    async getMeetingRecordings(meetingId: string | number): Promise<ZoomRecordingResponse | null> {
        if (!this.recordingScopeAvailable) {
            return null;
        }

        try {
            return await this.request<ZoomRecordingResponse>(
                'GET',
                `/meetings/${meetingId}/recordings`,
                undefined,
                3,
                { suppressErrorLog: true },
            );
        } catch (error: any) {
            if (error?.response?.status === 404 || error?.status === 404) {
                this.logger.debug(`No recordings found for meeting ${meetingId}`);
                return null;
            }

            if (this.isScopeError(error)) {
                if (this.recordingScopeAvailable) {
                    this.recordingScopeAvailable = false;
                    this.logger.warn(
                        'Zoom Server-to-Server OAuth credentials lack cloud recording scopes (cloud_recording:read:list_recording_files). Cloud recording synchronization is paused until token refresh or scope grant in Zoom Marketplace.',
                    );
                }
                return null;
            }

            const errorData = error.response?.data;
            const errorMessage = errorData ? (typeof errorData === 'object' ? JSON.stringify(errorData) : errorData) : error.message;
            this.logger.error(`Zoom API error: GET /meetings/${meetingId}/recordings - ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Check if Zoom credentials are configured
     */
    isConfigured(): boolean {
        return !!(this.accountId && this.clientId && this.clientSecret);
    }
}
