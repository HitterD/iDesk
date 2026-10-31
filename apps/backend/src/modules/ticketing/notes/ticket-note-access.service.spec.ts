import { NotFoundException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, HandlingTeam, TicketStatus } from '../entities/ticket.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteMember } from './entities/ticket-note-member.entity';

describe('TicketNoteAccessService', () => {
    const actorId = '83178b9c-791f-46f5-8b43-a232c57be975';
    const ticketId = 'c7f8acdf-513a-41ae-9bd6-892419999b5a';
    const noteId = 'a19acc5a-fae7-4023-bf0e-8a9b99df207b';
    let user: Partial<User>;
    let ticket: Partial<Ticket>;
    let note: Partial<TicketNote>;
    let member: Partial<TicketNoteMember> | null;
    let manager: EntityManager;
    let service: TicketNoteAccessService;

    beforeEach(() => {
        user = { id: actorId, role: UserRole.AGENT, siteId: 'site-a', isActive: true };
        ticket = { id: ticketId, handlingTeam: HandlingTeam.OPS_SUPPORT,
            siteId: 'site-a', status: TicketStatus.IN_PROGRESS };
        note = { id: noteId, ticketId, createdById: actorId, deletedAt: null };
        member = { noteId, userId: actorId, lastReadSequence: 0 };
        manager = { findOne: jest.fn(async (entity, options) => {
            if (entity === User) return user;
            if (entity === Ticket) return ticket;
            if (entity === TicketNote) return note;
            if (entity === TicketNoteMember) return member;
            throw new Error(`Unexpected entity ${entity.name}`);
        }) } as unknown as EntityManager;
        service = new TicketNoteAccessService({ manager } as any);
    });

    it('allows an active member who is a current ticket handler', async () => {
        const result = await service.assertMember(noteId, actorId, manager);
        expect(result.note.id).toBe(noteId);
        expect(result.user.role).toBe(UserRole.AGENT);
    });

    it('locks the current user and ticket before a note mutation', async () => {
        await service.assertMember(noteId, actorId, manager, true);
        const calls = (manager.findOne as jest.Mock).mock.calls;
        expect(calls.find(([entity]) => entity === User)?.[1].lock).toEqual({ mode: 'pessimistic_read' });
        expect(calls.find(([entity]) => entity === Ticket)?.[1].lock).toEqual({ mode: 'pessimistic_write' });
        expect(calls.find(([entity, options]) => entity === TicketNote && options.lock)?.[1].lock)
            .toEqual({ mode: 'pessimistic_write' });
    });

    it('returns the locked latest version rather than the pre-lock snapshot', async () => {
        (manager.findOne as jest.Mock).mockImplementation(async (entity, options) => {
            if (entity === User) return user;
            if (entity === Ticket) return ticket;
            if (entity === TicketNoteMember) return member;
            if (entity === TicketNote) return { ...note, contentVersion: options.lock ? 2 : 1 };
        });
        expect((await service.assertMember(noteId, actorId, manager, true)).note.contentVersion).toBe(2);
    });

    it('does not let an administrator bypass membership', async () => {
        user.role = UserRole.ADMIN;
        member = null;
        await expect(service.assertMember(noteId, actorId, manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not let the creator bypass missing membership', async () => {
        member = null;
        await expect(service.assertMember(noteId, actorId, manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects requester access even when the requester has a membership row', async () => {
        user.role = UserRole.USER;
        ticket.userId = actorId;
        await expect(service.assertMember(noteId, actorId, manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechecks the database role instead of granting previous handler access', async () => {
        user.role = UserRole.AGENT_ORACLE;
        await expect(service.assertMember(noteId, actorId, manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects members who moved to a different site', async () => {
        user.siteId = 'site-b';
        await expect(service.assertMember(noteId, actorId, manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects inactive members', async () => {
        user.isActive = false;
        await expect(service.assertMember(noteId, actorId, manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('hides deleted notes', async () => {
        note.deletedAt = new Date();
        await expect(service.assertMember(noteId, actorId, manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a note addressed through a different ticket', async () => {
        await expect(service.assertMember(noteId, actorId, manager, false, 'other-ticket'))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([TicketStatus.CLOSED, TicketStatus.CANCELLED])('prevents writes on %s', async status => {
        ticket.status = status;
        await expect(service.assertMember(noteId, actorId, manager, true)).rejects.toBeInstanceOf(ConflictException);
        await expect(service.assertMember(noteId, actorId, manager)).resolves.toBeDefined();
    });

    it('permits edits when resolved but not closed', async () => {
        ticket.status = TicketStatus.RESOLVED;
        await expect(service.assertMember(noteId, actorId, manager, true)).resolves.toBeDefined();
    });

    it('respects the existing developer cross-site ticket policy', async () => {
        user.role = UserRole.AGENT_WEB_DEV;
        user.siteId = 'site-b';
        ticket.handlingTeam = HandlingTeam.ORACLE_DEV;
        await expect(service.assertMember(noteId, actorId, manager)).resolves.toBeDefined();
    });
});
