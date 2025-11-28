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

@WebSocketGateway({
    cors: {
        origin: ['http://localhost:4050', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5050'],
        credentials: true,
    },
})
export class EventsGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('EventsGateway');
    // Map to store socketId -> userId
    private connectedUsers: Map<string, string> = new Map();

    afterInit(server: Server) {
        this.logger.log('EventsGateway Initialized');
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
        this.logger.log(`Client connected: ${client.id}`);
        // Note: Actual authentication and userId mapping happens in 'identify' event or via query params
        // For now, we rely on a manual 'identify' message from client
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
