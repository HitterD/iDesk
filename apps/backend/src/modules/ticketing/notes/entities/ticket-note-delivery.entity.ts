import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type NoteDeliveryKind = 'INVITE' | 'MESSAGE' | 'MENTION' | 'SOLUTION';

@Entity('ticket_note_deliveries')
@Index('IDX_note_delivery_pending', ['state', 'createdAt'])
export class TicketNoteDelivery {
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column('uuid') eventId: string;
    @Column('uuid') noteId: string;
    @Column('uuid') recipientId: string;
    @Column() sequence: number;
    @Column({ length: 30 }) kind: NoteDeliveryKind;
    @Column({ type: 'uuid', nullable: true }) notificationId: string | null;
    @Column({ length: 20, default: 'PENDING' }) state: string;
    @Column({ default: 0 }) attemptCount: number;
    @Column({ type: 'timestamptz', nullable: true }) claimedAt: Date | null;
    @Index({ unique: true }) @Column({ length: 255 }) dedupKey: string;
    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
