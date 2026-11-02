import { TicketMessagesController } from './ticket-messages.controller';

describe('TicketMessagesController', () => {
    const editService = { editMessage: jest.fn().mockResolvedValue({ id: 'm-1' }), deleteMessage: jest.fn().mockResolvedValue({ id: 'm-1' }) };
    const pinService = { pin: jest.fn().mockResolvedValue([]), unpin: jest.fn().mockResolvedValue([]) };
    const controller = new TicketMessagesController(editService as never, pinService as never);
    const req = { user: { userId: 'u-1', role: 'USER', siteId: 'site-1' } };

    it('PATCH passes the caller and the content to the service', async () => {
        await expect(controller.edit('t-1', 'm-1', { content: 'baru' }, req)).resolves.toEqual({ id: 'm-1' });
        expect(editService.editMessage).toHaveBeenCalledWith('t-1', 'm-1', { id: 'u-1', role: 'USER', siteId: 'site-1' }, 'baru');
    });

    it('pin and unpin pass the caller', async () => {
        await controller.pin('t-1', 'm-1', req);
        await controller.unpin('t-1', 'm-1', req);
        const viewer = { id: 'u-1', role: 'USER', siteId: 'site-1' };
        expect(pinService.pin).toHaveBeenCalledWith('t-1', 'm-1', viewer);
        expect(pinService.unpin).toHaveBeenCalledWith('t-1', 'm-1', viewer);
    });

    it('DELETE passes the caller', async () => {
        await controller.remove('t-1', 'm-1', req);
        expect(editService.deleteMessage).toHaveBeenCalledWith('t-1', 'm-1', { id: 'u-1', role: 'USER', siteId: 'site-1' });
    });
});
