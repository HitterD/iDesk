import { NotFoundException } from '@nestjs/common';
import { TvBoardGateway } from './tv-board.gateway';
import { TvBoardService } from './tv-board.service';

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
    });

    it('only emits to the room of the site whose ticket changed', async () => {
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
});
