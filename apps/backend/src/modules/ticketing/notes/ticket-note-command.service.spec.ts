import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TicketNoteCommandService } from './ticket-note-command.service';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteMember } from './entities/ticket-note-member.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { HandlingTeam, TicketStatus } from '../entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';

// In-memory storage double: policy and command logic are real; only DB I/O is replaced.
describe('TicketNoteCommandService', () => {
    let rows: Map<any, any[]>;
    let manager: any;
    let service: TicketNoteCommandService;
    const ticket = { id: 'ticket', siteId: 'a', handlingTeam: HandlingTeam.OPS_SUPPORT, status: TicketStatus.IN_PROGRESS };
    beforeEach(() => {
        rows = new Map<any, any[]>([[User, ['creator', 'member', 'other'].map(id => ({ id, role: UserRole.AGENT, siteId: 'a', isActive: true }))],
            [TicketNote, []], [TicketNoteMember, []]]);
        let nextId = 0;
        manager = {
            findOne: async (entity: any, options: any) => {
                if (entity.name === 'Ticket') return ticket;
                return (rows.get(entity) || []).find(row => Object.entries(options.where).every(([k, v]) => row[k] === v)) || null;
            },
            create: (_entity: any, data: any) => ({ id: String(++nextId), ...data }),
            save: async (entity: any, data: any) => {
                const list = rows.get(entity) || [];
                const values = Array.isArray(data) ? data : [data];
                for (const value of values) {
                    const index = list.findIndex(row => row.id === value.id);
                    if (index < 0) list.push(value); else list[index] = value;
                }
                rows.set(entity, list);
                return data;
            },
            delete: async (entity: any, where: any) => rows.set(entity, (rows.get(entity) || []).filter(row =>
                !Object.entries(where).every(([key, value]) => row[key] === value))),
            find: async (entity: any) => rows.get(entity) || [],
        };
        const source = { manager, transaction: async (fn: any) => fn(manager) } as any;
        service = new TicketNoteCommandService(source, new TicketNoteAccessService(source));
    });
    it('creates a private note with creator membership and deduplicates selected members', async () => {
        const note = await service.create('ticket', 'creator', { title: '  Investigation  ', memberIds: ['member', 'member'] });
        expect(note.title).toBe('Investigation');
        expect(rows.get(TicketNoteMember)?.map(row => row.userId)).toEqual(['creator', 'member']);
    });
    it('supports a personal note', async () => {
        await service.create('ticket', 'creator', { memberIds: [] });
        expect(rows.get(TicketNoteMember)?.map(row => row.userId)).toEqual(['creator']);
    });
    it('rejects an ineligible selected member before inserting a note', async () => {
        rows.get(User)![1].role = UserRole.USER;
        await expect(service.create('ticket', 'creator', { memberIds: ['member'] })).rejects.toBeDefined();
        expect(rows.get(TicketNote)).toHaveLength(0);
    });
    it('lets a current member invite another eligible handler', async () => {
        const note = await service.create('ticket', 'creator', { memberIds: ['member'] });
        await service.addMembers(note.id, 'member', ['other']);
        expect(rows.get(TicketNoteMember)?.map(row => row.userId)).toEqual(['creator', 'member', 'other']);
    });
    it('only lets creator remove another member', async () => {
        const note = await service.create('ticket', 'creator', { memberIds: ['member', 'other'] });
        await expect(service.removeMember(note.id, 'member', 'other')).rejects.toBeInstanceOf(ForbiddenException);
        await service.removeMember(note.id, 'creator', 'other');
        expect(rows.get(TicketNoteMember)?.map(row => row.userId)).toEqual(['creator', 'member']);
    });
    it('never removes creator membership', async () => {
        const note = await service.create('ticket', 'creator', { memberIds: [] });
        await expect(service.removeMember(note.id, 'creator', 'creator')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('only lets creator soft-delete the note', async () => {
        const note = await service.create('ticket', 'creator', { memberIds: ['member'] });
        await expect(service.softDelete(note.id, 'member')).rejects.toBeInstanceOf(ForbiddenException);
        await service.softDelete(note.id, 'creator');
        expect(rows.get(TicketNote)![0].deletedAt).toBeInstanceOf(Date);
        expect(rows.get(TicketNote)).toHaveLength(1);
    });
});
