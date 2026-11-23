import {
    Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { RequestFlow } from './request-flow.entity';

export type RequestDocumentRevisionKind = 'GEN' | 'DIG' | 'IMP' | 'FIN';

@Entity('request_document_revisions')
@Unique('UQ_request_document_revisions_flowId_version', ['flowId', 'version'])
export class RequestDocumentRevision {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid' }) flowId: string;
    @ManyToOne(() => RequestFlow, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'flowId' }) flow: RequestFlow;

    @Column({ type: 'int' }) version: number;
    @Column({ type: 'varchar', length: 8 }) kind: RequestDocumentRevisionKind;
    @Column({ type: 'varchar', length: 200 }) label: string;
    @Column({ type: 'uuid', nullable: true }) actorId: string | null;
    @Column({ type: 'varchar', nullable: true, select: false }) scanPath: string | null;
    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
