import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface ZoomTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

interface ZoomMeetingRequest {
    topic: string;
    type: 2; // Scheduled meeting
    start_time: string;
    duration: number;
    timezone: string;
    password?: string;
    agenda?: string;
    settings?: {
        host_video?: boolean;
        participant_video?: boolean;
        join_before_host?: boolean;
        mute_upon_entry?: boolean;
        waiting_room?: boolean;
        auto_recording?: 'none' | 'local' | 'cloud';
    };
}

interface ZoomMeetingResponse {
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
}

export interface ZoomMeetingListResponse {
    page_count: number;
    page_number: number;
    page_size: number;
    total_records: number;
    meetings: ZoomMeetingListItem[];
}

@Injectable()
export class ZoomApiAdapter implements OnModuleInit {
    private readonly logger = new Logger(ZoomApiAdapter.name);
    private axiosInstance: AxiosInstance;
    private accessToken: string | null = null;
    private tokenExpiresAt: Date | null = null;

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
            const errorMessage = error.response?.data?.message || error.message;

            // Retry on rate limit (429) or server errors (5xx)
            if ((status === 429 || (status >= 500 && status < 600)) && retries > 0) {
                const delay = Math.pow(2, 3 - retries) * 1000; // 1s, 2s, 4s
                this.logger.warn(`Zoom API ${status} error, retrying in ${delay}ms... (${retries} retries left)`);
                await this.sleep(delay);
                return this.request<T>(method, endpoint, data, retries - 1);
            }

            this.logger.error(`Zoom API error: ${method} ${endpoint} - ${errorMessage}`);
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

        this.logger.log(`Zoom API createMeeting: topic=${topic}, start_time=${formattedStartTime}, timezone=Asia/Jakarta`);

        const meetingRequest: ZoomMeetingRequest = {
            topic,
            type: 2, // Scheduled meeting
            start_time: formattedStartTime, // Local time in Jakarta timezone
            duration: durationMinutes,
            timezone: 'Asia/Jakarta',
            agenda,
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
    async listMeetings(hostEmail: string, type: 'scheduled' | 'upcoming' = 'upcoming'): Promise<ZoomMeetingListResponse> {
        return this.request<ZoomMeetingListResponse>('GET', `/users/${hostEmail}/meetings?type=${type}&page_size=100`);
    }

    /**
     * Delete/Cancel a meeting
     */
    async deleteMeeting(meetingId: string | number): Promise<void> {
        await this.request<void>('DELETE', `/meetings/${meetingId}`);
    }

    /**
     * Update a meeting
     */
    async updateMeeting(
        meetingId: string | number,
        updates: Partial<ZoomMeetingRequest>,
    ): Promise<void> {
        await this.request<void>('PATCH', `/meetings/${meetingId}`, updates);
    }

    /**
     * Check if Zoom credentials are configured
     */
    isConfigured(): boolean {
        return !!(this.accountId && this.clientId && this.clientSecret);
    }
}
