import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * WebSocket Gateway for real-time Zoom calendar updates
 * Handles room-based subscriptions per Zoom account
 */
@WebSocketGateway({
    namespace: '/zoom',
    cors: {
        origin: '*',
    },
})
export class ZoomGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger = new Logger('ZoomGateway');

    afterInit(server: Server) {
        this.logger.log('Zoom WebSocket Gateway initialized');
    }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    /**
     * Client subscribes to a specific Zoom account's calendar updates
     */
    @SubscribeMessage('subscribe:account')
    handleSubscribeAccount(client: Socket, accountId: string) {
        client.join(`zoom:account:${accountId}`);
        this.logger.debug(`Client ${client.id} subscribed to account ${accountId}`);
        return { success: true, room: `zoom:account:${accountId}` };
    }

    /**
     * Client unsubscribes from a Zoom account
     */
    @SubscribeMessage('unsubscribe:account')
    handleUnsubscribeAccount(client: Socket, accountId: string) {
        client.leave(`zoom:account:${accountId}`);
        this.logger.debug(`Client ${client.id} unsubscribed from account ${accountId}`);
        return { success: true };
    }

    /**
     * Broadcast booking created event to all clients watching the account
     */
    emitBookingCreated(accountId: string, booking: any) {
        this.server.to(`zoom:account:${accountId}`).emit('booking:created', booking);
        // Also emit global event for calendar refresh
        this.server.emit('calendar:updated', { accountId, action: 'created' });
    }

    /**
     * Broadcast booking cancelled event
     */
    emitBookingCancelled(accountId: string, bookingId: string, reason?: string) {
        this.server.to(`zoom:account:${accountId}`).emit('booking:cancelled', { bookingId, reason });
        this.server.emit('calendar:updated', { accountId, action: 'cancelled' });
    }

    /**
     * Broadcast booking updated event
     */
    emitBookingUpdated(accountId: string, booking: any) {
        this.server.to(`zoom:account:${accountId}`).emit('booking:updated', booking);
        this.server.emit('calendar:updated', { accountId, action: 'updated' });
    }

    /**
     * Broadcast settings changed (blocked dates, working hours)
     */
    emitSettingsChanged() {
        this.server.emit('settings:updated', { timestamp: new Date().toISOString() });
    }

    /**
     * Broadcast sync completed event
     */
    emitSyncCompleted(updatedCount: number) {
        this.server.emit('sync:completed', { updatedCount, timestamp: new Date().toISOString() });
    }
}
