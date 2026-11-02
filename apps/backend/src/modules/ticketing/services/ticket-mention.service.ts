import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { resolveTicketViewerAccess, TicketViewerAccess } from './ticket-oracle-access';
import { isTicketRequesterSide } from '../utils/oracle-ticket-access.util';
import type { MessageEditor } from './ticket-message-edit.service';

export interface MentionCandidate {
    id: string;
    fullName: string;
    avatarUrl: string | null;
}

/**
 * Who may be @mentioned in a ticket's chat. The requester side may mention the people on the
 * ticket (requester, filer, participants, assigned agent); the handling team may also mention any
 * active staff who can handle this ticket. Nobody mentions themselves, and a mention never adds a
 * participant: it only notifies.
 */
@Injectable()
export class TicketMentionService {
    constructor(
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
    ) { }

    async candidates(ticketId: string, viewer: MessageEditor, search = ''): Promise<MentionCandidate[]> {
        const ticket = await this.load(ticketId);
        const allowed = await this.allowedUsers(ticket, viewer);
        const q = search.trim().toLowerCase();
        return allowed
            .filter((u) => !q || u.fullName.toLowerCase().includes(q))
            .sort((a, b) => a.fullName.localeCompare(b.fullName))
            .map((u) => ({ id: u.id, fullName: u.fullName, avatarUrl: u.avatarUrl ?? null }));
    }

    /** The subset of `ids` this viewer may mention on this ticket, without duplicates. */
    async filterAllowed(ticketId: string, viewer: MessageEditor, ids: string[]): Promise<string[]> {
        const wanted = [...new Set(ids.filter((id) => typeof id === 'string' && id))];
        if (wanted.length === 0) return [];
        const ticket = await this.load(ticketId);
        const allowed = new Set((await this.allowedUsers(ticket, viewer)).map((u) => u.id));
        return wanted.filter((id) => allowed.has(id));
    }

    private async allowedUsers(ticket: Ticket, viewer: MessageEditor): Promise<User[]> {
        const access = this.accessOf(ticket, viewer);
        if (!access) throw new ForbiddenException('Anda tidak bisa menyebut orang di tiket ini');

        const involved = new Set<string>([
            ticket.userId, ticket.createdById, ticket.assignedToId,
            ...(ticket.participants ?? []).map((p) => p.userId),
        ].filter((id): id is string => Boolean(id)));

        const users = access === 'handler'
            ? await this.userRepo.find({ where: { isActive: true } })
            : await this.userRepo.find({ where: { id: In([...involved]), isActive: true } });

        return users.filter((u) => u.id !== viewer.id && (involved.has(u.id) || (access === 'handler' && this.canHandle(ticket, u))));
    }

    /** Staff who would see this ticket as its handling team (same team, scope and site rules). */
    private canHandle(ticket: Ticket, user: User): boolean {
        if (user.role === UserRole.USER) return false;
        try {
            return resolveTicketViewerAccess(ticket, user) === 'handler';
        } catch {
            return false;
        }
    }

    private accessOf(ticket: Ticket, viewer: MessageEditor): TicketViewerAccess | null {
        if (viewer.role === UserRole.USER && !isTicketRequesterSide(viewer.id, ticket)) return null;
        try {
            return resolveTicketViewerAccess(ticket, viewer);
        } catch {
            return null;
        }
    }

    private async load(ticketId: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['participants'] });
        if (!ticket) throw new NotFoundException('Ticket not found');
        return ticket;
    }
}
