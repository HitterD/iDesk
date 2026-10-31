import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ticket_note_attachments')
export class TicketNoteAttachment {
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column('uuid') noteId: string;
    @Column('uuid') uploaderId: string;
    @Column('text') storageKey: string;
    @Column({ length: 255 }) originalName: string;
    @Column({ length: 100 }) mime: string;
    @Column() size: number;
    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
