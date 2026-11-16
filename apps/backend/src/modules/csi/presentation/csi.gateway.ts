import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { buildWsCorsOrigin } from '../../../shared/security/ws-origin';
import { readCookie } from '../../ticketing/presentation/gateways/events.gateway';
import { parseCsiScope } from '../csi.constants';
import { CSI_UPDATED_EVENT, type CsiUpdatedEvent } from '../csi.events';
import { canAdminCsiScope } from '../guards/csi-admin.guard';
import { CsiAccessReader } from '../guards/csi-access-reader';

const ACCESS_COOKIE_NAME = 'access_token';

export const csiAdminRoom = (scope: ServiceScope): string => `csi:admin:${scope}`;

function buildCorsOrigin() {
    return buildWsCorsOrigin();
}

/**
 * Authenticated WebSocket gateway pushing real-time CSI progress & dashboard updates
 * to authorized CSI admins per scope (`ICT` / `HC`).
 */
@WebSocketGateway({
    namespace: '/csi',
    cors: { origin: buildCorsOrigin(), credentials: true },
})
export class CsiGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(CsiGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly accessReader: CsiAccessReader,
    ) { }

    handleConnection(client: Socket) {
        try {
            const token = readCookie(client.handshake.headers?.cookie, ACCESS_COOKIE_NAME)
                || (client.handshake.auth?.token as string | undefined)
                || client.handshake.headers?.authorization?.split(' ')[1];
            if (!token) throw new Error('Missing token');
            const payload = this.jwtService.verify<{ sub?: string; type?: string }>(token, {
                secret: this.configService.get('JWT_SECRET'),
            });
            if (!payload.sub) throw new Error('Invalid claims');
            if (payload.type && payload.type !== 'access') throw new Error('Invalid token type');
            client.data.userId = payload.sub;
        } catch {
            this.logger.warn(`Rejected unauthenticated CSI socket ${client.id}`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.debug(`CSI socket disconnected: ${client.id}`);
    }

    @SubscribeMessage('csi:subscribe')
    async handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { scope?: string }) {
        const userId = client.data.userId as string | undefined;
        if (!userId) return { status: 'error', message: 'Unauthorized' };
        let scope: ServiceScope;
        try {
            scope = parseCsiScope(data?.scope ?? '');
        } catch {
            return { status: 'error', message: 'Invalid scope' };
        }
        const access = await this.accessReader.load(userId);
        if (!access || !canAdminCsiScope(access.role, access.pageAccess, scope)) {
            return { status: 'error', message: 'Forbidden' };
        }
        const room = csiAdminRoom(scope);
        client.join(room);
        return { status: 'ok', room };
    }

    @SubscribeMessage('csi:unsubscribe')
    handleUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { scope?: string }) {
        try {
            const scope = parseCsiScope(data?.scope ?? '');
            client.leave(csiAdminRoom(scope));
            return { status: 'ok' };
        } catch {
            return { status: 'error', message: 'Invalid scope' };
        }
    }

    @OnEvent(CSI_UPDATED_EVENT)
    handleCsiUpdated(event: CsiUpdatedEvent) {
        if (!this.server) return;
        this.server.to(csiAdminRoom(event.scope)).emit('csi:updated', event);
    }
}
