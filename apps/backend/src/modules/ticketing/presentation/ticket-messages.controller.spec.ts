import { TicketMessagesController } from './ticket-messages.controller';

describe('TicketMessagesController', () => {
    const editService = { editMessage: jest.fn().mockResolvedValue({ id: 'm-1' }), deleteMessage: jest.fn().mockResolvedValue({ id: 'm-1' }) };
    const controller = new TicketMessagesController(editService as never);
    const req = { user: { userId: 'u-1', role: 'USER', siteId: 'site-1' } };

    it('PATCH passes the caller and the content to the service', async () => {
        await expect(controller.edit('t-1', 'm-1', { content: 'baru' }, req)).resolves.toEqual({ id: 'm-1' });
        expect(editService.editMessage).toHaveBeenCalledWith('t-1', 'm-1', { id: 'u-1', role: 'USER', siteId: 'site-1' }, 'baru');
    });

    it('DELETE passes the caller', async () => {
        await controller.remove('t-1', 'm-1', req);
        expect(editService.deleteMessage).toHaveBeenCalledWith('t-1', 'm-1', { id: 'u-1', role: 'USER', siteId: 'site-1' });
    });
});
