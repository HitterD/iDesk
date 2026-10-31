import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ticket_note_members')
@Index(['noteId', 'userId'], { unique: true })
@Index('IDX_note_member_viewer', ['userId', 'noteId'])
export class TicketNoteMember {
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column('uuid') noteId: string;
    @Column('uuid') userId: string;
    @Column('uuid') addedById: string;
    @Column({ default: 0 }) lastReadSequence: number;
    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
