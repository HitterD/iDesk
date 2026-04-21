import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Interval } from '@nestjs/schedule';
import { HealthService } from './health.service';

/**
 * WebSocket Gateway for real-time System Health updates
 * 
 * Events emitted:
 * - `health:update` - Full health status (every 5 seconds)
 * - `health:metrics` - System metrics only (CPU, RAM, Disk)
 * - `health:incident` - When a service status changes
 * 
 * Events subscribed:
 * - `health:subscribe` - Client joins health updates room
 * - `health:unsubscribe` - Client leaves health updates room
 */
@WebSocketGateway({
    namespace: '/health',
    cors: {
        origin: ['http://localhost:4050', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5050'],
        credentials: true,
    },
})
export class HealthGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger = new Logger('HealthGateway');
    private subscribedClients: Set<string> = new Set();
    private lastHealthStatus: any = null;

    constructor(
        @Inject(forwardRef(() => HealthService))
        private readonly healthService: HealthService,
    ) { }

    afterInit(server: Server) {
        this.logger.log('Health WebSocket Gateway initialized');
    }

    handleConnection(client: Socket) {
        this.logger.log(`Health client connected: ${client.id}`);
        this.updateWsClientCount();
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Health client disconnected: ${client.id}`);
        this.subscribedClients.delete(client.id);
        this.updateWsClientCount();
    }

    /**
     * Client subscribes to health updates
     */
    @SubscribeMessage('health:subscribe')
    handleSubscribe(@ConnectedSocket() client: Socket): void {
        this.subscribedClients.add(client.id);
        client.join('health-updates');
        this.logger.log(`Client ${client.id} subscribed to health updates`);

        // Send current health status immediately
        if (this.lastHealthStatus) {
            client.emit('health:update', this.lastHealthStatus);
        }
    }

    /**
     * Client unsubscribes from health updates
     */
    @SubscribeMessage('health:unsubscribe')
    handleUnsubscribe(@ConnectedSocket() client: Socket): void {
        this.subscribedClients.delete(client.id);
        client.leave('health-updates');
        this.logger.log(`Client ${client.id} unsubscribed from health updates`);
    }

    /**
     * Get current subscribers count
     */
    @SubscribeMessage('health:ping')
    handlePing(@ConnectedSocket() client: Socket): { subscribers: number; connected: boolean } {
        return {
            subscribers: this.subscribedClients.size,
            connected: true,
        };
    }

    /**
     * Broadcast health update every 5 seconds
     */
    @Interval(5000)
    async broadcastHealthUpdate(): Promise<void> {
        if (this.subscribedClients.size === 0) {
            // No subscribers, skip the check but update cached status periodically
            return;
        }

        try {
            const healthStatus = await this.healthService.getDetailedHealth();
            this.lastHealthStatus = healthStatus;

            // Check for incidents (status changes)
            this.checkAndEmitIncidents(healthStatus);

            // Emit full health update to all subscribers
            this.server.to('health-updates').emit('health:update', healthStatus);

            // Also emit just metrics for lightweight updates
            this.server.to('health-updates').emit('health:metrics', {
                timestamp: healthStatus.timestamp,
                system: healthStatus.system,
                infrastructure: healthStatus.infrastructure,
            });

            this.logger.debug(`Health update broadcasted to ${this.subscribedClients.size} clients`);
        } catch (error) {
            this.logger.error('Failed to broadcast health update', error);
        }
    }

    /**
     * Emit incident when service status changes
     */
    private checkAndEmitIncidents(healthStatus: any): void {
        const newIncidents = healthStatus.recentIncidents?.filter((incident: any) => {
            // Check if incident is from the last 10 seconds
            const incidentTime = new Date(incident.timestamp).getTime();
            const now = Date.now();
            return now - incidentTime < 10000;
        });

        if (newIncidents && newIncidents.length > 0) {
            for (const incident of newIncidents) {
                this.server.to('health-updates').emit('health:incident', incident);
                this.logger.warn(`Health incident emitted: ${incident.service} - ${incident.newStatus}`);
            }
        }
    }

    /**
     * Update WebSocket client count in health service
     */
    private async updateWsClientCount(): Promise<void> {
        try {
            const sockets = await this.server?.fetchSockets();
            const totalClients = sockets?.length || 0;
            this.healthService.setWsClientCount(totalClients);
        } catch {
            this.healthService.setWsClientCount(this.subscribedClients.size);
        }
    }

    /**
     * Force emit current health status (called from controller)
     */
    async forceEmit(): Promise<void> {
        const healthStatus = await this.healthService.getDetailedHealth();
        this.lastHealthStatus = healthStatus;
        this.server.to('health-updates').emit('health:update', healthStatus);
    }
}
