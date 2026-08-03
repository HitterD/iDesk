import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { TvBoardService } from './tv-board.service';
import { Ticket } from '../ticketing/entities/ticket.entity';

@WebSocketGateway({
    namespace: '/tv-board',
    cors: {
        origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
            const allowedOrigins = [
                'http://localhost:4050',
                'http://localhost:3000',
                'http://localhost:5173',
                'http://localhost:5050',
            ];
            if (process.env.FRONTEND_URL) {
                allowedOrigins.push(process.env.FRONTEND_URL);
            }
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(null, true);
            }
        },
        credentials: true,
    },
})
export class TvBoardGateway {
    @WebSocketServer() server: Server;
    private logger = new Logger('TvBoardGateway');
    private socketSiteMap: Map<string, string> = new Map();

    constructor(
        private readonly tvBoardService: TvBoardService,
        @InjectRepository(Ticket)
        private readonly ticketRepo?: Repository<Ticket>,
    ) { }

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
    async handleTicketChanged(payload: { siteId?: string; ticketId?: string }): Promise<void> {
        let siteId = payload?.siteId;
        if (!siteId && payload?.ticketId && this.ticketRepo) {
            try {
                const ticket = await this.ticketRepo.findOne({ where: { id: payload.ticketId }, select: ['siteId'] });
                siteId = ticket?.siteId;
            } catch (err) {
                this.logger.warn(`Could not resolve siteId for ticket ${payload.ticketId}: ${err.message}`);
            }
        }

        if (siteId) {
            const boardData = await this.tvBoardService.getBoardData(siteId);
            this.server.to(`tv:${siteId}`).emit('tv-board:update', boardData);
        }
    }

    @OnEvent('ticket.created')
    @OnEvent('ticket.updated')
    @OnEvent('ticket.assigned')
    @OnEvent('ticket.cancelled')
    async handleGenericTicketEvent(payload: any): Promise<void> {
        await this.handleTicketChanged(payload);
    }
}
