import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { HR_EVT } from '../domain/events/hardware-request.events';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { WsAuthGuard } from './ws-auth.guard';
import { wsRoomAuthz } from './ws-room-authz';

function buildCorsOrigin() {
    return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        if (process.env.NODE_ENV === 'production' && !process.env.WS_CORS_ORIGIN) {
            cb(new Error('WS_CORS_ORIGIN not configured — server boot should have failed'), false);
            return;
        }
        const raw = process.env.WS_CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:5173';
        const allowed = raw.split(',').map((s) => s.trim());
        const isAllowed = !origin ||
            allowed.includes(origin) ||
            /^https?:\/\/([a-zA-Z0-9-]+\.)*santos\.co\.id(:[0-9]+)?$/.test(origin) ||
            /^https?:\/\/localhost(:[0-9]+)?$/.test(origin) ||
            /^https?:\/\/127\.0\.0\.1(:[0-9]+)?$/.test(origin);
        if (isAllowed) {
            cb(null, true);
        } else {
            cb(new Error(`WS origin not allowed: ${origin}`), false);
        }
    };
}

@WebSocketGateway({
    namespace: '/ws/hardware-requests',
    cors: { origin: buildCorsOrigin(), credentials: true },
})
export class HardwareRequestGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(HardwareRequestGateway.name);

    constructor(
        private readonly wsAuth: WsAuthGuard,
        @InjectRepository(HardwareRequest)
        private readonly hrRepo: Repository<HardwareRequest>,
    ) {}

    handleConnection(client: Socket) {
        const ok = this.wsAuth.verifyAndAttach(client);
        if (ok) {
            this.logger.debug(`WS connected: ${client.id} user=${client.data.user?.id}`);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.debug(`WS disconnected: ${client.id}`);
    }

    // Client subscribes to a specific request ID
    @SubscribeMessage('subscribe_request')
    async handleSubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { requestId: string },
    ) {
        if (!data?.requestId) return { status: 'error', message: 'Missing requestId' };

        const user = client.data.user as { id: string; roles: string[] } | undefined;
        if (!user) {
            client.disconnect(true);
            return { status: 'error', message: 'Unauthorized' };
        }

        const allowed = await wsRoomAuthz(user, data.requestId, this.hrRepo);
        if (!allowed) {
            client.emit('unauthorized', { requestId: data.requestId });
            client.disconnect(true);
            return { status: 'error', message: 'Forbidden' };
        }

        client.join(`hw_request_${data.requestId}`);
        this.logger.debug(`Client ${client.id} joined room hw_request_${data.requestId}`);
        return { status: 'ok', room: `hw_request_${data.requestId}` };
    }

    // Client unsubscribes from a specific request ID
    @SubscribeMessage('unsubscribe_request')
    handleUnsubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { requestId: string },
    ) {
        if (!data.requestId) return { status: 'error', message: 'Missing requestId' };
        client.leave(`hw_request_${data.requestId}`);
        this.logger.debug(`Client ${client.id} left room hw_request_${data.requestId}`);
        return { status: 'ok', room: `hw_request_${data.requestId}` };
    }

    // === Event Listeners to Broadcast via WS ===
    private broadcastToRoom(requestId: string, event: string, payload: any) {
        this.server.to(`hw_request_${requestId}`).emit(event, payload);
        this.server.emit('request_list_updated', { requestId, event, payload }); // for global list updates
    }

    @OnEvent(HR_EVT.SUBMITTED)
    onSubmitted(e: any) { this.broadcastToRoom(e.requestId, 'status_changed', { status: 'UNDER_REVIEW', ...e }); }

    @OnEvent(HR_EVT.APPROVED)
    onApproved(e: any) { this.broadcastToRoom(e.requestId, 'status_changed', { status: 'PROCUREMENT', ...e }); }

    @OnEvent(HR_EVT.REJECTED)
    onRejected(e: any) { this.broadcastToRoom(e.requestId, 'status_changed', { status: 'REJECTED', ...e }); }

    @OnEvent(HR_EVT.CANCELLED)
    onCancelled(e: any) { this.broadcastToRoom(e.requestId, 'status_changed', { status: 'CANCELLED', ...e }); }

    @OnEvent(HR_EVT.PROCUREMENT_DONE)
    onProcurementDone(e: any) {
        this.broadcastToRoom(e.requestId, 'procurement_updated', e);
        this.broadcastToRoom(e.requestId, 'status_changed', { status: 'PARTIAL_DELIVERED', ...e });
    }

    @OnEvent(HR_EVT.SCHEDULE_PROPOSED)
    onScheduleProposed(e: any) { this.broadcastToRoom(e.requestId, 'schedule_proposed', e); }

    @OnEvent(HR_EVT.SCHEDULE_CONFIRMED)
    onScheduleConfirmed(e: any) { this.broadcastToRoom(e.requestId, 'schedule_confirmed', e); }

    @OnEvent(HR_EVT.SCHEDULE_RESCHEDULED)
    onScheduleRescheduled(e: any) { this.broadcastToRoom(e.requestId, 'schedule_rescheduled', e); }

    @OnEvent(HR_EVT.INSTALL_STARTED)
    onInstallStarted(e: any) { this.broadcastToRoom(e.requestId, 'status_changed', { status: 'INSTALLING', ...e }); }

    @OnEvent(HR_EVT.INSTALL_COMPLETED)
    onInstallCompleted(e: any) { this.broadcastToRoom(e.requestId, 'status_changed', { status: 'COMPLETED', ...e }); }

    @OnEvent(HR_EVT.COMMENTED)
    onCommented(e: any) { this.broadcastToRoom(e.requestId, 'new_comment', e); }
}
