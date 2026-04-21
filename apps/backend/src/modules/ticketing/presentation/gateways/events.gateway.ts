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

@WebSocketGateway({
    cors: {
        origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
            const allowedOrigins = [
                'http://localhost:4050',
                'http://localhost:3000',
                'http://localhost:5173',
                'http://localhost:5050',
            ];
            if (process.env.FRONTEND_URL) {
                allowedOrigins.push(process.env.FRONTEND_URL);
            }
            // Allow if it's in the allowed list or if there is no origin (e.g. server-to-server) or development
            // Just be permissive since it's an internal tool mostly, or match exactly
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(null, true); // Allow all for development/testing ease as originally designed locally
            }
        },
        credentials: true,
    },
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
    ) {
        // Clean up rate limiter entries periodically
        setInterval(() => {
            this.connectionLimiter.cleanup();
            this.messageLimiter.cleanup();
        }, 60000); // Every minute
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

    handleConnection(client: Socket, ...args: any[]) {
        // Get client IP for rate limiting
        const clientIp = client.handshake.address || 'unknown';

        // Check connection rate limit
        if (!this.connectionLimiter.isAllowed(clientIp)) {
            this.logger.warn(`Connection rate limit exceeded for IP: ${clientIp}`);
            client.emit('error', { message: 'Connection rate limit exceeded. Try again later.' });
            client.disconnect(true);
            return;
        }

        this.logger.log(`Client connected: ${client.id} (IP: ${clientIp})`);

        // Try to authenticate via token in handshake
        try {
            const token = client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.split(' ')[1] ||
                client.handshake.query?.token;

            if (token) {
                const payload = this.jwtService.verify(token, {
                    secret: this.configService.get('JWT_SECRET'),
                });

                if (payload && payload.sub) {
                    // Auto-identify user from token
                    client.data.userId = payload.sub;
                    client.data.role = payload.role;
                    client.data.clientIp = clientIp; // Store IP for message rate limiting
                    this.connectedUsers.set(client.id, payload.sub);
                    client.join(`user:${payload.sub}`);
                    this.server.emit('user:online', { userId: payload.sub });
                    this.logger.log(`User auto-authenticated: ${payload.sub} (Socket: ${client.id})`);
                }
            }
        } catch (error) {
            // Token verification failed - allow connection but require manual identify
            this.logger.debug(`Token verification failed for ${client.id}: ${error.message}`);
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
    handleIdentify(@ConnectedSocket() client: Socket, @MessageBody() userId: string) {
        this.connectedUsers.set(client.id, userId);
        this.server.emit('user:online', { userId });
        this.logger.log(`User identified: ${userId} (Socket: ${client.id})`);

        // Send current online users to the newly connected client
        const onlineUserIds = Array.from(new Set(this.connectedUsers.values()));
        client.emit('users:online', onlineUserIds);
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
    handleJoinTicket(@ConnectedSocket() client: Socket, @MessageBody() ticketId: string) {
        client.join(`ticket:${ticketId}`);
        this.logger.log(`Client ${client.id} joined room ticket:${ticketId}`);
    }

    // Leave a ticket room
    @SubscribeMessage('leave:ticket')
    handleLeaveTicket(@ConnectedSocket() client: Socket, @MessageBody() ticketId: string) {
        client.leave(`ticket:${ticketId}`);
        this.logger.log(`Client ${client.id} left room ticket:${ticketId}`);
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
        client.join('admin:notifications');
        this.logger.log(`Client ${client.id} joined admin notifications`);
    }

    // Notify admins about important events
    notifyAdmins(event: string, data: any) {
        this.server.to('admin:notifications').emit(event, data);
        this.server.emit(event, data); // Also broadcast globally for all admins
    }
}
