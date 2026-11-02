import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TicketMessagePinService, MAX_PINS } from './ticket-message-pin.service';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketStatus } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

const NOW = new Date('2026-11-02T08:00:00Z').getTime();
const REQUESTER = { id: 'u-1', role: UserRole.USER, siteId: 'site-1' };
const AGENT = { id: 'agent-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1' };
const ASSIGNEE = { id: 'agent-2', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1' };
const ADMIN = { id: 'admin-1', role: UserRole.ADMIN, siteId: null };

const ticket = (over: Record<string, unknown> = {}) => ({
    id: 't-1', ticketNumber: 'GEN-1', userId: 'u-1', createdById: null, siteId: 'site-1', status: TicketStatus.IN_PROGRESS,
    handlingTeam: 'OPS_SUPPORT', category: 'GENERAL', ticketType: 'SERVICE', participants: [], assignedToId: 'agent-2', ...over,
});
const message = (over: Record<string, unknown> = {}) => ({
    id: 'm-1', ticketId: 't-1', senderId: 'u-1', content: 'kode 4471', isSystemMessage: false, isInternal: false,
    deletedAt: null, pinnedAt: null, pinnedById: null, createdAt: new Date(NOW - 60_000),
    sender: { id: 'u-1', fullName: 'Budi' }, ...over,
});
const pinned = (id: string, minutesAgo: number, over: Record<string, unknown> = {}) =>
    message({ id, pinnedAt: new Date(NOW - minutesAgo * 60_000), pinnedById: 'u-1', ...over });

function build(target: Record<string, unknown> = message(), t: Record<string, unknown> = ticket(), current: Record<string, unknown>[] = []) {
    const updates: Array<{ where: any; values: any }> = [];
    const saved: any[] = [];
    let pins = [...current];
    const manager = {
        update: jest.fn(async (_e, where, values) => {
            updates.push({ where, values });
            const ids: string[] = Array.isArray(where.id?._value) ? where.id._value : [where.id];
            if (values.pinnedAt) pins = [...pins.filter((p) => !ids.includes(p.id as string)), { ...target, ...values }];
            else pins = pins.filter((p) => !ids.includes(p.id as string));
            return { affected: 1 };
        }),
        find: jest.fn(async () => [...pins].sort((a: any, b: any) => +a.pinnedAt - +b.pinnedAt)),
        create: jest.fn((_e, data) => data),
        save: jest.fn(async (_e, data) => { saved.push(data); return { id: 'sys-1', createdAt: new Date(NOW), ...data }; }),
        findOne: jest.fn(async () => ({ id: AGENT.id, fullName: 'Agen Satu' })),
    };
    // Like the database, find honours `order: { pinnedAt: 'ASC' }`.
    const messageRepo = {
        findOne: jest.fn().mockResolvedValue(target),
        find: jest.fn(async () => [...pins].sort((a: any, b: any) => +a.pinnedAt - +b.pinnedAt)),
        update: jest.fn(async () => ({ affected: 1 })),
    };
    const ticketRepo = { findOne: jest.fn().mockResolvedValue(t) };
    const userRepo = { findOne: jest.fn(async ({ where: { id } }: any) => ({ id, fullName: id === 'u-1' ? 'Budi' : 'Agen Satu' })) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const gateway = { notifyPinsChanged: jest.fn(), notifyNewMessage: jest.fn() };
    const service = new TicketMessagePinService(
        messageRepo as never, ticketRepo as never, userRepo as never, dataSource as never, gateway as never,
    );
    return { service, updates, saved, gateway };
}

describe('TicketMessagePinService', () => {
    beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
    afterEach(() => jest.useRealTimers());

    it('any participant can pin', async () => {
        const { service, updates, gateway } = build();
        await service.pin('t-1', 'm-1', REQUESTER);
        expect(updates.at(-1)?.values).toEqual({ pinnedAt: new Date(NOW), pinnedById: 'u-1' });
        expect(gateway.notifyPinsChanged).toHaveBeenCalledWith('t-1', [expect.objectContaining({ id: 'm-1', senderName: 'Budi', isInternal: false })]);
    });

    it('a fourth pin releases the oldest', async () => {
        const { service, updates } = build(message({ id: 'm-4' }), ticket(), [pinned('m-1', 30), pinned('m-2', 20), pinned('m-3', 10)]);
        await service.pin('t-1', 'm-4', AGENT);
        const release = updates.find((u) => u.values.pinnedAt === null);
        expect(release?.where.id).toBe('m-1');
        expect(MAX_PINS).toBe(3);
    });

    it('pinning again is a no-op', async () => {
        const { service, updates, saved } = build(pinned('m-1', 5));
        await service.pin('t-1', 'm-1', AGENT);
        expect(updates).toHaveLength(0);
        expect(saved).toHaveLength(0);
    });

    it.each([
        ['a closed ticket', message(), ticket({ status: TicketStatus.CLOSED })],
        ['a system message', message({ isSystemMessage: true }), ticket()],
        ['a deleted message', message({ deletedAt: new Date() }), ticket()],
        ['an archived internal note', message({ isInternal: true }), ticket()],
    ])('refuses pin on %s', async (_label, msg, t) => {
        await expect(build(msg, t).service.pin('t-1', 'm-1', AGENT)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a USER who is not on the ticket', async () => {
        const stranger = { id: 'u-9', role: UserRole.USER, siteId: 'site-1' };
        await expect(build().service.pin('t-1', 'm-1', stranger)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('unpin by pinner, admin or assigned agent only', async () => {
        const byOther = build(pinned('m-1', 5, { pinnedById: 'agent-1' }));
        await expect(byOther.service.unpin('t-1', 'm-1', REQUESTER)).rejects.toBeInstanceOf(ForbiddenException);
        for (const viewer of [AGENT, ADMIN, ASSIGNEE]) {
            const ok = build(pinned('m-1', 5, { pinnedById: 'agent-1' }));
            await expect(ok.service.unpin('t-1', 'm-1', viewer)).resolves.toBeDefined();
        }
    });

    it('writes a short system message without the message text', async () => {
        const { service, saved, gateway } = build();
        await service.pin('t-1', 'm-1', REQUESTER);
        expect(saved).toEqual([expect.objectContaining({ ticketId: 't-1', isSystemMessage: true, content: 'Budi menyematkan pesan', senderId: 'u-1' })]);
        expect(JSON.stringify(saved)).not.toContain('4471');
        expect(gateway.notifyNewMessage).toHaveBeenCalledWith('t-1', expect.objectContaining({ content: 'Budi menyematkan pesan' }));

        const off = build(pinned('m-1', 5));
        await off.service.unpin('t-1', 'm-1', REQUESTER);
        expect(off.saved[0].content).toBe('Budi melepas sematan pesan');
    });

    it('listPins summarizes pins oldest first without leaking pinnedById', async () => {
        const { service } = build(message(), ticket(), [pinned('m-2', 5), pinned('m-1', 10)]);
        const pins = await service.listPins('t-1');
        expect(pins.map((p) => p.id)).toEqual(['m-1', 'm-2']);
        expect(pins[0]).not.toHaveProperty('pinnedById');
        expect(pins[0]).toMatchObject({ snippet: 'kode 4471', senderName: 'Budi' });
    });

    it('stores no update on the message entity other than the pin columns', async () => {
        const { service, updates } = build();
        await service.pin('t-1', 'm-1', REQUESTER);
        for (const u of updates) expect(Object.keys(u.values).sort()).toEqual(['pinnedAt', 'pinnedById']);
        expect(TicketMessage).toBeDefined();
    });
});
