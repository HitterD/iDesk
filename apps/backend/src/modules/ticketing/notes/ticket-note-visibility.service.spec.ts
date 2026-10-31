import { TicketNoteVisibilityService } from './ticket-note-visibility.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { NotFoundException } from '@nestjs/common';

describe('TicketNoteVisibilityService', () => {
    it('hides persisted private notices after membership is revoked while retaining ordinary notices', async () => {
        const access: any = { assertMember: async () => { throw new NotFoundException(); } };
        const service = new TicketNoteVisibilityService(access);
        const rows: any[] = [{ id: 'ordinary', type: NotificationType.TICKET_REPLY },
            { id: 'private', type: NotificationType.TICKET_NOTE, referenceId: 'note' }];
        expect((await service.filter('viewer', rows)).map(row => row.id)).toEqual(['ordinary']);
    });
    it('shows generic private notices only to an eligible note member', async () => {
        const service = new TicketNoteVisibilityService({ assertMember: async () => ({}) } as any);
        const rows: any[] = [{ id: 'private', type: NotificationType.TICKET_NOTE, referenceId: 'note' }];
        expect(await service.filter('viewer', rows)).toHaveLength(1);
    });
});
