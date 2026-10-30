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
import { buildWsCorsOrigin } from '../../shared/security/ws-origin';

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
export function buildHealthCorsOrigin() {
    return buildWsCorsOrigin('Health WebSocket origin not allowed');
}

@WebSocketGateway({
    namespace: '/health',
    cors: {
        origin: buildHealthCorsOrigin(),
        credentials: true,
    },
})
export class HealthGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger = new Logger('HealthGateway');
    private subscribedClients: Set<string> = new Set();
    private messagesSent = 0;
    private messagesReceived = 0;
    private initializedAt = Date.now();

    constructor(
        @Inject(forwardRef(() => HealthService))
        private readonly healthService: HealthService,
        @Inject(forwardRef(() => HealthSamplerService))
        private readonly healthSampler: HealthSamplerService,
    ) { }

    hasSubscribers(): boolean {
        return this.subscribedClients.size > 0;
    }

    pushFast(update: HealthFastUpdate): void {
        this.messagesSent++;
        this.server?.to('health-updates').emit('health:fast', update);
    }

    pushSlow(update: HealthSlowUpdate): void {
        this.messagesSent++;
        this.server?.to('health-updates').emit('health:slow', update);
    }

    pushIncident(incident: SystemIncident): void {
        this.messagesSent++;
        this.server?.to('health-updates').emit('health:incident', incident);
    }

    pushTrace(trace: any): void {
        this.messagesSent++;
        this.server?.to('health-updates').emit('telemetry:trace', trace);
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
        this.messagesReceived++;
        this.subscribedClients.add(client.id);
        client.join('health-updates');
        this.logger.log(`Client ${client.id} subscribed to health updates`);
        // The fast tier pauses without subscribers, so refresh before sending the first snapshot.
        void this.healthSampler.ensureFreshFastTier()
            .then(() => client.emit('health:snapshot', this.healthSampler.getSnapshot()));
    }

    /**
     * Client unsubscribes from health updates
     */
    @SubscribeMessage('health:unsubscribe')
    handleUnsubscribe(@ConnectedSocket() client: Socket): void {
        this.messagesReceived++;
        this.subscribedClients.delete(client.id);
        client.leave('health-updates');
        this.logger.log(`Client ${client.id} unsubscribed from health updates`);
    }

    /**
     * Client triggers on-demand full health refresh
     */
    @SubscribeMessage('health:force-refresh')
    async handleForceRefresh(@ConnectedSocket() client: Socket): Promise<{ status: string; timestamp: string }> {
        this.messagesReceived++;
        this.logger.log(`Client ${client.id} requested on-demand force refresh`);
        await this.healthSampler.forceRefresh();
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Get current telemetry and subscribers count with live ping
     */
    @SubscribeMessage('health:ping')
    handlePing(@ConnectedSocket() client: Socket): {
        subscribers: number;
        connected: boolean;
        serverTime: string;
        transport: string;
        uptimeSeconds: number;
        messagesSent: number;
        messagesReceived: number;
        throughputPerSec: number;
        activeRooms: string[];
    } {
        this.messagesReceived++;
        const uptimeSec = Math.max(1, Math.round((Date.now() - this.initializedAt) / 1000));
        const throughput = parseFloat(((this.messagesSent + this.messagesReceived) / uptimeSec).toFixed(2));
        const transportName = (client as any)?.conn?.transport?.name || 'websocket';

        return {
            subscribers: this.subscribedClients.size,
            connected: true,
            serverTime: new Date().toISOString(),
            transport: transportName,
            uptimeSeconds: uptimeSec,
            messagesSent: this.messagesSent,
            messagesReceived: this.messagesReceived,
            throughputPerSec: throughput,
            activeRooms: Array.from(client.rooms),
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

