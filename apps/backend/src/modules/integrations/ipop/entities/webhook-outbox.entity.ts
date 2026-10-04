import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum WebhookOutboxStatus {
    PENDING = 'PENDING',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED',
}

/** One signed callback to an integration partner, retried until delivered or out of attempts. */
@Entity('integration_webhook_outbox')
export class WebhookOutbox {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** Partner the callback goes to (e.g. 'IPOP'). */
    @Column({ type: 'varchar', length: 20 })
    target: string;

    @Column({ type: 'varchar', length: 50 })
    event: string;

    @Column({ type: 'uuid', nullable: true })
    ticketId: string | null;

    @Column({ type: 'jsonb' })
    payload: Record<string, unknown>;

    @Column({ type: 'varchar', length: 20, default: WebhookOutboxStatus.PENDING })
    status: WebhookOutboxStatus;

    @Column({ type: 'smallint', default: 0 })
    attempts: number;

    @Column({ type: 'timestamp', default: () => 'now()' })
    nextAttemptAt: Date;

    @Column({ type: 'text', nullable: true })
    lastError: string | null;

    @Column({ type: 'timestamp', nullable: true })
    deliveredAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;
}
