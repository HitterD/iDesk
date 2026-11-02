import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketMessageEditService, EDIT_WINDOW_MS } from './ticket-message-edit.service';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketMessageEdit } from '../entities/ticket-message-edit.entity';
import { TicketStatus } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

const NOW = new Date('2026-11-01T08:00:00Z').getTime();
const SENDER = { id: 'u-1', role: UserRole.USER, siteId: 'site-1' };
const AGENT = { id: 'agent-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1' };
const ADMIN = { id: 'admin-1', role: UserRole.ADMIN, siteId: null };

const ticket = (over: Record<string, unknown> = {}) => ({
    id: 't-1', userId: 'u-1', createdById: null, siteId: 'site-1', status: TicketStatus.IN_PROGRESS,
    handlingTeam: 'OPS_SUPPORT', category: 'GENERAL', ticketType: 'SERVICE', participants: [], ...over,
});
const message = (over: Record<string, unknown> = {}) => ({
    id: 'm-1', ticketId: 't-1', senderId: 'u-1', content: 'halo', createdAt: new Date(NOW - 60_000),
    isSystemMessage: false, isInternal: false, source: 'WEB', editedAt: null, deletedAt: null, deletedById: null,
    sender: { id: 'u-1', fullName: 'Budi', role: UserRole.USER }, ...over,
});

function build(msg: Record<string, unknown> = message(), t: Record<string, unknown> = { ...ticket(), ticketNumber: 'GEN-1' }, affected = 1) {
    const saved: Array<{ entity: unknown; data: any }> = [];
    const updates: Array<{ where: any; values: any }> = [];
    let row: Record<string, unknown> = { ...msg };
    const manager = {
        create: jest.fn((_e, data) => data),
        save: jest.fn(async (entity, data) => { saved.push({ entity, data }); return data; }),
        // Conditional write: applied only when the row still matches (affected = 0 simulates a lost race).
        update: jest.fn(async (_e, where, values) => {
            updates.push({ where, values });
            if (affected) row = { ...row, ...values };
            return { affected };
        }),
        findOne: jest.fn(async () => row),
    };
    const messageRepo = { findOne: jest.fn().mockResolvedValue(msg) };
    const ticketRepo = { findOne: jest.fn().mockResolvedValue(t) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const gateway = { notifyMessageUpdated: jest.fn() };
    const notifications = { redactMessageSnippet: jest.fn().mockResolvedValue(undefined) };
    const pins = { releaseDeleted: jest.fn().mockResolvedValue(undefined) };
    const service = new TicketMessageEditService(
        messageRepo as never, ticketRepo as never, dataSource as never, gateway as never, notifications as never, pins as never,
    );
    return { service, saved, updates, gateway, notifications, pins };
}

describe('TicketMessageEditService', () => {
    beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
    afterEach(() => jest.useRealTimers());

    it('lets the sender edit within 15 minutes and keeps the old text for audit', async () => {
        const { service, saved, updates } = build();

        const out = await service.editMessage('t-1', 'm-1', SENDER, '  halo semua  ');

        expect(saved.find((s) => s.entity === TicketMessageEdit)?.data)
            .toMatchObject({ messageId: 'm-1', previousContent: 'halo', editedById: 'u-1' });
        expect(updates[0].values).toEqual({ content: 'halo semua', editedAt: new Date(NOW) });
        expect(out).toMatchObject({ id: 'm-1', content: 'halo semua', isDeleted: false });
    });

    it('allows an edit at exactly 15 minutes and refuses one second later', async () => {
        await expect(build(message({ createdAt: new Date(NOW - EDIT_WINDOW_MS) }))
            .service.editMessage('t-1', 'm-1', SENDER, 'x')).resolves.toBeDefined();
        await expect(build(message({ createdAt: new Date(NOW - EDIT_WINDOW_MS - 1000) }))
            .service.editMessage('t-1', 'm-1', SENDER, 'x')).rejects.toThrow('Batas waktu edit 15 menit sudah lewat');
    });

    it('refuses an edit by someone else, even an admin', async () => {
        await expect(build().service.editMessage('t-1', 'm-1', ADMIN, 'x')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(build().service.editMessage('t-1', 'm-1', AGENT, 'x')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each([
        ['a closed ticket', message(), ticket({ status: TicketStatus.CLOSED })],
        ['a system message', message({ isSystemMessage: true }), ticket()],
        ['an email message', message({ source: 'EMAIL' }), ticket()],
        ['an archived internal note', message({ isInternal: true, senderId: 'agent-1' }), ticket()],
        ['a deleted message', message({ deletedAt: new Date(NOW - 1000), deletedById: 'u-1' }), ticket()],
    ])('refuses edit and delete on %s', async (_label, msg, t) => {
        const viewer = msg.senderId === 'agent-1' ? AGENT : SENDER;
        await expect(build(msg, t).service.editMessage('t-1', 'm-1', viewer, 'x')).rejects.toBeInstanceOf(BadRequestException);
        await expect(build(msg, t).service.deleteMessage('t-1', 'm-1', viewer)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("lets the sender delete at any time and an admin delete anyone's message", async () => {
        const old = message({ createdAt: new Date(NOW - 7 * 24 * 3600_000) });
        const own = build(old);
        expect(await own.service.deleteMessage('t-1', 'm-1', SENDER))
            .toMatchObject({ isDeleted: true, deletedByAdmin: false, content: '' });
        expect(own.updates[0].values).toEqual({ deletedAt: new Date(NOW), deletedById: 'u-1' });

        const byAdmin = build(old);
        expect(await byAdmin.service.deleteMessage('t-1', 'm-1', ADMIN)).toMatchObject({ isDeleted: true, deletedByAdmin: true });
    });

    it("refuses a requester deleting the agent's message", async () => {
        const { service } = build(message({ senderId: 'agent-1', sender: { id: 'agent-1', fullName: 'Agen', role: UserRole.AGENT } }));
        await expect(service.deleteMessage('t-1', 'm-1', SENDER)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a viewer without access to the ticket', async () => {
        const stranger = { id: 'u-9', role: UserRole.USER, siteId: 'site-1' };
        await expect(build(message({ senderId: 'u-9' })).service.deleteMessage('t-1', 'm-1', stranger))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('says not found for a message of another ticket', async () => {
        await expect(build(message({ ticketId: 't-2' })).service.editMessage('t-1', 'm-1', SENDER, 'x'))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it('broadcasts the presented message after the change', async () => {
        const { service, gateway } = build();
        await service.deleteMessage('t-1', 'm-1', SENDER);
        expect(gateway.notifyMessageUpdated).toHaveBeenCalledWith('t-1', expect.objectContaining({ id: 'm-1', isDeleted: true, content: '' }));
        expect(JSON.stringify(gateway.notifyMessageUpdated.mock.calls[0][1])).not.toContain('halo');
    });

    it('an unchanged edit writes nothing and returns only the public sender fields', async () => {
        const full = message({ sender: { id: 'u-1', fullName: 'Budi', role: UserRole.USER, email: 'b@x.id', phoneNumber: '08' } });
        const { service, saved, updates, gateway } = build(full);
        const out = await service.editMessage('t-1', 'm-1', SENDER, ' halo ');
        expect(saved).toHaveLength(0);
        expect(updates).toHaveLength(0);
        expect(gateway.notifyMessageUpdated).not.toHaveBeenCalled();
        expect(out.sender).toEqual({ id: 'u-1', fullName: 'Budi', role: UserRole.USER });
    });

    it('refuses an edit that is only whitespace', async () => {
        await expect(build().service.editMessage('t-1', 'm-1', SENDER, '   ')).rejects.toThrow('Pesan tidak boleh kosong');
    });

    it('writes the edit only while the message is still live and unchanged, and says so when it lost a race', async () => {
        const { service, updates } = build();
        await service.editMessage('t-1', 'm-1', SENDER, 'baru');
        expect(updates[0].where).toMatchObject({ id: 'm-1', content: 'halo' });
        expect(updates[0].where.deletedAt).toBeDefined();

        const raced = build(message(), undefined, 0);
        await expect(raced.service.editMessage('t-1', 'm-1', SENDER, 'baru')).rejects.toBeInstanceOf(ConflictException);
        expect(raced.saved).toHaveLength(0);
        expect(raced.gateway.notifyMessageUpdated).not.toHaveBeenCalled();
    });

    it('deletes only a message that is not deleted yet', async () => {
        const { service, updates } = build();
        await service.deleteMessage('t-1', 'm-1', SENDER);
        expect(updates[0].where).toMatchObject({ id: 'm-1' });
        expect(updates[0].where.deletedAt).toBeDefined();

        const raced = build(message(), undefined, 0);
        await expect(raced.service.deleteMessage('t-1', 'm-1', SENDER)).rejects.toThrow('Pesan sudah dihapus');
    });

    it('deleting a pinned message releases the pin and announces the new pins', async () => {
        const { service, pins } = build(message({ pinnedAt: new Date(NOW - 1000), pinnedById: 'u-1' }));
        await service.deleteMessage('t-1', 'm-1', SENDER);
        expect(pins.releaseDeleted).toHaveBeenCalledWith('t-1', 'm-1');

        const plain = build();
        await plain.service.deleteMessage('t-1', 'm-1', SENDER);
        expect(plain.pins.releaseDeleted).not.toHaveBeenCalled();
    });

    it('takes the deleted text back out of stored reply notifications', async () => {
        const { service, notifications } = build();
        await service.deleteMessage('t-1', 'm-1', SENDER);
        expect(notifications.redactMessageSnippet).toHaveBeenCalledWith({
            messageId: 'm-1', ticketId: 't-1', ticketNumber: 'GEN-1', senderName: 'Budi', sentAt: new Date(NOW - 60_000),
        });
    });
});
