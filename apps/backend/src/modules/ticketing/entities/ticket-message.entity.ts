import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    OneToMany,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';
import type { TicketSystemEvent } from '../utils/ticket-activity.util';
import { TicketMessageReaction } from './ticket-message-reaction.entity';

export interface AttachmentInfo {
    path: string;
    name: string;
    size: number;
    mime: string;
}

@Entity('ticket_messages')
@Index(['ticketId'])
@Index(['ticketId', 'createdAt'])
export class TicketMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: true })
    clientRequestId: string | null;

    @Column('text')
    content: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column('simple-json', { nullable: true })
    attachments: string[];

    /**
     * Original name/size/type per uploaded file, same order as `attachments`.
     * Kept beside the path list (not in it) because storage cleanup, image
     * compression and backup sync all treat `attachments` as plain paths. Null on
     * messages created before this column existed.
     */
    @Column('simple-json', { nullable: true })
    attachmentInfo: AttachmentInfo[] | null;

    @Column({ default: false })
    isSystemMessage: boolean;

    /** Structured activity (actor, field changes, reason) for system messages; null on older ones. */
    @Column({ type: 'jsonb', nullable: true })
    systemEvent: TicketSystemEvent | null;

    // Internal notes are only visible to agents/admins, not customers
    @Column({ default: false })
    isInternal: boolean;

    @Column({ default: 'WEB' })
    source: string; // 'WEB' | 'EMAIL' ('TELEGRAM' on legacy messages)

    @ManyToOne(() => Ticket, (ticket) => ticket.messages)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column()
    ticketId: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'senderId' })
    sender: User;

    @Column({ type: 'varchar', nullable: true })
    senderId: string;

    @Column({ type: 'timestamp', nullable: true })
    editedAt: Date | null;

    /**
     * Soft delete for everyone. A plain column, not @DeleteDateColumn: the row must stay visible
     * so the chat can show "Pesan ini telah dihapus" in its place.
     */
    @Column({ type: 'timestamp', nullable: true })
    deletedAt: Date | null;

    /** Who deleted it: the sender, or an admin (then the placeholder says so). */
    @Column({ type: 'uuid', nullable: true })
    deletedById: string | null;

    /** Pinned to the bar above the chat (at most three per ticket). */
    @Column({ type: 'timestamp', nullable: true })
    pinnedAt: Date | null;

    @Column({ type: 'uuid', nullable: true })
    pinnedById: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'pinnedById' })
    pinnedBy?: User | null;

    /** The message this one replies to; its text still carries the `↩ Name: snippet` quote for old readers. */
    @Column({ type: 'uuid', nullable: true })
    replyToId: string | null;

    /** People the sender mentioned with @, already checked against who may be mentioned on this ticket. */
    @Column({ type: 'jsonb', default: () => "'[]'" })
    mentionedUserIds: string[];

    @OneToMany(() => TicketMessageReaction, (reaction) => reaction.message)
    reactions?: TicketMessageReaction[];
}
