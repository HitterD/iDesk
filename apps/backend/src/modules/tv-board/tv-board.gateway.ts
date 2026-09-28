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
    /** Sites whose board is being recomputed; a burst of ticket events collapses into at most one extra run. */
    private readonly refreshing = new Map<string, { rerun: boolean; done: Promise<void> }>();

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
        // No TV screen connected anywhere: nothing to recompute.
        if (this.socketSiteMap.size === 0) return;

        let siteId = payload?.siteId;
        if (!siteId && payload?.ticketId && this.ticketRepo) {
            try {
                const ticket = await this.ticketRepo.findOne({ where: { id: payload.ticketId }, select: ['siteId'] });
                siteId = ticket?.siteId;
            } catch (err) {
                this.logger.warn(`Could not resolve siteId for ticket ${payload.ticketId}: ${err.message}`);
            }
        }

        if (siteId && this.hasViewers(siteId)) {
            await this.refreshSite(siteId);
        }
    }

    private hasViewers(siteId: string): boolean {
        for (const joinedSiteId of this.socketSiteMap.values()) {
            if (joinedSiteId === siteId) return true;
        }
        return false;
    }

    private refreshSite(siteId: string): Promise<void> {
        const running = this.refreshing.get(siteId);
        if (running) {
            running.rerun = true;
            return running.done;
        }

        const state = { rerun: false, done: Promise.resolve() };
        state.done = (async () => {
            try {
                do {
                    state.rerun = false;
                    const boardData = await this.tvBoardService.getBoardData(siteId);
                    this.server.to(`tv:${siteId}`).emit('tv-board:update', boardData);
                } while (state.rerun);
            } catch (err) {
                this.logger.warn(`TV board refresh failed for site ${siteId}: ${err.message}`);
            } finally {
                this.refreshing.delete(siteId);
            }
        })();
        this.refreshing.set(siteId, state);
        return state.done;
    }

    @OnEvent('ticket.created')
    @OnEvent('ticket.updated')
    @OnEvent('ticket.assigned')
    @OnEvent('ticket.cancelled')
    async handleGenericTicketEvent(payload: any): Promise<void> {
        await this.handleTicketChanged(payload);
    }
}
