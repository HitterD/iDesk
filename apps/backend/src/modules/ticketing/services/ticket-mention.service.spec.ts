import { ForbiddenException } from '@nestjs/common';
import { TicketMentionService } from './ticket-mention.service';
import { UserRole } from '../../users/enums/user-role.enum';

const ticket = {
    id: 't-1', userId: 'req', createdById: 'filer', assignedToId: 'assignee', siteId: 'site-1', handlingTeam: 'OPS_SUPPORT',
    category: 'GENERAL', ticketType: 'SERVICE', participants: [{ userId: 'guest' }],
};
const users = [
    { id: 'req', fullName: 'Budi Requester', role: UserRole.USER, siteId: 'site-1', isActive: true, avatarUrl: null },
    { id: 'filer', fullName: 'Fani Filer', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-2', isActive: true, avatarUrl: null },
    { id: 'guest', fullName: 'Gita Guest', role: UserRole.USER, siteId: 'site-3', isActive: true, avatarUrl: null },
    { id: 'assignee', fullName: 'Andi Assignee', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', isActive: true, avatarUrl: null },
    { id: 'colleague', fullName: 'Citra Colleague', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', isActive: true, avatarUrl: null },
    { id: 'other-site', fullName: 'Oki Othersite', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-9', isActive: true, avatarUrl: null },
    { id: 'random-user', fullName: 'Rina Random', role: UserRole.USER, siteId: 'site-1', isActive: true, avatarUrl: null },
];

function build() {
    const ticketRepo = { findOne: jest.fn().mockResolvedValue(ticket) };
    const userRepo = {
        find: jest.fn(async (opts?: any) => {
            const ids: string[] | undefined = opts?.where?.id?._value;
            return users.filter((u) => u.isActive && (!ids || ids.includes(u.id)));
        }),
    };
    return new TicketMentionService(ticketRepo as never, userRepo as never);
}
const ids = (list: { id: string }[]) => list.map((u) => u.id).sort();

describe('TicketMentionService', () => {
    it('the requester side may mention only the people on the ticket', async () => {
        const out = await build().candidates('t-1', { id: 'req', role: UserRole.USER, siteId: 'site-1' });
        expect(ids(out)).toEqual(['assignee', 'filer', 'guest']);
    });

    it('the handling team may also mention staff who can handle the ticket, never themselves', async () => {
        const out = await build().candidates('t-1', { id: 'assignee', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1' });
        expect(ids(out)).toEqual(['colleague', 'filer', 'guest', 'req']);
        expect(out[0]).not.toHaveProperty('email');
    });

    it('filters candidates by name', async () => {
        const out = await build().candidates('t-1', { id: 'req', role: UserRole.USER, siteId: 'site-1' }, 'gita');
        expect(ids(out)).toEqual(['guest']);
    });

    it('keeps only allowed ids, dropping random users, other sites and the sender', async () => {
        const kept = await build().filterAllowed('t-1', { id: 'req', role: UserRole.USER, siteId: 'site-1' },
            ['assignee', 'colleague', 'random-user', 'other-site', 'req', 'assignee']);
        expect(kept).toEqual(['assignee']);
    });

    it('refuses candidates to a USER who is not on the ticket', async () => {
        await expect(build().candidates('t-1', { id: 'random-user', role: UserRole.USER, siteId: 'site-1' }))
            .rejects.toBeInstanceOf(ForbiddenException);
    });
});
