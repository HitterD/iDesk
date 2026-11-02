import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TicketMessageReactionService, REACTION_EMOJIS } from './ticket-message-reaction.service';
import { TicketMessageReaction } from '../entities/ticket-message-reaction.entity';
import { TicketStatus } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

const REQUESTER = { id: 'u-1', role: UserRole.USER, siteId: 'site-1' };
const AGENT = { id: 'agent-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1' };

const ticket = (over: Record<string, unknown> = {}) => ({
    id: 't-1', userId: 'u-1', createdById: null, siteId: 'site-1', status: TicketStatus.IN_PROGRESS,
    handlingTeam: 'OPS_SUPPORT', category: 'GENERAL', ticketType: 'SERVICE', participants: [], ...over,
});
const message = (over: Record<string, unknown> = {}) => ({
    id: 'm-1', ticketId: 't-1', senderId: 'agent-1', content: 'halo', isSystemMessage: false, isInternal: false, deletedAt: null, ...over,
});

function build(msg: Record<string, unknown> = message(), t: Record<string, unknown> = ticket()) {
    let rows: Array<{ messageId: string; userId: string; emoji: string; createdAt: Date; user: { id: string; fullName: string } }> = [];
    const names: Record<string, string> = { 'u-1': 'Budi', 'agent-1': 'Agen' };
    const manager = {
        delete: jest.fn(async (_e, where) => { rows = rows.filter((r) => !(r.messageId === where.messageId && r.userId === where.userId)); }),
        save: jest.fn(async (_e, data) => { rows.push({ ...data, createdAt: new Date(), user: { id: data.userId, fullName: names[data.userId] } }); return data; }),
        create: jest.fn((_e, data) => data),
    };
    const reactionRepo = { find: jest.fn(async () => [...rows].sort((a, b) => +a.createdAt - +b.createdAt)) };
    const messageRepo = { findOne: jest.fn().mockResolvedValue(msg) };
    const ticketRepo = { findOne: jest.fn().mockResolvedValue(t) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const gateway = { notifyReactionsChanged: jest.fn() };
    const service = new TicketMessageReactionService(
        reactionRepo as never, messageRepo as never, ticketRepo as never, dataSource as never, gateway as never,
    );
    return { service, gateway, manager, rows: () => rows };
}

describe('TicketMessageReactionService', () => {
    it('one reaction per person: a second emoji replaces the first', async () => {
        const { service, rows } = build();
        await service.react('t-1', 'm-1', REQUESTER, '👍');
        const out = await service.react('t-1', 'm-1', REQUESTER, '❤️');
        expect(rows()).toHaveLength(1);
        expect(out).toEqual([{ emoji: '❤️', count: 1, userIds: ['u-1'], userNames: ['Budi'] }]);
    });

    it('two people on the same emoji are counted together', async () => {
        const { service } = build();
        await service.react('t-1', 'm-1', REQUESTER, '👍');
        const out = await service.react('t-1', 'm-1', AGENT, '👍');
        expect(out).toEqual([{ emoji: '👍', count: 2, userIds: ['u-1', 'agent-1'], userNames: ['Budi', 'Agen'] }]);
    });

    it("unreact removes only the caller's", async () => {
        const { service } = build();
        await service.react('t-1', 'm-1', REQUESTER, '👍');
        await service.react('t-1', 'm-1', AGENT, '👍');
        const out = await service.unreact('t-1', 'm-1', REQUESTER);
        expect(out).toEqual([{ emoji: '👍', count: 1, userIds: ['agent-1'], userNames: ['Agen'] }]);
    });

    it('refuses emojis outside the set', async () => {
        expect(REACTION_EMOJIS).toEqual(['👍', '❤️', '😂', '😮', '😢', '🎉', '✅', '👀']);
        await expect(build().service.react('t-1', 'm-1', REQUESTER, '💩')).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
        ['a system message', message({ isSystemMessage: true }), ticket()],
        ['a deleted message', message({ deletedAt: new Date() }), ticket()],
        ['an archived internal note', message({ isInternal: true }), ticket()],
        ['a closed ticket', message(), ticket({ status: TicketStatus.CLOSED })],
    ])('refuses on %s', async (_label, msg, t) => {
        await expect(build(msg, t).service.react('t-1', 'm-1', AGENT, '👍')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a USER who is not on the ticket', async () => {
        const stranger = { id: 'u-9', role: UserRole.USER, siteId: 'site-1' };
        await expect(build().service.react('t-1', 'm-1', stranger, '👍')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('broadcasts the new aggregate', async () => {
        const { service, gateway } = build();
        await service.react('t-1', 'm-1', REQUESTER, '🎉');
        expect(gateway.notifyReactionsChanged).toHaveBeenCalledWith('t-1', 'm-1', false,
            [{ emoji: '🎉', count: 1, userIds: ['u-1'], userNames: ['Budi'] }]);
        expect(TicketMessageReaction).toBeDefined();
    });
});
