import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { TvBoardService } from './tv-board.service';

@WebSocketGateway({
    namespace: '/tv-board',
    cors: {
        origin: ['http://localhost:4050', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5050'],
        credentials: true,
    },
})
export class TvBoardGateway {
    @WebSocketServer() server: Server;
    private logger = new Logger('TvBoardGateway');
    private socketSiteMap: Map<string, string> = new Map();

    constructor(private readonly tvBoardService: TvBoardService) { }

    @SubscribeMessage('tv-board:join')
    async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { token: string }): Promise<void> {
        try {
            const siteId = await this.tvBoardService.resolveSiteIdByToken(data?.token);
            client.join(`tv:${siteId}`);
            this.socketSiteMap.set(client.id, siteId);
            this.logger.log(`TV client ${client.id} joined tv:${siteId}`);

            const boardData = await this.tvBoardService.getBoardData(siteId);
            client.emit('tv-board:update', boardData);
        } catch (error) {
            this.logger.warn(`TV client ${client.id} rejected: invalid token`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket): void {
        this.socketSiteMap.delete(client.id);
    }

    @OnEvent('tv-board.ticket-changed')
    async handleTicketChanged(payload: { siteId: string }): Promise<void> {
        const boardData = await this.tvBoardService.getBoardData(payload.siteId);
        this.server.to(`tv:${payload.siteId}`).emit('tv-board:update', boardData);
    }
}
