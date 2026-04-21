import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard {
    private readonly logger = new Logger(WsAuthGuard.name);

    constructor(private readonly jwtService: JwtService) {}

    verifyAndAttach(client: Socket): boolean {
        const token =
            (client.handshake.auth as Record<string, unknown>)?.token as string | undefined ??
            (client.handshake.query?.token as string | undefined);

        if (!token) {
            this.logger.warn(`WS rejected — no token (${client.id})`);
            client.disconnect(true);
            return false;
        }

        try {
            const payload = this.jwtService.verify<{ sub: string; roles?: string[] }>(token);
            client.data.user = { id: payload.sub, roles: payload.roles ?? [] };
            return true;
        } catch {
            this.logger.warn(`WS rejected — invalid token (${client.id})`);
            client.disconnect(true);
            return false;
        }
    }
}
