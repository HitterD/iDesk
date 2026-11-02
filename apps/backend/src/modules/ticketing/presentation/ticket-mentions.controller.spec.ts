import { TicketMentionsController } from './ticket-mentions.controller';

describe('TicketMentionsController', () => {
    it('lists the people the caller may mention, with the search text', async () => {
        const mentions = { candidates: jest.fn().mockResolvedValue([{ id: 'u-2', fullName: 'Ani', avatarUrl: null }]) };
        const controller = new TicketMentionsController(mentions as never);

        const out = await controller.candidates('t-1', { user: { userId: 'u-1', role: 'USER', siteId: 'site-1' } }, 'an');

        expect(out).toEqual([{ id: 'u-2', fullName: 'Ani', avatarUrl: null }]);
        expect(mentions.candidates).toHaveBeenCalledWith('t-1', { id: 'u-1', role: 'USER', siteId: 'site-1' }, 'an');
    });
});
