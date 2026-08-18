import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RateLimiter } from '../../../../shared/core/utils/rate-limiter';
import { UserRole } from '../../../users/enums/user-role.enum';
import { TicketRepository } from '../../repositories/ticket.repository';
import { assertTicketRoleAccess } from '../../services/ticket-oracle-access';

const ACCESS_COOKIE_NAME = 'access_token';

/** Connections per resolved client IP per minute. Sized for NAT/proxy-shared IPs and multi-tab clients. */
const MAX_CONNECTIONS_PER_WINDOW = 30;
/** Inbound events per socket per minute. Keyed per socket, so one abuser cannot lock out an office. */
const MAX_MESSAGES_PER_WINDOW = 60;
const RATE_LIMIT_WINDOW_MS = 60000;

/**
 * Extract a cookie value from a raw `Cookie` header.
 * Mirrors the HTTP-side extractor in jwt.strategy.ts without pulling in a
 * transitive dependency that is not declared in package.json.
 */
export function readCookie(header: string | undefined, name: string): string | undefined {
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator === -1) continue;
        if (part.slice(0, separator).trim() !== name) continue;
        try {
            return decodeURIComponent(part.slice(separator + 1).trim()) || undefined;
        } catch {
            return part.slice(separator + 1).trim() || undefined;
        }
    }
    return undefined;
}

/**
 * Resolve the originating client IP for rate limiting.
 * `X-Forwarded-For` is only honoured when TRUST_PROXY is enabled, because the
 * header is client-controlled on a directly exposed deployment.
 */
export function resolveClientIp(handshake: { address?: string; headers?: Record<string, unknown> }): string {
    const directAddress = handshake.address || 'unknown';
    if (process.env.TRUST_PROXY !== 'true') return directAddress;
    const forwarded = handshake.headers?.['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof raw !== 'string') return directAddress;
    const clientIp = raw.split(',')[0]?.trim();
    return clientIp || directAddress;
}

export function buildCorsOrigin() {
    return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = (process.env.WS_CORS_ORIGIN || process.env.FRONTEND_URL || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        if (process.env.NODE_ENV !== 'production') {
            allowedOrigins.push('http://localhost:4050', 'http://localhost:3000', 'http://localhost:5173');
        }
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('WebSocket origin not allowed'), false);
    };
}

@WebSocketGateway({
    cors: { origin: buildCorsOrigin(), credentials: true },
})
export class EventsGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('EventsGateway');
    // Map to store socketId -> userId
    private connectedUsers: Map<string, string> = new Map();

    // Rate limiters for connection abuse prevention
    private connectionLimiter = new RateLimiter(MAX_CONNECTIONS_PER_WINDOW, RATE_LIMIT_WINDOW_MS);
    private messageLimiter = new RateLimiter(MAX_MESSAGES_PER_WINDOW, RATE_LIMIT_WINDOW_MS);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly ticketRepository: TicketRepository,
    ) {
        // Clean up rate limiter entries periodically
        // RateLimiter cleanup occurs on demand; gateway must not keep Jest/process alive.
    }

    afterInit(server: Server) {
        this.logger.log('EventsGateway Initialized with rate limiting');
    }

    handleDisconnect(client: Socket) {
        // Release the per-socket message budget so the map does not grow unbounded.
        this.messageLimiter.reset(client.id);
        const userId = this.connectedUsers.get(client.id);
        if (userId) {
            this.connectedUsers.delete(client.id);
            // Check if user has other active connections
            const isStillOnline = this.isUserOnline(userId);
            if (!isStillOnline) {
                this.server.emit('user:offline', { userId });
                this.logger.log(`User offline: ${userId}`);
            }
        }
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    handleConnection(client: Socket) {
        const clientIp = resolveClientIp(client.handshake);
        if (!this.connectionLimiter.isAllowed(clientIp)) {
            client.emit('error', { message: 'Connection rate limit exceeded. Try again later.' });
            client.disconnect(true);
            return;
        }

        try {
            // Browsers cannot set headers on a WebSocket handshake, so the HttpOnly
            // access_token cookie is the primary credential for in-app clients.
            const token = readCookie(client.handshake.headers?.cookie, ACCESS_COOKIE_NAME)
                || client.handshake.auth?.token
                || client.handshake.headers?.authorization?.split(' ')[1]
                || client.handshake.query?.token;
            if (!token) throw new Error('Missing token');
            const payload = this.jwtService.verify<{ sub: string; role: UserRole; fullName?: string }>(token, {
                secret: this.configService.get('JWT_SECRET'),
            });
            if (!payload.sub || !payload.role) throw new Error('Invalid claims');
            client.data.userId = payload.sub;
            client.data.role = payload.role;
            client.data.fullName = payload.fullName;
            client.data.clientIp = clientIp;
            const wasOnline = this.isUserOnline(payload.sub);
            this.connectedUsers.set(client.id, payload.sub);
            client.join(`user:${payload.sub}`);
            // Mirror handleDisconnect: one event per user, not per tab.
            if (!wasOnline) {
                this.server.emit('user:online', { userId: payload.sub });
            }
        } catch {
            this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
            client.disconnect(true);
        }
    }

    private isUserOnline(userId: string): boolean {
        for (const connectedUserId of this.connectedUsers.values()) {
            if (connectedUserId === userId) return true;
        }
        return false;
    }

    /**
     * Helper to check message rate limit.
     * Keyed per socket so one noisy client cannot exhaust the budget of everyone
     * sharing its NAT or reverse-proxy address.
     * @returns true if allowed, false if rate limited
     */
    private checkMessageRateLimit(client: Socket): boolean {
        if (!this.messageLimiter.isAllowed(client.id)) {
            this.logger.warn(`Message rate limit exceeded for socket: ${client.id}`);
            client.emit('error', { message: 'Message rate limit exceeded. Slow down.' });
            return false;
        }

        return true;
    }


    @SubscribeMessage('identify')
    handleIdentify(@ConnectedSocket() client: Socket, @MessageBody() userId?: string) {
        const authenticatedUserId = client.data.userId as string | undefined;
        if (!authenticatedUserId || (userId && userId !== authenticatedUserId)) {
            return { status: 'error', message: 'Unauthorized' };
        }
        if (!this.checkMessageRateLimit(client)) {
            return { status: 'error', message: 'Rate limited' };
        }
        const onlineUserIds = Array.from(new Set(this.connectedUsers.values()));
        client.emit('users:online', onlineUserIds);
        return { status: 'ok', userId: authenticatedUserId };
    }

    @SubscribeMessage('typing:start')
    handleTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId?: unknown; user?: unknown }) {
        const ticketId = this.authorizedTypingTicket(client, data?.ticketId);
        if (!ticketId) return { status: 'error', message: 'Forbidden' };
        client.to(`ticket:${ticketId}`).emit('typing:start', {
            ticketId,
            user: { fullName: client.data.fullName || 'User' },
            socketId: client.id,
        });
        return { status: 'ok' };
    }

    @SubscribeMessage('typing:stop')
    handleTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId?: unknown }) {
        const ticketId = this.authorizedTypingTicket(client, data?.ticketId);
        if (!ticketId) return { status: 'error', message: 'Forbidden' };
        client.to(`ticket:${ticketId}`).emit('typing:stop', {
            ticketId,
            socketId: client.id,
        });
        return { status: 'ok' };
    }

    private authorizedTypingTicket(client: Socket, rawTicketId: unknown): string | undefined {
        if (typeof rawTicketId !== 'string' || !rawTicketId.trim() || !client.data.userId) return undefined;
        const ticketId = rawTicketId.trim();
        return client.rooms?.has(`ticket:${ticketId}`) ? ticketId : undefined;
    }

    // Join a ticket room for real-time updates
    @SubscribeMessage('join:ticket')
    async handleJoinTicket(@ConnectedSocket() client: Socket, @MessageBody() ticketId: string) {
        const userId = client.data.userId as string | undefined;
        const role = client.data.role as UserRole | undefined;
        if (!userId || !ticketId || !role) return { status: 'error', message: 'Unauthorized' };
        // Throttled before the DB round-trip: this handler is the only one that queries.
        if (!this.checkMessageRateLimit(client)) return { status: 'error', message: 'Rate limited' };
        const ticket = await this.ticketRepository.findById(ticketId, ['user', 'assignedTo']);
        if (!ticket) return { status: 'error', message: 'Not found' };
        if (role === UserRole.USER && ticket.userId !== userId) return { status: 'error', message: 'Forbidden' };
        try {
            assertTicketRoleAccess(ticket, role);
        } catch {
            return { status: 'error', message: 'Forbidden' };
        }
        client.join(`ticket:${ticketId}`);
        return { status: 'ok', room: `ticket:${ticketId}` };
    }

    // Leave a ticket room
    @SubscribeMessage('leave:ticket')
    handleLeaveTicket(@ConnectedSocket() client: Socket, @MessageBody() ticketId: string) {
        if (!client.data.userId || !ticketId) return { status: 'error', message: 'Unauthorized' };
        client.leave(`ticket:${ticketId}`);
        return { status: 'ok', room: `ticket:${ticketId}` };
    }

    // Notify all clients about ticket update
    notifyTicketUpdate(ticketId: string, data: any) {
        this.server.emit('ticket:updated', { ticketId, ...data });
        this.server.to(`ticket:${ticketId}`).emit('ticket:updated', { ticketId, ...data });
    }

    // Notify about new message in a ticket
    notifyNewMessage(ticketId: string, message: any) {
        this.server.to(`ticket:${ticketId}`).emit('ticket:newMessage', { ticketId, message });
        this.logger.log(`Emitted new message to ticket:${ticketId}`);
    }

    // Notify about ticket status change
    notifyStatusChange(ticketId: string, status: string, updatedBy: string) {
        this.server.to(`ticket:${ticketId}`).emit('ticket:statusChanged', { ticketId, status, updatedBy });
        this.server.emit('tickets:statusChanged', { ticketId, status });
    }

    // Notify about ticket reassignment
    notifyTicketAssigned(ticketId: string, assigneeId: string) {
        this.server.emit('ticket:assigned', { ticketId, assigneeId });
        this.server.to(`ticket:${ticketId}`).emit('ticket:assigned', { ticketId, assigneeId });
    }

    // Notify about ticket priority change
    notifyPriorityChanged(ticketId: string, priority: string) {
        this.server.emit('ticket:priority_changed', { ticketId, priority });
        this.server.to(`ticket:${ticketId}`).emit('ticket:priority_changed', { ticketId, priority });
    }

    // Notify all clients about any ticket list changes
    notifyTicketListUpdate() {
        this.server.emit('tickets:listUpdated');
    }

    // Notify about new ticket created (for admin/agent real-time sync)
    notifyNewTicket(ticket: any) {
        this.server.emit('ticket:created', ticket);
        this.server.emit('tickets:listUpdated');
        this.logger.log(`Emitted new ticket: ${ticket.id}`);
    }

    // Notify dashboard to update stats
    notifyDashboardStatsUpdate() {
        this.server.emit('dashboard:stats:update');
        this.logger.log('Emitted dashboard stats update');
    }

    // Join admin/agent notification room
    @SubscribeMessage('join:admin')
    handleJoinAdmin(@ConnectedSocket() client: Socket) {
        const role = client.data.role as UserRole | undefined;
        if (![UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER].includes(role as UserRole)) {
            return { status: 'error', message: 'Forbidden' };
        }
        client.join('admin:notifications');
        return { status: 'ok', room: 'admin:notifications' };
    }

    // Notify admins about important events
    notifyAdmins(event: string, data: any) {
        this.server.to('admin:notifications').emit(event, data);
        this.server.emit(event, data); // Also broadcast globally for all admins
    }
}
