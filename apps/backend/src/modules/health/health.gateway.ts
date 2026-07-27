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
import { HealthFastUpdate, HealthSlowUpdate, SystemIncident } from './dto/health.dto';

import { HealthSamplerService } from './health-sampler.service';

/**
 * WebSocket Gateway for real-time System Health updates
 * 
 * Events emitted:
 * - `health:snapshot` - Full health status snapshot
 * - `health:fast` - Fast telemetry updates (2s)
 * - `health:slow` - Slow telemetry updates (30s)
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

    constructor(
        @Inject(forwardRef(() => HealthService))
        private readonly healthService: HealthService,
        @Inject(forwardRef(() => HealthSamplerService))
        private readonly healthSampler: HealthSamplerService,
    ) { }

    pushFast(update: HealthFastUpdate): void {
        this.server?.to('health-updates').emit('health:fast', update);
    }

    pushSlow(update: HealthSlowUpdate): void {
        this.server?.to('health-updates').emit('health:slow', update);
    }

    pushIncident(incident: SystemIncident): void {
        this.server?.to('health-updates').emit('health:incident', incident);
    }

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
        client.emit('health:snapshot', this.healthSampler.getSnapshot());
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
}

