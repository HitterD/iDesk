import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export const AUTH_EVENT = {
    LOGIN_SUCCEEDED: 'auth.login.succeeded.v1',
    LOGIN_FAILED: 'auth.login.failed.v1',
    LOGOUT: 'auth.logout.v1',
    PASSWORD_CHANGED: 'auth.password.changed.v1',
    REFRESH_REUSED: 'auth.refresh.reused.v1',
} as const;

export interface AuthEventPayload {
    userId?: string;
    identifier?: string;
    role?: string;
    outcome?: string;
    reason?: string;
}

export interface AuthEventEmitter {
    emit(event: string, payload: AuthEventPayload): boolean;
}

@Injectable()
export class AuthEventPublisher implements AuthEventEmitter {
    private readonly logger = new Logger(AuthEventPublisher.name);

    constructor(private readonly eventEmitter: EventEmitter2) {}

    emit(event: string, payload: AuthEventPayload): boolean {
        try {
            return this.eventEmitter.emit(event, payload);
        } catch (error) {
            this.logger.warn(`Auth event ${event} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            return false;
        }
    }
}
