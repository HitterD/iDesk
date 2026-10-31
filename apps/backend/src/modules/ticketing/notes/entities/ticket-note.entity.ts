import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface NoteDocumentNode {
    type: string;
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: { type: string; attrs?: Record<string, unknown> }[];
    content?: NoteDocumentNode[];
}

@Entity('ticket_notes')
@Index('IDX_note_ticket', ['ticketId', 'deletedAt'])
export class TicketNote {
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column('uuid') ticketId: string;
    @Column('uuid') createdById: string;
    @Column({ type: 'varchar', length: 200, default: '' }) title: string;
    @Column({ type: 'jsonb', default: { type: 'doc', content: [] } }) document: NoteDocumentNode;
    @Column({ default: 0 }) contentVersion: number;
    @Column({ default: 0 }) eventSequence: number;
    @Column({ type: 'uuid', nullable: true }) selectedSolutionMessageId: string | null;
    @Column({ type: 'uuid', nullable: true }) selectedById: string | null;
    @Column({ type: 'timestamptz', nullable: true }) selectedAt: Date | null;
    @Column({ type: 'timestamptz', nullable: true }) deletedAt: Date | null;
    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
    @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
