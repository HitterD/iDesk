import { TicketMessage } from '../entities/ticket-message.entity';
import { ForbiddenException } from '@nestjs/common';
import { TicketMessagingService } from './ticket-messaging.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketStatus, TicketType } from '../entities/ticket.entity';
import { createTestSlaClock } from './sla-clock.testing';

describe('TicketMessagingService Oracle scope', () => {
    it('blocks AGENT_ORACLE from reading standard-ticket messages', async () => {
        const ticketRepo = {
            findOne: jest.fn().mockResolvedValue({ id: 'standard', category: 'GENERAL', ticketType: TicketType.SERVICE }),
        };
        const service = new TicketMessagingService(
            ticketRepo as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never, createTestSlaClock(),
        );

        await expect(service.getMessages('standard', UserRole.AGENT_ORACLE)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks AGENT_ORACLE from paginated standard-ticket messages before querying messages', async () => {
        const ticketRepo = {
            findOne: jest.fn().mockResolvedValue({ id: 'standard', category: 'GENERAL', ticketType: TicketType.SERVICE }),
        };
        const messageRepo = { createQueryBuilder: jest.fn() };
        const service = new TicketMessagingService(
            ticketRepo as never,
            messageRepo as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never, createTestSlaClock(),
        );

        await expect(service.getMessagesPaginated('standard', 1, 20, UserRole.AGENT_ORACLE))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(messageRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('blocks AGENT_ORACLE reply to a standard ticket before message write', async () => {
        const manager = {
            findOne: jest.fn()
                .mockResolvedValueOnce({ id: 'standard', category: 'GENERAL', ticketType: TicketType.SERVICE })
                .mockResolvedValueOnce({ id: 'oracle-1', role: UserRole.AGENT_ORACLE }),
        };
        const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
        const service = new TicketMessagingService(
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            dataSource as never,
            {} as never,
            {} as never, createTestSlaClock(),
        );

        await expect(service.replyToTicket('standard', 'oracle-1', 'reply'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect((manager as { create?: jest.Mock }).create).toBeUndefined();
    });

    it('returns an existing idempotent public reply without repeating ticket side effects', async () => {
        const existing = { id: 'already-sent', content: 'solution' };
        const manager: any = {
            findOne: jest.fn().mockResolvedValueOnce({ id: 't', status: TicketStatus.IN_PROGRESS,
                siteId: 's', participants: [], user: { id: 'owner' } })
                .mockResolvedValueOnce({ id: 'a', role: UserRole.ADMIN, siteId: 's' })
                .mockResolvedValueOnce(existing),
            create: jest.fn(),
        };
        const service = new TicketMessagingService({} as never, {} as never, {} as never, {} as never,
            { transaction: (fn: any) => fn(manager) } as never, {} as never, {} as never, createTestSlaClock());
        const result = await service.replyToTicket('t', 'a', 'solution', [], [], false, [], 'request-id');
        expect(result.id).toBe('already-sent');
        expect(manager.create).not.toHaveBeenCalled();
    });

    describe('deleted messages over REST', () => {
        const deleted = { id: 'm-1', content: 'rahasia', senderId: 'u-1', attachments: ['/uploads/tickets/t-1/x.png'], deletedAt: new Date(), deletedById: 'u-1' };
        const build = () => {
            const ticketRepo = { findOne: jest.fn().mockResolvedValue({ id: 't-1', userId: 'u-1', siteId: 'site-1', participants: [] }) };
            const qb: any = {
                leftJoinAndSelect: jest.fn(() => qb), where: jest.fn(() => qb), andWhere: jest.fn(() => qb),
                getCount: jest.fn().mockResolvedValue(1), orderBy: jest.fn(() => qb), skip: jest.fn(() => qb), take: jest.fn(() => qb),
                getMany: jest.fn().mockResolvedValue([deleted]),
            };
            const messageRepo = { find: jest.fn().mockResolvedValue([deleted]), createQueryBuilder: jest.fn(() => qb) };
            return new TicketMessagingService(
                ticketRepo as never, messageRepo as never, {} as never, {} as never,
                {} as never, {} as never, { emit: jest.fn() } as never, createTestSlaClock(),
            );
        };

        it('getMessages never returns deleted text or files', async () => {
            const out = await build().getMessages('t-1');
            expect(JSON.stringify(out)).not.toContain('rahasia');
            expect(JSON.stringify(out)).not.toContain('x.png');
            expect(out[0]).toMatchObject({ isDeleted: true });
        });

        it('getMessagesPaginated never returns deleted text or files', async () => {
            const out = await build().getMessagesPaginated('t-1');
            expect(JSON.stringify(out.data)).not.toContain('rahasia');
            expect(out.data[0]).toMatchObject({ isDeleted: true });
        });
    });

    describe('reply links over REST', () => {
        it('getMessages links replies and blanks quotes of deleted originals', async () => {
            const thread = [
                { id: 'a', content: 'kode 4471', senderId: 'u-1', sender: { fullName: 'Ani' }, deletedAt: new Date(), deletedById: 'u-1' },
                { id: 'b', content: '\u21a9 Ani: kode 4471\n\nok', senderId: 'u-2', replyToId: 'a' },
            ];
            const service = new TicketMessagingService(
                { findOne: jest.fn().mockResolvedValue({ id: 't-1', userId: 'u-1', siteId: 'site-1', participants: [] }) } as never,
                { find: jest.fn().mockResolvedValue(thread) } as never, {} as never, {} as never,
                {} as never, {} as never, { emit: jest.fn() } as never, createTestSlaClock(),
            );
            const out = await service.getMessages('t-1');
            expect(JSON.stringify(out)).not.toContain('4471');
            expect(out[1]).toMatchObject({ replyTo: { id: 'a', isDeleted: true } });
        });
    });

    describe('reply links across pages', () => {
        it('getMessagesPaginated resolves an original on an earlier page and blanks its quote when deleted', async () => {
            const page = [{ id: 'b', content: '\u21a9 Ani: kode 4471\n\nok', senderId: 'u-2', replyToId: 'a', createdAt: new Date() }];
            const original = { id: 'a', content: 'kode 4471', senderId: 'u-1', sender: { fullName: 'Ani' }, deletedAt: new Date(), deletedById: 'u-1' };
            const qb: any = {
                leftJoinAndSelect: jest.fn(() => qb), where: jest.fn(() => qb), andWhere: jest.fn(() => qb),
                getCount: jest.fn().mockResolvedValue(30), orderBy: jest.fn(() => qb), skip: jest.fn(() => qb), take: jest.fn(() => qb),
                getMany: jest.fn().mockResolvedValue(page),
            };
            const messageRepo = { createQueryBuilder: jest.fn(() => qb), find: jest.fn().mockResolvedValue([original]) };
            const service = new TicketMessagingService(
                { findOne: jest.fn().mockResolvedValue({ id: 't-1', userId: 'u-1', siteId: 'site-1', participants: [] }) } as never,
                messageRepo as never, {} as never, {} as never, {} as never, {} as never, { emit: jest.fn() } as never, createTestSlaClock(),
            );

            const out = await service.getMessagesPaginated('t-1', 2);

            expect(JSON.stringify(out.data)).not.toContain('4471');
            expect(out.data[0]).toMatchObject({ replyTo: { id: 'a', isDeleted: true } });
            expect(messageRepo.find.mock.calls[0][0].where).toMatchObject({ ticketId: 't-1' });
        });
    });

    describe('TV board refresh on reply', () => {
        const buildService = (ticketStatus: TicketStatus, extra: Record<string, unknown> = {}, role: UserRole = UserRole.AGENT) => {
            const ticket = {
                id: 't-1', siteId: 'site-1', userId: 'owner', status: ticketStatus, ticketType: TicketType.SERVICE,
                category: 'GENERAL', participants: [], slaStartedAt: new Date(), user: { id: 'owner' }, ...extra,
            };
            const manager = {
                findOne: jest.fn()
                    .mockResolvedValueOnce(ticket)
                    .mockResolvedValueOnce({ id: 'agent-1', fullName: 'Agen Satu', role, siteId: 'site-1' }),
                create: jest.fn((_entity, data) => data),
                save: jest.fn((_entity, data) => Promise.resolve(data)),
            };
            const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
            const eventsGateway = {
                notifyNewMessage: jest.fn(),
                notifyStatusChange: jest.fn(),
                notifyTicketUpdate: jest.fn(),
                emitToTicketAudience: jest.fn(),
                notifyReadState: jest.fn(),
                server: { to: jest.fn(() => ({ emit: jest.fn() })) },
            };
            const eventEmitter = { emit: jest.fn() };
            const service = new TicketMessagingService(
                {} as never, {} as never, {} as never, {} as never,
                dataSource as never, eventsGateway as never, eventEmitter as never, createTestSlaClock(),
            );
            return { service, eventEmitter, eventsGateway, ticket };
        };

        it('a handler with a specialised agent role marks the team side read, never the requester side', async () => {
            const { service, ticket } = buildService(TicketStatus.IN_PROGRESS, { userLastReadAt: null }, UserRole.AGENT_OPERATIONAL_SUPPORT);

            await service.replyToTicket('t-1', 'agent-1', 'sudah saya cek');

            expect((ticket as Record<string, unknown>).userLastReadAt).toBeNull();
            expect((ticket as Record<string, unknown>).agentLastReadAt).toEqual(expect.any(Date));
        });

        it('tells the ticket room the sender side has read up to its reply', async () => {
            const { service, eventsGateway } = buildService(TicketStatus.IN_PROGRESS, {}, UserRole.AGENT_OPERATIONAL_SUPPORT);

            await service.replyToTicket('t-1', 'agent-1', 'sudah saya cek');

            expect(eventsGateway.notifyReadState).toHaveBeenCalledWith('t-1', { agentLastReadAt: expect.any(Date) });
        });

        it('refreshes TV boards when an agent reply starts work on an Open ticket', async () => {
            const { service, eventEmitter } = buildService(TicketStatus.TODO);

            await service.replyToTicket('t-1', 'agent-1', 'on it');

            expect(eventEmitter.emit).toHaveBeenCalledWith('tv-board.ticket-changed', { siteId: 'site-1' });
        });

        it('tells everyone viewing the ticket that the first agent reply moved it to In Progress', async () => {
            const { service, eventsGateway } = buildService(TicketStatus.TODO);

            await service.replyToTicket('t-1', 'agent-1', 'on it');

            // Viewers no longer reload the ticket after every chat message, so the status change needs its own event.
            expect(eventsGateway.notifyStatusChange).toHaveBeenCalledWith('t-1', TicketStatus.IN_PROGRESS, 'Agen Satu', 'site-1');
        });

        it('tells viewers about the first response even when the status does not change', async () => {
            const { service, eventsGateway } = buildService(TicketStatus.IN_PROGRESS, { firstResponseAt: null });

            await service.replyToTicket('t-1', 'agent-1', 'update');

            expect(eventsGateway.notifyStatusChange).not.toHaveBeenCalled();
            expect(eventsGateway.notifyTicketUpdate).toHaveBeenCalledWith('t-1', expect.objectContaining({ firstResponseAt: expect.any(Date) }), 'site-1');
        });

        it('sends no extra ticket event for an ordinary later reply', async () => {
            const { service, eventsGateway } = buildService(TicketStatus.IN_PROGRESS, { firstResponseAt: new Date() });

            await service.replyToTicket('t-1', 'agent-1', 'update');

            expect(eventsGateway.notifyStatusChange).not.toHaveBeenCalled();
            expect(eventsGateway.notifyTicketUpdate).not.toHaveBeenCalled();
        });

        it('leaves TV boards alone when the ticket was already in progress', async () => {
            const { service, eventEmitter } = buildService(TicketStatus.IN_PROGRESS);

            await service.replyToTicket('t-1', 'agent-1', 'update');

            expect(eventEmitter.emit).not.toHaveBeenCalledWith('tv-board.ticket-changed', expect.anything());
        });
    });

    describe('reply links on send', () => {
        const build = (original: Record<string, unknown> | null, role: UserRole = UserRole.USER) => {
            const ticket = {
                id: 't-1', siteId: 'site-1', userId: 'u-1', status: TicketStatus.IN_PROGRESS, handlingTeam: 'OPS_SUPPORT',
                ticketType: TicketType.SERVICE, category: 'GENERAL', participants: [], user: { id: 'u-1' }, firstResponseAt: new Date(),
            };
            const sender = role === UserRole.USER ? { id: 'u-1', role, siteId: 'site-1', fullName: 'Budi' } : { id: 'ag-1', role, siteId: 'site-1', fullName: 'Agen' };
            const created: any[] = [];
            const manager = {
                findOne: jest.fn(async (entity: any, opts: any) => {
                    if (entity === TicketMessage) return original && opts.where.id === original.id ? original : null;
                    return entity.name === 'User' ? sender : ticket;
                }),
                create: jest.fn((_entity, data) => { created.push(data); return data; }),
                save: jest.fn((_entity, data) => Promise.resolve({ id: 'new', createdAt: new Date(), ...data })),
            };
            const eventsGateway = {
                notifyNewMessage: jest.fn(), emitToTicketAudience: jest.fn(), notifyReadState: jest.fn(),
                server: { to: jest.fn(() => ({ emit: jest.fn() })) },
            };
            const service = new TicketMessagingService(
                {} as never, {} as never, {} as never, {} as never,
                { transaction: jest.fn((cb) => cb(manager)) } as never, eventsGateway as never, { emit: jest.fn() } as never, createTestSlaClock(),
            );
            return { service, created, eventsGateway, senderId: sender.id };
        };
        const replyTo = (replyToId: string) => ({ replyToId });

        it('stores replyToId when it points to a public message of the same ticket', async () => {
            const { service, created, senderId } = build({ id: 'orig', ticketId: 't-1', isSystemMessage: false, isInternal: false, sender: { fullName: 'Agen' }, content: 'cek kabel' });
            await service.replyToTicket('t-1', senderId, 'sudah', [], [], false, [], undefined, undefined, replyTo('orig'));
            expect(created.find((c) => c.content === 'sudah')?.replyToId).toBe('orig');
        });

        it.each([
            ['from another ticket', { id: 'orig', ticketId: 't-2', isSystemMessage: false, isInternal: false }],
            ['a system message', { id: 'orig', ticketId: 't-1', isSystemMessage: true, isInternal: false }],
            ['an internal note, for the requester side', { id: 'orig', ticketId: 't-1', isSystemMessage: false, isInternal: true }],
            ['missing', null],
        ])('drops a replyToId %s', async (_label, original) => {
            const { service, created, senderId } = build(original as Record<string, unknown> | null);
            await service.replyToTicket('t-1', senderId, 'sudah', [], [], false, [], undefined, undefined, replyTo('orig'));
            expect(created.find((c) => c.content === 'sudah')?.replyToId ?? null).toBeNull();
        });

        it('stores a reply to an already deleted message with the deleted quote, so no reader gets the old text', async () => {
            const { service, created, senderId } = build({ id: 'orig', ticketId: 't-1', isSystemMessage: false, isInternal: false,
                deletedAt: new Date(), sender: { fullName: 'Agen' }, content: 'kode 4471' });
            await service.replyToTicket('t-1', senderId, '\u21a9 Agen: kode 4471\n\nsudah', [], [], false, [], undefined, undefined, replyTo('orig'));
            const saved = created.find((c) => c.replyToId === 'orig');
            expect(saved.content).toBe('\u21a9 Agen: Pesan telah dihapus\n\nsudah');
        });

        it('a public reply from the team never links to an internal note', async () => {
            const { service, created, senderId } = build(
                { id: 'orig', ticketId: 't-1', isSystemMessage: false, isInternal: true, sender: { fullName: 'Agen' }, content: 'catatan' },
                UserRole.AGENT_OPERATIONAL_SUPPORT,
            );
            await service.replyToTicket('t-1', senderId, 'halo', [], [], false, [], undefined, undefined, replyTo('orig'));
            expect(created.find((c) => c.content === 'halo')?.replyToId ?? null).toBeNull();
        });

        it('sends the new message with its reply link resolved', async () => {
            const { service, eventsGateway, senderId } = build({ id: 'orig', ticketId: 't-1', isSystemMessage: false, isInternal: false, sender: { fullName: 'Agen' }, content: 'cek kabel' });
            await service.replyToTicket('t-1', senderId, 'sudah', [], [], false, [], undefined, undefined, replyTo('orig'));
            expect(eventsGateway.notifyNewMessage).toHaveBeenCalledWith('t-1', expect.objectContaining({
                replyTo: { id: 'orig', senderName: 'Agen', snippet: 'cek kabel', isDeleted: false },
            }));
        });
    });

    describe('reply from the requester side', () => {
        const build = (role: UserRole) => {
            const ticket = {
                id: 't-1', siteId: 'site-smg', userId: 'agent-smg', status: TicketStatus.TODO,
                handlingTeam: 'ORACLE_DEV', ticketType: TicketType.ORACLE_REQUEST, category: 'ORACLE_REQUEST',
                participants: [], user: { id: 'agent-smg' }, firstResponseAt: null,
            };
            const manager = {
                findOne: jest.fn()
                    .mockResolvedValueOnce(ticket)
                    .mockResolvedValueOnce({ id: 'agent-smg', role, siteId: 'site-smg' }),
                create: jest.fn((_entity, data) => data),
                save: jest.fn((_entity, data) => Promise.resolve(data)),
            };
            const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
            const eventsGateway = {
                notifyNewMessage: jest.fn(),
                emitToTicketAudience: jest.fn(),
                notifyReadState: jest.fn(),
                server: { to: jest.fn(() => ({ emit: jest.fn() })) },
            };
            const service = new TicketMessagingService(
                {} as never, {} as never, {} as never, {} as never,
                dataSource as never, eventsGateway as never, { emit: jest.fn() } as never, createTestSlaClock(),
            );
            return { service, ticket };
        };

        it('a support agent chatting on their forwarded dev ticket acts as requester (no first response, no start)', async () => {
            const { service, ticket } = build(UserRole.AGENT);

            await service.replyToTicket('t-1', 'agent-smg', 'any update?');

            expect(ticket.firstResponseAt).toBeNull();
            expect(ticket.status).toBe(TicketStatus.TODO);
            expect((ticket as Record<string, unknown>).lastMessageSenderRole).toBe(UserRole.USER);
        });

        it('rejects an internal note from the requester side', async () => {
            const { service } = build(UserRole.AGENT);

            await expect(service.replyToTicket('t-1', 'agent-smg', 'note', [], [], true))
                .rejects.toBeInstanceOf(ForbiddenException);
        });
    });

    describe('markAsRead', () => {
        const build = (ticket: Record<string, unknown>) => {
            const set = jest.fn();
            const qb: any = {
                update: jest.fn(() => qb),
                set: jest.fn((v) => { set(v); return qb; }),
                where: jest.fn(() => qb),
                andWhere: jest.fn(() => qb),
                execute: jest.fn().mockResolvedValue({ affected: 1 }),
            };
            const ticketRepo = {
                createQueryBuilder: jest.fn(() => qb),
                findOne: jest.fn().mockResolvedValue(ticket),
            };
            const emitter = { emit: jest.fn() };
            const gateway = { notifyReadState: jest.fn() };
            const service = new TicketMessagingService(
                ticketRepo as never, {} as never, {} as never, {} as never,
                {} as never, gateway as never, emitter as never, createTestSlaClock(),
            );
            return { service, ticketRepo, set, emitter, gateway, qb };
        };
        const opsTicket = { id: 't-1', userId: 'owner', createdById: null, handlingTeam: 'OPS_SUPPORT', siteId: 'site-1' };

        it('tells iPop who opened the ticket so their chat notifications clear', async () => {
            const { service, emitter } = build(opsTicket);
            await service.markAsRead('t-1', 'owner', UserRole.USER);
            expect(emitter.emit).toHaveBeenCalledWith('ticket.read', { ticketId: 't-1', userId: 'owner' });
        });

        it('broadcasts the moved read marker to the ticket room', async () => {
            const { service, gateway } = build(opsTicket);
            await service.markAsRead('t-1', 'owner', UserRole.USER);
            expect(gateway.notifyReadState).toHaveBeenCalledWith('t-1', { userLastReadAt: expect.any(Date) });
        });

        it('stays silent when no marker moved', async () => {
            const { service, gateway, qb } = build(opsTicket);
            qb.execute.mockResolvedValue({ affected: 0 });
            await service.markAsRead('t-1', 'owner', UserRole.USER);
            expect(gateway.notifyReadState).not.toHaveBeenCalled();
        });

        it('marks the agent side for a handling agent and the user side for a USER', async () => {
            const { service, set } = build(opsTicket);

            await service.markAsRead('t-1', 'u-1', UserRole.AGENT, 'site-1');
            expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ agentLastReadAt: expect.any(Date) }));
            expect(set.mock.lastCall[0]).not.toHaveProperty('userLastReadAt');

            await service.markAsRead('t-1', 'owner', UserRole.USER);
            expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ userLastReadAt: expect.any(Date) }));
        });

        it('a support agent who filed a dev ticket reads only the requester side', async () => {
            const { service, set } = build({ ...opsTicket, createdById: 'agent-smg', handlingTeam: 'ORACLE_DEV' });

            await service.markAsRead('t-1', 'agent-smg', UserRole.AGENT, 'site-1');

            expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ userLastReadAt: expect.any(Date) }));
            expect(set.mock.lastCall[0]).not.toHaveProperty('agentLastReadAt');
        });

        it('only writes when there is something new to mark as read', async () => {
            const { service, ticketRepo } = build(opsTicket);
            const qb = ticketRepo.createQueryBuilder();

            await service.markAsRead('t-1', 'owner', UserRole.USER);

            // Re-opening an already-read ticket is a no-op in the database, not a row write.
            expect(qb.andWhere).toHaveBeenCalledWith(
                '("userLastReadAt" IS NULL OR ("lastMessageAt" IS NOT NULL AND "lastMessageAt" > "userLastReadAt"))',
            );
        });

        it('still tells integrations about every open, even when there was nothing to write', async () => {
            const { service, ticketRepo, emitter } = build(opsTicket);
            ticketRepo.createQueryBuilder().execute.mockResolvedValue({ affected: 0 });

            await service.markAsRead('t-1', 'owner', UserRole.USER);

            // Read markers are per side (requester / handling team) but iPop clears notifications per
            // person: after the filer read the requester side, the requester's own open must still reach iPop.
            expect(emitter.emit).toHaveBeenCalledWith('ticket.read', { ticketId: 't-1', userId: 'owner' });
        });

        // Reading must not look like activity: keep updatedAt and version as they are.
        it('keeps updatedAt and version unchanged when marking as read', async () => {
            const { service, set } = build(opsTicket);

            await service.markAsRead('t-1', 'owner', UserRole.USER);

            const values = set.mock.lastCall[0];
            expect(values.updatedAt()).toBe('"updatedAt"');
            expect(values.version()).toBe('"version"');
        });
    });
});
