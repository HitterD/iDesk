import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ticket_note_messages')
@Index(['noteId', 'sequence'], { unique: true })
@Index(['noteId', 'authorId', 'clientRequestId'], { unique: true })
export class TicketNoteMessage {
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column('uuid') noteId: string;
    @Column('uuid') authorId: string;
    @Column('text') content: string;
    @Column() sequence: number;
    @Column({ type: 'jsonb', default: [] }) mentionedUserIds: string[];
    @Column({ type: 'jsonb', default: [] }) attachmentIds: string[];
    @Column('uuid') clientRequestId: string;
    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
