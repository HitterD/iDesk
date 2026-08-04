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
    private connectionLimiter = new RateLimiter(5, 60000); // 5 connections per minute per IP
    private messageLimiter = new RateLimiter(30, 60000); // 30 messages per minute per IP

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
        const userId = this.connectedUsers.get(client.id);
        if (userId) {
            this.connectedUsers.delete(client.id);
            // Check if user has other active connections
            const isStillOnline = Array.from(this.connectedUsers.values()).includes(userId);
            if (!isStillOnline) {
                this.server.emit('user:offline', { userId });
                this.logger.log(`User offline: ${userId}`);
            }
        }
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    handleConnection(client: Socket) {
        const clientIp = client.handshake.address || 'unknown';
        if (!this.connectionLimiter.isAllowed(clientIp)) {
            client.emit('error', { message: 'Connection rate limit exceeded. Try again later.' });
            client.disconnect(true);
            return;
        }

        try {
            const token = client.handshake.auth?.token
                || client.handshake.headers?.authorization?.split(' ')[1]
                || client.handshake.query?.token;
            if (!token) throw new Error('Missing token');
            const payload = this.jwtService.verify<{ sub: string; role: UserRole }>(token, {
                secret: this.configService.get('JWT_SECRET'),
            });
            if (!payload.sub || !payload.role) throw new Error('Invalid claims');
            client.data.userId = payload.sub;
            client.data.role = payload.role;
            client.data.clientIp = clientIp;
            this.connectedUsers.set(client.id, payload.sub);
            client.join(`user:${payload.sub}`);
            this.server.emit('user:online', { userId: payload.sub });
        } catch {
            this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
            client.disconnect(true);
        }
    }

    /**
     * Helper to check message rate limit
     * @returns true if allowed, false if rate limited
     */
    private checkMessageRateLimit(client: Socket): boolean {
        const clientIp = client.data.clientIp || client.handshake.address || 'unknown';

        if (!this.messageLimiter.isAllowed(clientIp)) {
            this.logger.warn(`Message rate limit exceeded for IP: ${clientIp}`);
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
        const onlineUserIds = Array.from(new Set(this.connectedUsers.values()));
        client.emit('users:online', onlineUserIds);
        return { status: 'ok', userId: authenticatedUserId };
    }

    @SubscribeMessage('typing:start')
    handleTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string; user: { fullName: string } }) {
        client.to(`ticket:${data.ticketId}`).emit('typing:start', {
            ticketId: data.ticketId,
            user: data.user,
            socketId: client.id
        });
    }

    @SubscribeMessage('typing:stop')
    handleTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
        client.to(`ticket:${data.ticketId}`).emit('typing:stop', {
            ticketId: data.ticketId,
            socketId: client.id
        });
    }

    // Join a ticket room for real-time updates
    @SubscribeMessage('join:ticket')
    async handleJoinTicket(@ConnectedSocket() client: Socket, @MessageBody() ticketId: string) {
        const userId = client.data.userId as string | undefined;
        const role = client.data.role as UserRole | undefined;
        if (!userId || !ticketId || !role) return { status: 'error', message: 'Unauthorized' };
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
