import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Ticket, TicketStatus, TICKET_INACTIVE_STATUSES } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { presentThread, PresentedThreadMessage } from '../utils/message-presenter.util';
import { loadMentionNames } from '../utils/mention-names.util';
import { TicketParticipant } from '../entities/ticket-participant.entity';
import { TicketNote } from '../notes/entities/ticket-note.entity';
import { TicketNoteEditSession } from '../notes/entities/ticket-note-edit-session.entity';
import { TicketNoteDocumentService } from '../notes/ticket-note-document.service';
import { IsNull } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { AuditService, AuditAction } from '../../audit';
import { assertTicketRoleAccess } from './ticket-oracle-access';
import { validateTicketSiteAccess } from '../utils/site-access.util';

const QUOTE_HEAD = /^(↩️?[^\r\n]*\r?\n(?:\r?\n)?)/;

/**
 * Text of a message copied in by a merge. A deleted one stays as is (its text is never served);
 * a reply keeps its quote first so readers still recognise it, the marker goes on the body.
 */
function mergedContent(message: TicketMessage, fromTicketNumber: string): string {
    if (message.deletedAt) return message.content;
    const marker = `[Merged from #${fromTicketNumber}] `;
    const head = message.content.match(QUOTE_HEAD)?.[1];
    return head ? `${head}${marker}${message.content.slice(head.length)}` : `${marker}${message.content}`;
}

@Injectable()
export class TicketMergeService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly eventsGateway: EventsGateway,
        private readonly auditService: AuditService,
        @Optional() private readonly eventEmitter?: EventEmitter2,
        @Optional() private readonly noteDocuments?: TicketNoteDocumentService,
    ) {}

    async mergeTickets(
        primaryTicketId: string,
        secondaryTicketIds: string[],
        userId: string,
        reason?: string,
    ): Promise<Omit<Ticket, 'messages'> & { messages: PresentedThreadMessage<TicketMessage>[] }> {
        if (secondaryTicketIds.includes(primaryTicketId)) {
            throw new BadRequestException('Primary ticket cannot be in the list of secondary tickets');
        }

        // P1 fix: source ticket status update + new message insert + target
        // ticket update were three separate awaits (per secondary ticket
        // that's 4+ writes). A crash left messages orphaned on a cancelled
        // ticket, or the cancel-status without the merge message. Now atomic
        // via dataSource.transaction.
        const secondaryTicketNumbers = await this.dataSource.transaction(async (manager) => {
            if (manager.queryRunner?.isTransactionActive) {
                await manager.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_read' } });
                for (const id of [...new Set([primaryTicketId, ...secondaryTicketIds])].sort()) {
                    await manager.findOne(Ticket, { where: { id }, lock: { mode: 'pessimistic_write' } });
                }
            }
            const primaryTicket = await manager.findOne(Ticket, {
                where: { id: primaryTicketId },
                relations: ['user', 'assignedTo'],
            });
            if (!primaryTicket) {
                throw new NotFoundException('Primary ticket not found');
            }

            const secondaryTickets = await manager.find(Ticket, {
                where: { id: In(secondaryTicketIds) },
                relations: ['user'],
            });
            if (secondaryTickets.length !== secondaryTicketIds.length) {
                throw new NotFoundException('One or more secondary tickets not found');
            }

            const user = await manager.findOne(User, { where: { id: userId } });
            if (!user) {
                throw new NotFoundException('User not found');
            }

            assertTicketRoleAccess(primaryTicket, user.role);
            for (const secondaryTicket of secondaryTickets) {
                assertTicketRoleAccess(secondaryTicket, user.role);
            }

            // Site isolation: every ticket in the merge set must be from the caller's site.
            validateTicketSiteAccess(user.role as any, (user as any).siteId ?? null, (primaryTicket as any).siteId ?? null);
            for (const secondaryTicket of secondaryTickets) {
                validateTicketSiteAccess(user.role as any, (user as any).siteId ?? null, (secondaryTicket as any).siteId ?? null);
            }

            // Pre-validate status before any writes
            for (const secondaryTicket of secondaryTickets) {
                if (TICKET_INACTIVE_STATUSES.includes(secondaryTicket.status)) {
                    throw new BadRequestException(`Cannot merge resolved, closed or cancelled ticket: ${secondaryTicket.ticketNumber}`);
                }
            }

            const ticketNumbers: string[] = [];
            for (const secondaryTicket of secondaryTickets) {
                ticketNumbers.push(secondaryTicket.ticketNumber);

                // Automatically add secondary ticket requester as participant on primary ticket
                if (secondaryTicket.userId && secondaryTicket.userId !== primaryTicket.userId) {
                    const existingParticipant = await manager.findOne(TicketParticipant, {
                        where: { ticketId: primaryTicketId, userId: secondaryTicket.userId },
                    });
                    if (!existingParticipant) {
                        const newParticipant = manager.create(TicketParticipant, {
                            ticketId: primaryTicketId,
                            userId: secondaryTicket.userId,
                            invitedById: userId,
                            role: 'PARTICIPANT',
                        });
                        await manager.save(TicketParticipant, newParticipant);
                    }
                }

                // Also copy existing participants of secondaryTicket to primaryTicket
                const secondaryParticipants = await manager.find(TicketParticipant, {
                    where: { ticketId: secondaryTicket.id },
                });
                for (const sp of secondaryParticipants) {
                    if (sp.userId && sp.userId !== primaryTicket.userId) {
                        const existing = await manager.findOne(TicketParticipant, {
                            where: { ticketId: primaryTicketId, userId: sp.userId },
                        });
                        if (!existing) {
                            const newParticipant = manager.create(TicketParticipant, {
                                ticketId: primaryTicketId,
                                userId: sp.userId,
                                invitedById: userId,
                                role: sp.role || 'PARTICIPANT',
                            });
                            await manager.save(TicketParticipant, newParticipant);
                        }
                    }
                }

                const notes = await manager.find(TicketNote, { where: { ticketId: secondaryTicket.id },
                    order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
                for (const note of notes) {
                    const sessions = await manager.find(TicketNoteEditSession, { where: { noteId: note.id, closedAt: IsNull() } });
                    for (const session of sessions) await this.noteDocuments?.finalize(manager, note, session, new Date());
                    await manager.save(TicketNote, { ...note, ticketId: primaryTicketId });
                }

                // Move all source messages to the primary ticket in one bulk save
                const messages = await manager.find(TicketMessage, {
                    where: { ticketId: secondaryTicket.id },
                    order: { createdAt: 'ASC' },
                });

                // Copies get fresh ids up front, so a reply can point at the copy of its original.
                // Pins stay behind: they belong to the cancelled ticket's conversation.
                const copyIds = new Map(messages.map((message) => [message.id, randomUUID()]));
                const movedMessages = messages.map((message) =>
                    manager.create(TicketMessage, {
                        id: copyIds.get(message.id),
                        ticketId: primaryTicketId,
                        senderId: message.senderId,
                        content: mergedContent(message, secondaryTicket.ticketNumber),
                        replyToId: message.replyToId ? (copyIds.get(message.replyToId) ?? null) : null,
                        mentionedUserIds: message.mentionedUserIds ?? [],
                        attachments: message.attachments,
                        attachmentInfo: message.attachmentInfo,
                        isSystemMessage: message.isSystemMessage,
                        isInternal: message.isInternal,
                        createdAt: message.createdAt,
                        editedAt: message.editedAt ?? null,
                        deletedAt: message.deletedAt ?? null,
                        deletedById: message.deletedById ?? null,
                    }),
                );
                if (movedMessages.length > 0) {
                    await manager.save(TicketMessage, movedMessages);
                }

                // System note on the primary ticket
                const systemMessage = manager.create(TicketMessage, {
                    ticketId: primaryTicketId,
                    senderId: userId,
                    content: `System: Ticket #${secondaryTicket.ticketNumber} was merged into this ticket by ${user.fullName}${reason ? `. Reason: ${reason}` : ''}`,
                    isSystemMessage: true,
                });
                await manager.save(TicketMessage, systemMessage);

                // Mark secondary as cancelled (with a final system message)
                secondaryTicket.status = TicketStatus.CANCELLED;
                secondaryTicket.description = `[MERGED INTO #${primaryTicket.ticketNumber}] ${secondaryTicket.description}`;
                await manager.save(Ticket, secondaryTicket);

                const cancelMessage = manager.create(TicketMessage, {
                    ticketId: secondaryTicket.id,
                    senderId: userId,
                    content: `System: This ticket was merged into #${primaryTicket.ticketNumber} by ${user.fullName}`,
                    isSystemMessage: true,
                });
                await manager.save(TicketMessage, cancelMessage);
            }

            return ticketNumbers;
        });

        // Post-commit side effects (audit + WS push) — these should fire only
        // if the transaction succeeded.
        await this.auditService.log({
            userId,
            action: AuditAction.TICKET_MERGE,
            entityType: 'Ticket',
            entityId: primaryTicketId,
            oldValue: { secondaryTicketIds },
            newValue: { mergedInto: primaryTicketId, secondaryTicketNumbers },
            description: `Merged ${secondaryTicketIds.length} tickets into primary`,
        });

        const ticket = await this.ticketRepo.findOne({
            where: { id: primaryTicketId },
            relations: ['user', 'assignedTo', 'messages', 'messages.sender'],
        });
        if (!ticket) throw new NotFoundException('Ticket not found');
        this.eventsGateway.server.to(`ticket:${primaryTicketId}`).emit('ticket:updated', { ticketId: primaryTicketId });
        this.eventsGateway.emitToTicketAudience((ticket as any).siteId, 'ticket:updated', { ticketId: primaryTicketId });
        this.eventsGateway.notifyTicketListUpdate((ticket as any).siteId ?? null);
        this.eventsGateway.notifyDashboardStatsUpdate((ticket as any).siteId ?? null);
        // The merged-away tickets are now CANCELLED; integrations (iPop) track that status.
        for (const secondaryId of secondaryTicketIds) {
            this.eventEmitter?.emit('ticket.merged', { ticketId: secondaryId, mergedInto: primaryTicketId });
        }
        const messages = ticket.messages ?? [];
        return { ...ticket, messages: presentThread(messages, await loadMentionNames(this.ticketRepo.manager, messages)) };
    }
}
