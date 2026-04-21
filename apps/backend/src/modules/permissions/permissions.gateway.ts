import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * WebSocket Gateway for real-time Permission updates (FI-8)
 * 
 * Events emitted:
 * - `permissions:presetChanged` - When a user's preset is changed
 * 
 * Events subscribed:
 * - `permissions:join` - Client joins their user room
 * - `permissions:leave` - Client leaves their user room
 * 
 * Usage:
 * 1. Client connects and sends `permissions:join` with userId
 * 2. When preset is applied, server emits `permissions:presetChanged` to that user's room
 * 3. Client receives event and refreshes permissions from API
 */
@WebSocketGateway({
    namespace: '/permissions',
    cors: {
        origin: ['http://localhost:4050', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5050'],
        credentials: true,
    },
})
export class PermissionsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger = new Logger('PermissionsGateway');
    private connectedUsers: Map<string, string> = new Map(); // socketId -> userId

    afterInit(server: Server) {
        this.logger.log('Permissions WebSocket Gateway initialized');
    }

    handleConnection(client: Socket) {
        this.logger.log(`Permissions client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Permissions client disconnected: ${client.id}`);
        this.connectedUsers.delete(client.id);
    }

    /**
     * Client joins their user-specific room
     */
    @SubscribeMessage('permissions:join')
    handleJoin(@ConnectedSocket() client: Socket, @MessageBody() userId: string): void {
        if (!userId) {
            this.logger.warn(`Client ${client.id} tried to join without userId`);
            return;
        }

        client.join(`user:${userId}`);
        this.connectedUsers.set(client.id, userId);
        this.logger.log(`Client ${client.id} joined room user:${userId}`);

        // Acknowledge join
        client.emit('permissions:joined', { userId, success: true });
    }

    /**
     * Client leaves their user-specific room
     */
    @SubscribeMessage('permissions:leave')
    handleLeave(@ConnectedSocket() client: Socket): void {
        const userId = this.connectedUsers.get(client.id);
        if (userId) {
            client.leave(`user:${userId}`);
            this.connectedUsers.delete(client.id);
            this.logger.log(`Client ${client.id} left room user:${userId}`);
        }
    }

    /**
     * Notify a specific user that their preset has changed
     * Called from PermissionsService.applyPresetToUser()
     */
    notifyPresetChange(userId: string, presetId: string, presetName: string): void {
        const roomName = `user:${userId}`;

        this.server.to(roomName).emit('permissions:presetChanged', {
            userId,
            presetId,
            presetName,
            timestamp: new Date().toISOString(),
            message: 'Your permissions have been updated',
        });

        this.logger.log(`Notified user ${userId} of preset change to "${presetName}"`);
    }

    /**
     * Get count of connected permission listeners
     */
    getConnectedCount(): number {
        return this.connectedUsers.size;
    }
}
