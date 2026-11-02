import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TicketMessage } from './ticket-message.entity';

/** Audit trail of chat edits: the text a message had before each edit. Never shown to users. */
@Entity('ticket_message_edits')
@Index(['messageId'])
export class TicketMessageEdit {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => TicketMessage, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'messageId' })
    message: TicketMessage;

    @Column('uuid')
    messageId: string;

    @Column('text')
    previousContent: string;

    @Column({ type: 'uuid', nullable: true })
    editedById: string | null;

    @CreateDateColumn()
    editedAt: Date;
}
