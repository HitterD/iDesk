import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { TvBoardService } from './tv-board.service';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { buildWsCorsOrigin } from '../../shared/security/ws-origin';

/** Sent when the join could not finish for a transient reason; the TV retries the join. */
export const TV_BOARD_JOIN_ERROR = 'tv-board:join-error';
/** Sent before disconnecting a TV whose link was revoked or never existed. */
export const TV_BOARD_INVALID_TOKEN = 'tv-board:invalid-token';

@WebSocketGateway({
    namespace: '/tv-board',
    cors: { origin: buildWsCorsOrigin(), credentials: true },
})
export class TvBoardGateway {
    @WebSocketServer() server: Server;
    private logger = new Logger('TvBoardGateway');
    private socketSiteMap: Map<string, string> = new Map();
    /** Dev-hub boards: any site's ticket change (incl. a forward) can move a card on or off them. */
    private readonly hubSiteIds = new Set<string>();
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
            this.trackHub(siteId, boardData.showsDevTickets);
            client.emit('tv-board:update', boardData);
        } catch (error) {
            if (error instanceof NotFoundException) {
                this.logger.warn(`TV client ${client.id} rejected: invalid token`);
                client.emit(TV_BOARD_INVALID_TOKEN);
                client.disconnect(true);
                return;
            }
            // A slow or failing DB is not the TV's fault: keep the socket and let it retry the join.
            this.logger.warn(`TV client ${client.id} join failed: ${(error as Error)?.message}`);
            client.emit(TV_BOARD_JOIN_ERROR);
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

        const targets = new Set<string>(this.hubSiteIds);
        if (siteId) targets.add(siteId);
        await Promise.all([...targets].filter((id) => this.hasViewers(id)).map((id) => this.refreshSite(id)));
    }

    private trackHub(siteId: string, showsDevTickets: boolean | undefined): void {
        if (showsDevTickets) this.hubSiteIds.add(siteId);
        else this.hubSiteIds.delete(siteId);
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
                    this.trackHub(siteId, boardData.showsDevTickets);
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
