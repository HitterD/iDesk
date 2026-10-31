import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { NoteDocumentNode } from './ticket-note.entity';

@Entity('ticket_note_revisions')
export class TicketNoteRevision {
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column('uuid') noteId: string;
    @Index({ unique: true }) @Column('uuid') sessionId: string;
    @Column('uuid') actorId: string;
    @Column('jsonb') document: NoteDocumentNode;
    @Column() contentVersion: number;
    @Column('timestamptz') closedAt: Date;
}
