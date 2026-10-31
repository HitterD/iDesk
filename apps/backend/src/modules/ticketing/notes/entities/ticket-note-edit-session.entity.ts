import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ticket_note_edit_sessions')
@Index('IDX_note_active_session', ['noteId'], { unique: true, where: '"closedAt" IS NULL' })
export class TicketNoteEditSession {
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column('uuid') noteId: string;
    @Column('uuid') userId: string;
    @Column('timestamptz') leaseUntil: Date;
    @Column() baseVersion: number;
    @Column({ type: 'integer', nullable: true }) finalVersion: number | null;
    @Column({ type: 'timestamptz', nullable: true }) closedAt: Date | null;
    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
