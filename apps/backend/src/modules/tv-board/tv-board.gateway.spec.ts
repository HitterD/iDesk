import { NotFoundException } from '@nestjs/common';
import { TvBoardGateway, TV_BOARD_INVALID_TOKEN, TV_BOARD_JOIN_ERROR } from './tv-board.gateway';

describe('TvBoardGateway', () => {
    let gateway: TvBoardGateway;
    let tvBoardService: { resolveSiteIdByToken: jest.Mock; getBoardData: jest.Mock };
    let mockServer: { to: jest.Mock; emit: jest.Mock };
    let toReturn: { emit: jest.Mock };

    beforeEach(() => {
        toReturn = { emit: jest.fn() };
        mockServer = { to: jest.fn().mockReturnValue(toReturn), emit: jest.fn() };
        tvBoardService = {
            resolveSiteIdByToken: jest.fn(),
            getBoardData: jest.fn().mockResolvedValue({
                siteCode: 'SPJ',
                open: [{ id: 'oracle-1', isOracleRequest: true }],
                inProgress: [],
                waitingVendorCount: 0,
                ringtones: { newTicket: null, inProgress: null, closing: null, closingTime: null },
            }),
        };
        gateway = new TvBoardGateway(tvBoardService as any);
        (gateway as any).server = mockServer;
    });

    it('joins the tv:{siteId} room for a valid token and does not leak to other sites', async () => {
        tvBoardService.resolveSiteIdByToken.mockResolvedValue('site-A');
        const join = jest.fn();
        const emit = jest.fn();
        const client = { id: 'sock-1', join, emit, disconnect: jest.fn() } as any;

        await gateway.handleJoin(client, { token: 'token-A' });

        expect(join).toHaveBeenCalledWith('tv:site-A');
        expect(join).not.toHaveBeenCalledWith('tv:site-B');
    });

    it('disconnects the client for an invalid token', async () => {
        tvBoardService.resolveSiteIdByToken.mockRejectedValue(new NotFoundException('invalid'));
        const disconnect = jest.fn();
        const client = { id: 'sock-2', join: jest.fn(), emit: jest.fn(), disconnect } as any;

        await gateway.handleJoin(client, { token: 'bad-token' });

        expect(disconnect).toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(TV_BOARD_INVALID_TOKEN);
    });

    it('keeps the socket and asks the TV to retry when the join fails for a transient reason', async () => {
        tvBoardService.resolveSiteIdByToken.mockRejectedValue(new Error('canceling statement due to statement timeout'));
        const disconnect = jest.fn();
        const client = { id: 'sock-3', join: jest.fn(), emit: jest.fn(), disconnect } as any;

        await gateway.handleJoin(client, { token: 'token-A' });

        expect(disconnect).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(TV_BOARD_JOIN_ERROR);
    });

    const connectTv = async (gw: TvBoardGateway, socketId: string, siteId: string) => {
        tvBoardService.resolveSiteIdByToken.mockResolvedValueOnce(siteId);
        await gw.handleJoin({ id: socketId, join: jest.fn(), emit: jest.fn(), disconnect: jest.fn() } as any, { token: 't' });
        tvBoardService.getBoardData.mockClear();
    };

    it('only emits to the room of the site whose ticket changed', async () => {
        await connectTv(gateway, 'tv-A', 'site-A');
        await gateway.handleTicketChanged({ siteId: 'site-A' });

        expect(mockServer.to).toHaveBeenCalledWith('tv:site-A');
        expect(mockServer.to).not.toHaveBeenCalledWith('tv:site-B');
        expect(toReturn.emit).toHaveBeenCalledWith(
            'tv-board:update',
            expect.objectContaining({
                siteCode: 'SPJ',
                open: [expect.objectContaining({ id: 'oracle-1', isOracleRequest: true })],
            }),
        );
    });

    it('resolves siteId from ticketRepo when only ticketId is provided in event payload', async () => {
        const mockTicketRepo = {
            findOne: jest.fn().mockResolvedValue({ id: 't-123', siteId: 'site-resolved' }),
        };
        const gatewayWithRepo = new TvBoardGateway(tvBoardService as any, mockTicketRepo as any);
        (gatewayWithRepo as any).server = mockServer;
        await connectTv(gatewayWithRepo, 'tv-resolved', 'site-resolved');

        await gatewayWithRepo.handleGenericTicketEvent({ ticketId: 't-123' });

        expect(mockTicketRepo.findOne).toHaveBeenCalledWith({
            where: { id: 't-123' },
            select: ['siteId'],
        });
        expect(mockServer.to).toHaveBeenCalledWith('tv:site-resolved');
        expect(toReturn.emit).toHaveBeenCalledWith('tv-board:update', expect.any(Object));
    });

    it('skips recomputing when no TV screen watches the site', async () => {
        await connectTv(gateway, 'tv-B', 'site-B');

        await gateway.handleTicketChanged({ siteId: 'site-A' });

        expect(tvBoardService.getBoardData).not.toHaveBeenCalled();
    });

    it('collapses a burst of ticket events into at most one extra recompute', async () => {
        await connectTv(gateway, 'tv-A', 'site-A');

        await Promise.all([1, 2, 3, 4, 5].map(() => gateway.handleTicketChanged({ siteId: 'site-A' })));

        expect(tvBoardService.getBoardData).toHaveBeenCalledTimes(2);
    });
});
